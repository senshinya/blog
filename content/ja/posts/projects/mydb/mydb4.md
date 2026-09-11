---
authorship: human-only
title: "MYDB 4. ログファイルと復旧戦略"
description: "MYDBでは、クラッシュ後にデータを復旧できるよう、ログファイルが重要な役割を担います。DMは下位のデータを操作するたびにログを生成・記録し、連続したログ列を作ります。チェックサムと各操作の記録を含む所定のバイナリー形式で保存することで、再起動時にデータの状態を正確に再構築し、整合性と完全性を保ちます。"
date: 2021-12-08 22:55:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/TRcbsj.webp"
seoDescription: "MYDBのログにチェックサムと末尾の不完全データ除去を実装。データ変更前のログ保存、トランザクション状態、redoとundoによるクラッシュ復旧と並行実行の制約を説明します。"
---

この章で扱うコードは[backend/dm/logger](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/logger)と[backend/dm/Recover.java](https://github.com/CN-GuoZiyang/MYDB/blob/master/src/main/java/top/guoziyang/mydb/backend/dm/Recover.java)にあります。

### はじめに

MYDBには、クラッシュ後のデータ復旧機能があります。DM層は下位のデータを操作するたびに、ログをディスクへ記録します。クラッシュ後に再起動するときは、その内容からデータファイルを復旧し、整合性を確保します。

### ログの読み書き

ログのバイナリーファイルは、次の形式で並びます。

```
[XChecksum][Log1][Log2][Log3]...[LogN][BadTail]
```

XChecksumは4バイトの整数で、それ以降のすべてのログから計算したチェックサムです。Log1〜LogNは通常のログデータ、BadTailはクラッシュまでに書き終わらなかったログデータです。BadTailは存在しないこともあります。

各ログの形式は次のとおりです。

```
[Size][Checksum][Data]
```

SizeはData部分のバイト数を示す4バイトの整数です。Checksumは、そのログのチェックサムを表します。

各ログのチェックサムは、所定のシード値を使って計算します。

```java
private int calChecksum(int xCheck, byte[] log) {
    for (byte b : log) {
        xCheck = xCheck * SEED + b;
    }
    return xCheck;
}
```

このように各ログのチェックサムを求めて積み重ねると、ログファイル全体のチェックサムが得られます。

Loggerはイテレーターパターンで実装します。`next()`を繰り返し呼ぶと、ファイルから次のログを読み込み、Data部分を取り出して返します。`next()`の中心となるのが次の`internNext()`です。positionは、ログファイルの現在の読み取り位置を示すオフセットです。

```java
private byte[] internNext() {
    if(position + OF_DATA >= fileSize) {
        return null;
    }
    // 读取 size
    ByteBuffer tmp = ByteBuffer.allocate(4);
    fc.position(position);
    fc.read(tmp);
    int size = Parser.parseInt(tmp.array());
    if(position + size + OF_DATA > fileSize) {
        return null;
    }

    // 读取 checksum+data
    ByteBuffer buf = ByteBuffer.allocate(OF_DATA + size);
    fc.position(position);
    fc.read(buf);
    byte[] log = buf.array();

    // 校验 checksum
    int checkSum1 = calChecksum(0, Arrays.copyOfRange(log, OF_DATA, log.length));
    int checkSum2 = Parser.parseInt(Arrays.copyOfRange(log, OF_CHECKSUM, OF_DATA));
    if(checkSum1 != checkSum2) {
        return null;
    }
    position += log.length;
    return log;
}
```

ログファイルを開くときは、まずXChecksumを検証し、末尾にBadTailがあれば除去します。BadTailは書き込みが完了していないため、ファイルのチェックサムにはそのログが含まれていません。したがって、BadTailを取り除けばログファイルの整合性を保てます。

```java
private void checkAndRemoveTail() {
    rewind();

    int xCheck = 0;
    while(true) {
        byte[] log = internNext();
        if(log == null) break;
        xCheck = calChecksum(xCheck, log);
    }
    if(xCheck != xChecksum) {
        Panic.panic(Error.BadLogFileException);
    }

    // 截断文件到正常日志的末尾
    truncate(position);
    rewind();
}
```

ログを書き込むときも、まずデータをログ形式で包み、ファイルに書いてからファイル全体のチェックサムを更新します。チェックサムの更新時にはバッファーをフラッシュし、内容がディスクへ書き込まれるようにします。

```java
public void log(byte[] data) {
    byte[] log = wrapLog(data);
    ByteBuffer buf = ByteBuffer.wrap(log);
    lock.lock();
    try {
        fc.position(fc.size());
        fc.write(buf);
    } catch(IOException e) {
        Panic.panic(e);
    } finally {
        lock.unlock();
    }
    updateXChecksum(log);
}

private void updateXChecksum(byte[] log) {
    this.xChecksum = calChecksum(this.xChecksum, log);
    fc.position(0);
    fc.write(ByteBuffer.wrap(Parser.int2Byte(xChecksum)));
    fc.force(false);
}

private byte[] wrapLog(byte[] data) {
    byte[] checksum = Parser.int2Byte(calChecksum(0, data));
    byte[] size = Parser.int2Byte(data.length);
    return Bytes.concat(size, checksum, data);
}
```

### 復旧戦略

復旧戦略はNYADB2のものを使っています。私には、なかなか頭を使う内容でした。

DMは上位モジュールに、新しいデータの挿入（I）と既存データの更新（U）という2つの操作を提供します。削除がない理由は、VMの章で説明します。

DMのログ方針は、ひと言で書けるほど単純です。

> IまたはUを実行する前に、必ず対応するログを記録します。ログがディスクに書き込まれたことを保証してから、データ操作を行います。

この方針により、DMはデータ操作をディスクへ同期するタイミングを柔軟に選べます。データ操作より先にログがディスクへ届くため、操作結果を同期する前にクラッシュしても、ディスク上のログからデータを復旧できます。

2つのデータ操作について、DMは次のログを記録します。

- (Ti, I, A, x)：トランザクションTiが位置Aにデータxを挿入したことを表します。
- (Ti, U, A, oldx, newx)：トランザクションTiが位置Aのデータをoldxからnewxへ更新したことを表します。

まず並行実行を考えず、ある時点でデータベースを操作できるトランザクションは1つだけとします。ログは次のようになります。

```
(Ti, x, x), ..., (Ti, x, x), (Tj, x, x), ..., (Tj, x, x), (Tk, x, x), ..., (Tk, x, x)
```

#### シングルスレッド

シングルスレッドなら、Ti、Tj、Tkのログが入り交じることはありません。この場合の復旧は簡単です。ログの最後のトランザクションがTiだとします。

1.  Tiより前のすべてのトランザクションのログを再実行（redo）します。
2.  XIDファイルでTiの状態を確認します。終了済み（committedまたはaborted）ならTiもredoし、そうでなければ取り消し（undo）します。

トランザクションTをredoする手順は次のとおりです。

1.  Tのすべてのログを順方向に走査します。
2.  挿入操作(Ti, I, A, x)なら、位置Aにxを再び挿入します。
3.  更新操作(Ti, U, A, oldx, newx)なら、位置Aの値をnewxにします。

undoもわかりやすい処理です。

1.  Tのすべてのログを逆方向に走査します。
2.  挿入操作(Ti, I, A, x)なら、位置Aのデータを削除します。
3.  更新操作(Ti, U, A, oldx, newx)なら、位置Aの値をoldxにします。

なお、MYDBには実際にデータを消す削除操作はありません。挿入のundoでは、フラグをinvalidにするだけです。削除についてはVMの章で説明します。

#### マルチスレッド

以上で、シングルスレッドの場合の復旧は保証できました。では、マルチスレッドではどうでしょうか。次の2つのケースを考えます。

まず1つ目です。

```
T1 begin
T2 begin
T2 U(x)
T1 R(x)
...
T1 commit
MYDB break down
```

クラッシュ時にT2はまだactiveです。再起動して復旧処理を行うと、T2がundoされ、その影響は取り除かれます。しかしT1はT2が更新した値を読んでいるので、T2を取り消すならT1も取り消す必要があります。これが連鎖ロールバックです。ところがT1はすでにcommitしており、コミット済みのトランザクションの結果は永続化されなければなりません。矛盾してしまいます。そこで、次の保証が必要です。

> ルール1：実行中のトランザクションは、ほかの未コミットのトランザクションが生成したデータを読みません。

2つ目のケースでは、xの初期値を0とします。

```
T1 begin
T2 begin
T1 set x = x+1 // 产生的日志为 (T1, U, A, 0, 1)
T2 set x = x+1 // 产生的日志为 (T1, U, A, 1, 2)
T2 commit
MYDB break down
```

クラッシュ時にT1はまだactiveです。再起動後の復旧ではT1をundoし、T2をredoします。しかし、undoとredoの順番がどちらであっても、xの最終値は0か2になり、どちらも誤りです。

> 根本的な原因は、ログが単純すぎることです。「変更前イメージ」と「変更後イメージ」だけを記録し、前者でundo、後者でredoするだけでは、データベース操作の持つ意味をすべて扱いきれません。

解決方法は2つあります。

1.  ログの種類を増やす。
2.  データベース操作を制限する。

MYDBでは操作を制限する方法を採り、次を保証します。

> ルール2：実行中のトランザクションは、ほかの未コミットのトランザクションが変更または生成したデータを変更しません。

MYDBではVMがあるため、DMへ渡されて実際に実行される操作列は、ルール1と2を満たします。VMがどう保証するかはVMの章で説明します。VMには説明すべきことがずいぶんありますね。この2つのルールがあれば、並行実行時のログ復旧も簡単になります。

1.  クラッシュ時に終了済み（committedまたはaborted）だったトランザクションをすべてredoします。
2.  クラッシュ時に未終了（active）だったトランザクションをすべてundoします。

復旧後のデータベースは、終了済みのトランザクションはすべて完了し、未終了のトランザクションはまだ始まっていない状態になります。

#### 実装

まず、2種類のログ形式を定めます。

```java
private static final byte LOG_TYPE_INSERT = 0;
private static final byte LOG_TYPE_UPDATE = 1;

// updateLog:
// [LogType] [XID] [UID] [OldRaw] [NewRaw]

// insertLog:
// [LogType] [XID] [Pgno] [Offset] [Raw]
```

原理の説明と同様に、recoverの中心も2つの手順です。終了済みのトランザクションをすべてredoし、未終了のトランザクションをすべてundoします。

```java
private static void redoTranscations(TransactionManager tm, Logger lg, PageCache pc) {
    lg.rewind();
    while(true) {
        byte[] log = lg.next();
        if(log == null) break;
        if(isInsertLog(log)) {
            InsertLogInfo li = parseInsertLog(log);
            long xid = li.xid;
            if(!tm.isActive(xid)) {
                doInsertLog(pc, log, REDO);
            }
        } else {
            UpdateLogInfo xi = parseUpdateLog(log);
            long xid = xi.xid;
            if(!tm.isActive(xid)) {
                doUpdateLog(pc, log, REDO);
            }
        }
    }
}

private static void undoTranscations(TransactionManager tm, Logger lg, PageCache pc) {
    Map<Long, List<byte[]>> logCache = new HashMap<>();
    lg.rewind();
    while(true) {
        byte[] log = lg.next();
        if(log == null) break;
        if(isInsertLog(log)) {
            InsertLogInfo li = parseInsertLog(log);
            long xid = li.xid;
            if(tm.isActive(xid)) {
                if(!logCache.containsKey(xid)) {
                    logCache.put(xid, new ArrayList<>());
                }
                logCache.get(xid).add(log);
            }
        } else {
            UpdateLogInfo xi = parseUpdateLog(log);
            long xid = xi.xid;
            if(tm.isActive(xid)) {
                if(!logCache.containsKey(xid)) {
                    logCache.put(xid, new ArrayList<>());
                }
                logCache.get(xid).add(log);
            }
        }
    }

    // 对所有 active log 进行倒序 undo
    for(Entry<Long, List<byte[]>> entry : logCache.entrySet()) {
        List<byte[]> logs = entry.getValue();
        for (int i = logs.size()-1; i >= 0; i --) {
            byte[] log = logs.get(i);
            if(isInsertLog(log)) {
                doInsertLog(pc, log, UNDO);
            } else {
                doUpdateLog(pc, log, UNDO);
            }
        }
        tm.abort(entry.getKey());
    }
}
```

updateLogとinsertLogは、それぞれredoとundoを1つのメソッドにまとめて実装します。

```java
private static void doUpdateLog(PageCache pc, byte[] log, int flag) {
    int pgno;
    short offset;
    byte[] raw;
    if(flag == REDO) {
        UpdateLogInfo xi = parseUpdateLog(log);
        pgno = xi.pgno;
        offset = xi.offset;
        raw = xi.newRaw;
    } else {
        UpdateLogInfo xi = parseUpdateLog(log);
        pgno = xi.pgno;
        offset = xi.offset;
        raw = xi.oldRaw;
    }
    Page pg = null;
    try {
        pg = pc.getPage(pgno);
    } catch (Exception e) {
        Panic.panic(e);
    }
    try {
        PageX.recoverUpdate(pg, raw, offset);
    } finally {
        pg.release();
    }
}

private static void doInsertLog(PageCache pc, byte[] log, int flag) {
    InsertLogInfo li = parseInsertLog(log);
    Page pg = null;
    try {
        pg = pc.getPage(li.pgno);
    } catch(Exception e) {
        Panic.panic(e);
    }
    try {
        if(flag == UNDO) {
            DataItem.setDataItemRawInvalid(li.raw);
        }
        PageX.recoverInsert(pg, li.raw, li.offset);
    } finally {
        pg.release();
    }
}
```

`doInsertLog()`での削除には、`DataItem.setDataItemRawInvalid(li.raw);`を使っています。DataItemは次の章で説明しますが、概ね、有効フラグを無効にすることで論理削除を行う処理です。
