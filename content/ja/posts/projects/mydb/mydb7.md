---
authorship: human-only
title: "MYDB 7. デッドロック検出とVMの実装"
description: "VMでは、MVCCに伴うバージョンの飛び越しとデッドロックに対処する必要があります。MYDBはトランザクションに印を付けるだけで取り消しやロールバックを行い、abortedなトランザクションのデータがほかへ影響しないようにします。この設計により並行処理の効率と信頼性を高め、従来の2PLで起こりがちなデッドロックを避けて、システム全体の安定性と性能を向上させます。"
date: 2021-12-23 21:20:00
categories: [projects]
tags: ["MYDB","Java","デッドロック検出","バージョン管理"]
image: "https://blog-img.774352199.xyz/BF3yDW.webp"
seoDescription: "MYDBのVM層を完成させる実装。バージョンの飛び越しを検査し、待ちグラフの深さ優先探索でデッドロックを検出。自動ロールバック、ロック解放、可視性判定を組み込みます。"
---

この章で扱うコードはすべて[backend/vm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/vm)にあります。

### はじめに

今回はVM層の仕上げです。MVCCで起こり得るバージョンの飛び越しと、2PLによるデッドロックをMYDBがどう避けるかを説明し、それらをバージョンマネージャーにまとめます。

### バージョンの飛び越し

本題の前に少し補足です。MVCCのおかげで、MYDBのトランザクションの取り消しやロールバックはとても簡単です。そのトランザクションをabortedにするだけで済みます。前の章の可視性ルールでは、ほかのトランザクションが生成したデータは、committedなものしか見えません。そのため、abortedなトランザクションのデータはほかへ影響せず、そのトランザクションが最初から存在しなかったのと同じになります。

バージョンの飛び越しについて、次の状況を考えます。Xには最初x0だけがあり、T1とT2の分離レベルはどちらもREPEATABLE READです。

```
T1 begin
T2 begin
R1(X) // T1 读取 x0
R2(X) // T2 读取 x0
U1(X) // T1 将 X 更新到 x1
T1 commit
U2(X) // T2 将 X 更新到 x2
T2 commit
```

実行自体は問題なく進みますが、論理的には少しおかしいところがあります。T1はXをx0からx1へ更新しており、これは問題ありません。しかしT2は、x1を飛ばしてx0からx2へ更新してしまっています。

READ COMMITTEDではバージョンの飛び越しを許しますが、REPEATABLE READでは許しません。対処は単純です。TiがXを変更しようとしたとき、Tiから見えないトランザクションTjがすでにXを変更していたら、Tiをロールバックさせます。

前の章でまとめたとおり、TjがTiから見えないのは次の2つの場合です。

1.  XID(Tj) > XID(Ti)
2.  Tj in SP(Ti)

したがって、飛び越しの確認も簡単です。変更対象Xの最新のコミット済みバージョンを取り出し、その作成者が現在のトランザクションから見えるかを調べます。

```java
public static boolean isVersionSkip(TransactionManager tm, Transaction t, Entry e) {
    long xmax = e.getXmax();
    if(t.level == 0) {
        return false;
    } else {
        return tm.isCommitted(xmax) && (xmax > t.xid  t.isInSnapshot(xmax));
  }
}
```

### デッドロック検出

前の章で説明したように、2PLではロックを保持するスレッドがそのロックを解放するまで、ほかのトランザクションがブロックされます。この待ち関係は有向辺で表せます。たとえばTjがTiを待つなら、Tj --> Tiです。こうした辺を集めると、必ずしも連結ではないグラフになります。デッドロックの検出は、このグラフに閉路があるかを調べるだけです。

MYDBはLockTableオブジェクトを使い、このグラフをメモリ上に保持します。管理用の構造は次のとおりです。

```java
public class LockTable {

    private Map<Long, List<Long>> x2u;  // 某个 XID 已经获得的资源的 UID 列表
    private Map<Long, Long> u2x;        // UID 被某个 XID 持有
    private Map<Long, List<Long>> wait; // 正在等待 UID 的 XID 列表
    private Map<Long, Lock> waitLock;   // 正在等待资源的 XID 的锁
    private Map<Long, Long> waitU;      // XID 正在等待的 UID
    private Lock lock;

    ...
}
```

待ちが発生するたびに辺を追加してみて、デッドロックを検出します。見つかればその辺を取り除いて追加を認めず、トランザクションも取り消します。

```java
// 不需要等待则返回 null，否则返回锁对象
// 会造成死锁则抛出异常
public Lock add(long xid, long uid) throws Exception {
    lock.lock();
    try {
        if(isInList(x2u, xid, uid)) {
            return null;
        }
        if(!u2x.containsKey(uid)) {
            u2x.put(uid, xid);
            putIntoList(x2u, xid, uid);
            return null;
        }
        waitU.put(xid, uid);
        putIntoList(wait, xid, uid);
        if(hasDeadLock()) {
            waitU.remove(xid);
            removeFromList(wait, uid, xid);
            throw Error.DeadlockException;
        }
        Lock l = new ReentrantLock();
        l.lock();
        waitLock.put(xid, l);
        return l;
    } finally {
        lock.unlock();
    }
}
```

addを呼んだ結果、待つ必要がある場合は、ロック済みのLockオブジェクトが返ります。呼び出し側がそのロックの取得を試みることで、スレッドをブロックできます。たとえば次のようにします。

```java
Lock l = lt.add(xid, uid);
if(l != null) {
    l.lock();   // 阻塞在这一步
    l.unlock();
}
```

閉路を探すアルゴリズムは単純な深さ優先探索です。ただし、グラフが連結とは限らないことに注意します。各ノードに訪問スタンプを設け、初期値を-1にします。全ノードを走査し、-1でない各ノードを根として深さ優先探索を行います。同じ連結グラフで訪れたノードには同じ番号を付け、別のグラフには別の番号を付けます。あるグラフの探索中にすでに訪問したノードへ到達したら、閉路があることになります。

実装は簡単です。

```java
private boolean hasDeadLock() {
    xidStamp = new HashMap<>();
    stamp = 1;
    for(long xid : x2u.keySet()) {
        Integer s = xidStamp.get(xid);
        if(s != null && s > 0) {
            continue;
        }
        stamp ++;
        if(dfs(xid)) {
            return true;
        }
    }
    return false;
}

private boolean dfs(long xid) {
    Integer stp = xidStamp.get(xid);
    if(stp != null && stp == stamp) {
        return true;
    }
    if(stp != null && stp < stamp) {
        return false;
    }
    xidStamp.put(xid, stamp);

    Long uid = waitU.get(xid);
    if(uid == null) return false;
    Long x = u2x.get(uid);
    assert x != null;
    return dfs(x);
}
```

トランザクションがcommitまたはabortしたら、保持するロックをすべて解放し、自分を待ちグラフから取り除けます。

```java
public void remove(long xid) {
    lock.lock();
    try {
        List<Long> l = x2u.get(xid);
        if(l != null) {
            while(l.size() > 0) {
                Long uid = l.remove(0);
                selectNewXID(uid);
            }
        }
        waitU.remove(xid);
        x2u.remove(xid);
        waitLock.remove(xid);
    } finally {
        lock.unlock();
    }
}
```

whileループでこのスレッドの保持するリソースのロックをすべて解放すると、待っていたスレッドが取得できるようになります。

```java
// 从等待队列中选择一个 xid 来占用 uid
private void selectNewXID(long uid) {
    u2x.remove(uid);
    List<Long> l = wait.get(uid);
    if(l == null) return;
    assert l.size() > 0;
    while(l.size() > 0) {
        long xid = l.remove(0);
        if(!waitLock.containsKey(xid)) {
            continue;
        } else {
            u2x.put(uid, xid);
            Lock lo = waitLock.remove(xid);
            waitU.remove(xid);
            lo.unlock();
            break;
        }
    }
    if(l.size() == 0) wait.remove(uid);
}
```

Listの先頭から待ちを解除するので、公平なロックにもなっています。Lockオブジェクトをunlockすれば、処理を行うスレッドがロックを取得し、実行を続けられます。

### VMの実装

VM層はVersionManagerインターフェースを通して上位へ機能を提供します。

```java
public interface VersionManager {
    byte[] read(long xid, long uid) throws Exception;
    long insert(long xid, byte[] data) throws Exception;
    boolean delete(long xid, long uid) throws Exception;

    long begin(int level);
    void commit(long xid) throws Exception;
    void abort(long xid);
}
```

実装クラスはEntryのキャッシュも兼ねるため、`AbstractCache<Entry>`を継承します。リソースをキャッシュへ読み込むメソッドと、キャッシュから解放するメソッドは簡単です。

```java
@Override
protected Entry getForCache(long uid) throws Exception {
    Entry entry = Entry.loadEntry(this, uid);
    if(entry == null) {
        throw Error.NullEntryException;
    }
    return entry;
}

@Override
protected void releaseForCache(Entry entry) {
    entry.remove();
}
```

`begin()`はトランザクションを開始し、管理用の構造を初期化してactiveTransactionへ格納します。これは確認処理とスナップショットに使います。

```java
@Override
public long begin(int level) {
    lock.lock();
    try {
        long xid = tm.begin();
        Transaction t = Transaction.newTransaction(xid, level, activeTransaction);
        activeTransaction.put(xid, t);
        return xid;
    } finally {
        lock.unlock();
    }
}
```

`commit()`はトランザクションをコミットします。主な処理は、関連する管理情報の解放、保持するロックの解放、TM上の状態の更新です。

```java
@Override
public void commit(long xid) throws Exception {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    lock.unlock();
    try {
        if(t.err != null) {
            throw t.err;
        }
    } catch(NullPointerException n) {
        System.out.println(xid);
        System.out.println(activeTransaction.keySet());
        Panic.panic(n);
    }
    lock.lock();
    activeTransaction.remove(xid);
    lock.unlock();
    lt.remove(xid);
    tm.commit(xid);
}
```

abortには手動と自動の2種類があります。手動ではabort()を呼びます。自動では、デッドロックを検出した場合やバージョンの飛び越しが起きた場合に、トランザクションを取り消してロールバックします。

```java
private void internAbort(long xid, boolean autoAborted) {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    if(!autoAborted) {
        activeTransaction.remove(xid);
    }
    lock.unlock();
    if(t.autoAborted) return;
    lt.remove(xid);
    tm.abort(xid);
}
```

`read()`はentryを読み取ります。可視性の確認を忘れなければ大丈夫です。

```java
@Override
public byte[] read(long xid, long uid) throws Exception {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    lock.unlock();
    if(t.err != null) {
        throw t.err;
    }
    Entry entry = super.get(uid);
    try {
        if(Visibility.isVisible(tm, t, entry)) {
            return entry.data();
        } else {
            return null;
        }
    } finally {
        entry.release();
    }
}
```

`insert()`はデータをEntryで包み、そのままDMに挿入を任せるだけです。

```java
@Override
public long insert(long xid, byte[] data) throws Exception {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    lock.unlock();
    if(t.err != null) {
        throw t.err;
    }
    byte[] raw = Entry.wrapEntryRaw(xid, data);
    return dm.insert(xid, raw);
}
```

`delete()`は少し複雑に見えます。

```java
@Override
public boolean delete(long xid, long uid) throws Exception {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    lock.unlock();

    if(t.err != null) {
        throw t.err;
    }
    Entry entry = super.get(uid);
    try {
        if(!Visibility.isVisible(tm, t, entry)) {
            return false;
        }
        Lock l = null;
        try {
            l = lt.add(xid, uid);
        } catch(Exception e) {
            t.err = Error.ConcurrentUpdateException;
            internAbort(xid, true);
            t.autoAborted = true;
            throw t.err;
        }
        if(l != null) {
            l.lock();
            l.unlock();
        }
        if(entry.getXmax() == xid) {
            return false;
        }
        if(Visibility.isVersionSkip(tm, t, entry)) {
            t.err = Error.ConcurrentUpdateException;
            internAbort(xid, true);
            t.autoAborted = true;
            throw t.err;
        }
        entry.setXmax(xid);
        return true;
    } finally {
        entry.release();
    }
}
```

実際には、可視性の判定、リソースのロック取得、バージョンの飛び越しの判定という3つの前処理が中心です。削除そのものはXMAXを設定するだけです。

今日は2021年12月24日、クリスマスイブです。

> あなたの行く先が輝かしいものでありますように  
> あなたが愛する人と結ばれますように  
> あなたがこの世で幸せを得られますように  
> 私はただ海に向かい、春のぬくもりの中で花が咲くことを願う
