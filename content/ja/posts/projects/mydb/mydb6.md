---
authorship: human-only
title: "MYDB 6. レコードのバージョンとトランザクション分離"
description: "VMは二相ロックでスケジュールの直列化可能性を保証し、多版型同時実行制御（MVCC）を導入して読み取りと書き込みの相互ブロックを解消します。また、データベース操作の競合を定義し、特に更新と読み取りの関係を整理することで、トランザクションの分離レベルを理解する土台を作ります。"
date: 2021-12-18 14:58:00
categories: [projects]
tags: ["MYDB","Java","MVCC","トランザクション分離","二相ロック"]
image: "https://blog-img.774352199.xyz/8YzotA.webp"
seoDescription: "MYDBのMVCCを実装。XMIN、XMAXとトランザクションのスナップショットで、READ COMMITTEDとREPEATABLE READの可視性を判定する仕組みを説明します。"
---

この章で扱うコードはすべて[backend/vm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/vm)にあります。

### はじめに

この章から、バージョンマネージャーについて説明します。

> VMは二相ロック（2PL）でスケジュールの直列化可能性を実現し、MVCCで読み取りと書き込みの相互ブロックを解消します。また、2種類の分離レベルも実装します。

データマネージャーがMYDBのデータ管理の中核であるように、バージョンマネージャーはトランザクションとデータのバージョン管理の中核です。

### 2PLとMVCC

#### 競合と2PL

まず、データベースにおける競合を定義します。挿入はひとまず考えず、更新（U）と読み取り（R）だけを扱います。2つの操作が次の3条件を満たすとき、互いに競合するといいます。

1.  異なるトランザクションが実行する操作である。
2.  同じデータ項目を操作する。
3.  少なくとも一方が更新操作である。

したがって、同じデータに対する競合は次の2種類だけです。

1.  異なる2つのトランザクションのU同士の競合。
2.  異なる2つのトランザクションのUとRの競合。

競合するかどうかが、なぜ重要なのでしょうか。**競合しない2つの操作は順番を入れ替えても最終結果が変わらない**のに対し、競合する操作は順番によって結果が変わるからです。

競合の話をいったん置いて、第4章の例を思い出してください。2つのトランザクションが並行してxを操作します。xの初期値を0とします。

```
T1 begin
T2 begin
R1(x) // T1 读到 0
R2(x) // T2 读到 0
U1(0+1) // T1 尝试把 x+1
U2(0+1) // T2 尝试把 x+1
T1 commit
T2 commit
```

最終的なxは1で、明らかに期待した結果ではありません。

VMの重要な役割の1つは、スケジュールの直列化可能性を実現することです。MYDBでは二相ロック（2PL）を使います。トランザクションiがxをロックしており、トランザクションjもxを操作したい場合、その操作がiの先行する操作と競合すれば、jはブロックされます。たとえばT1がU1(x)のためにxをロックしているなら、T2によるxの読み取りも書き込みもブロックされます。T2はT1がxのロックを解放するまで待つ必要があります。

このように、2PLはスケジュールの直列化可能性を保証しますが、トランザクション同士のブロックは避けられず、デッドロックを起こすこともあります。MYDBでは処理効率を高め、ブロックの確率を下げるためにMVCCを実装します。

#### MVCC

MVCCに入る前に、レコードとバージョンの意味を整理します。

DM層は上位にデータ項目（Data Item）を提供します。VMはそれらを管理し、上位にはレコード（Entry）を提供します。上位モジュールがVMを通して扱うデータの最小単位はレコードです。VMの内部では、レコードごとに複数のバージョン（Version）を管理します。上位モジュールがレコードを変更するたびに、新しいバージョンを作ります。

MYDBはMVCCでトランザクションがブロックされる確率を下げます。たとえばT1がレコードXを更新する場合、まずXのロックを取得し、更新、つまり新しいバージョンx3を作成します。T1がまだロックを解放していない間にT2がXを読みたくなっても、ブロックせず、x2などの古いバージョンを返します。結果はT2、T1の順で実行した場合と等価で、直列化可能性は保たれます。Xに古いバージョンがなければ、T1のロック解放を待つしかありません。だから、あくまで確率を下げるという話です。

第4章で、復旧可能性を保証するため、VMからDMへ渡す操作列に次の2つのルールを課したことを思い出してください。

> ルール1：実行中のトランザクションは、ほかの未コミットのトランザクションが生成したデータを読みません。  
> ルール2：実行中のトランザクションは、ほかの未コミットのトランザクションが変更または生成したデータを変更しません。

2PLとMVCCがあれば、どちらも自然に満たせることがわかります。

### レコードの実装

MYDBではEntryクラスでレコードの構造を管理します。理論上、MVCCには複数のバージョンがありますが、実装上のVMはUpdate操作を提供しません。フィールドの更新は、後で説明するテーブルマネージャー（TBM）が担当します。そのため、VMの実装では1つのレコードにバージョンは1つだけです。

1つのレコードは1つのData Itemに保存されるので、EntryにはDataItemへの参照を持たせれば十分です。

```java
public class Entry {
    private static final int OF_XMIN = 0;
    private static final int OF_XMAX = OF_XMIN+8;
    private static final int OF_DATA = OF_XMAX+8;

    private long uid;
    private DataItem dataItem;
    private VersionManager vm;

    public static Entry loadEntry(VersionManager vm, long uid) throws Exception {
        DataItem di = ((VersionManagerImpl)vm).dm.read(uid);
        return newEntry(vm, di, uid);
    }

    public void remove() {
        dataItem.release();
    }
}
```

Entry内のデータ形式を次のように定めます。

```
[XMIN] [XMAX] [DATA]
```

XMINはそのレコード（バージョン）を作成したトランザクション番号、XMAXは削除したトランザクション番号です。役割は次の節で説明します。DATAはレコードの実データです。この構造に従い、レコード作成時に呼ぶ`wrapEntryRaw()`は次のようになります。

```java
public static byte[] wrapEntryRaw(long xid, byte[] data) {
    byte[] xmin = Parser.long2Byte(xid);
    byte[] xmax = new byte[8];
    return Bytes.concat(xmin, xmax, data);
}
```

レコードのデータを取得するときも、この構造に従って解析します。

```java
// 以拷贝的形式返回内容
public byte[] data() {
    dataItem.rLock();
    try {
        SubArray sa = dataItem.data();
        byte[] data = new byte[sa.end - sa.start - OF_DATA];
        System.arraycopy(sa.raw, sa.start+OF_DATA, data, 0, data.length);
        return data;
    } finally {
        dataItem.rUnLock();
    }
}
```

ここではデータをコピーして返します。変更する場合はDataItemの`before()`を呼ぶ必要があり、XMAXを設定する処理にもそれが現れています。

```java
public void setXmax(long xid) {
    dataItem.before();
    try {
        SubArray sa = dataItem.data();
        System.arraycopy(Parser.long2Byte(xid), 0, sa.raw, sa.start+OF_XMAX, 8);
    } finally {
        dataItem.after(xid);
    }
}
```

`before()`と`after()`は、DataItemの章で定めた変更手順です。

### トランザクションの分離レベル

#### READ COMMITTED

前述のとおり、レコードの最新バージョンがロックされているときに別のトランザクションが変更または読み取りを行うと、MYDBは古いバージョンを返します。つまり、最新のロックされたバージョンは、そのトランザクションからは見えないと考えられます。これがバージョンの可視性という概念です。

可視性は、トランザクションの分離レベルに関係します。MYDBが対応する最低の分離レベルはREAD COMMITTEDで、コミット済みのトランザクションが生成したデータだけを読み取れます。最低でもこのレベルを保証する理由は、第4章で説明したとおり、連鎖ロールバックとcommitの意味の衝突を防ぐためです。

MYDBはREAD COMMITTEDを実現するため、各バージョンに前述の2つの変数を持たせます。

- XMIN：そのバージョンを作成したトランザクション番号
- XMAX：そのバージョンを削除したトランザクション番号

XMINはバージョン作成時に設定し、XMAXは削除時、または新しいバージョンが現れたときに設定します。

XMAXがあれば、DM層に削除操作がない理由も説明できます。バージョンを削除したいときはXMAXを設定するだけで、その後のトランザクションからは見えなくなります。これで削除と同じ効果が得られます。

READ COMMITTEDでの可視性判定は次のようになります。

```
(XMIN == Ti and                             // 由 Ti 创建且
    XMAX == NULL                            // 还未被删除
)
or                                          // 或
(XMIN is commited and                       // 由一个已提交的事务创建且
    (XMAX == NULL or                        // 尚未删除或
    (XMAX != Ti and XMAX is not commited)   // 由一个未提交的事务删除
))
```

条件がtrueなら、そのバージョンはTiから見えます。Tiに適したバージョンを探すには、最新のものから古いものへ順に可視性を調べ、trueになったものを返せば十分です。

次のメソッドで、レコードがトランザクションtから見えるかを判定します。

```java
private static boolean readCommitted(TransactionManager tm, Transaction t, Entry e) {
    long xid = t.xid;
    long xmin = e.getXmin();
    long xmax = e.getXmax();
    if(xmin == xid && xmax == 0) return true;

    if(tm.isCommitted(xmin)) {
        if(xmax == 0) return true;
        if(xmax != xid) {
            if(!tm.isCommitted(xmax)) {
                return true;
            }
        }
    }
    return false;
}
```

ここでのTransactionは、XIDだけを提供する構造です。

#### REPEATABLE READ

READ COMMITTEDで起きる問題は、面接対策でもよく出てくるのでご存じでしょう。非反復読み取りとファントムリードです。ここでは非反復読み取りを解決します。

非反復読み取りとは、同じトランザクションの実行中に同じデータ項目を読んでも、結果が変わることです。たとえば、Xの初期値を0とします。

```
T1 begin
R1(X) // T1 读得 0
T2 begin
U2(X) // 将 X 修改为 1
T2 commit
R1(X) // T1 读的 1
```

T1がXを2回読んだ結果が異なっています。これを避けるには、より厳しい分離レベルであるREPEATABLE READが必要です。

問題は、T1の2回目の読み取りで、すでにコミットしたT2による変更が見えてしまったことです。そこで、次のルールを設けます。

> トランザクションは、自分が開始した時点ですでに終了していたトランザクションが生成したデータのバージョンだけを読み取れます。

このルールを加えると、次のデータを無視する必要があります。

1.  自分より後に開始したトランザクションのデータ。
2.  自分の開始時点でまだactiveだったトランザクションのデータ。

1つ目はトランザクションIDを比較すれば判断できます。2つ目は、Tiの開始時に、その時点でactiveなすべてのトランザクションをSP(Ti)として記録します。バージョンのXMINがSP(Ti)に含まれていれば、そのバージョンもTiからは見えないことになります。

したがって、REPEATABLE READの判定は次のようになります。

```
(XMIN == Ti and                 // 由 Ti 创建且
 (XMAX == NULL                  // 尚未被删除
))
or                              // 或
(XMIN is commited and           // 由一个已提交的事务创建且
 XMIN < XID and                 // 这个事务小于 Ti 且
 XMIN is not in SP(Ti) and      // 这个事务在 Ti 开始前提交且
 (XMAX == NULL or               // 尚未被删除或
  (XMAX != Ti and               // 由其他事务删除但是
   (XMAX is not commited or     // 这个事务尚未提交或
XMAX > Ti or                    // 这个事务在 Ti 开始之后才开始或
XMAX is in SP(Ti)               // 这个事务在 Ti 开始前还未提交
))))
```

このスナップショットを保存するため、トランザクションを表す構造が必要です。

```java
public class Transaction {
    public long xid;
    public int level;
    public Map<Long, Boolean> snapshot;
    public Exception err;
    public boolean autoAborted;

    public static Transaction newTransaction(long xid, int level, Map<Long, Transaction> active) {
        Transaction t = new Transaction();
        t.xid = xid;
        t.level = level;
        if(level != 0) {
            t.snapshot = new HashMap<>();
            for(Long x : active.keySet()) {
                t.snapshot.put(x, true);
            }
        }
        return t;
    }

    public boolean isInSnapshot(long xid) {
        if(xid == TransactionManagerImpl.SUPER_XID) {
            return false;
        }
        return snapshot.containsKey(xid);
    }
}
```

コンストラクターのactiveには、現在activeなすべてのトランザクションが入っています。REPEATABLE READでの可視性判定は次のとおりです。

```java
private static boolean repeatableRead(TransactionManager tm, Transaction t, Entry e) {
    long xid = t.xid;
    long xmin = e.getXmin();
    long xmax = e.getXmax();
    if(xmin == xid && xmax == 0) return true;

    if(tm.isCommitted(xmin) && xmin < xid && !t.isInSnapshot(xmin)) {
        if(xmax == 0) return true;
        if(xmax != xid) {
            if(!tm.isCommitted(xmax) || xmax > xid || t.isInSnapshot(xmax)) {
                return true;
            }
        }
    }
    return false;
}
```
