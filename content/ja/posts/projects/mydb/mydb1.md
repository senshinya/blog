---
authorship: human-only
title: "MYDB 1. まずはシンプルなTMから"
description: "MYDBではXIDファイルでトランザクションを管理します。各トランザクションには1から増える一意のXIDがあり、XID 0は常にコミット済みのスーパートランザクションです。TransactionManagerがこのファイルを管理し、実行中・コミット済み・中止済みという3つの状態を記録します。この仕組みにより状態を正確に照会・管理でき、システムの安定性と信頼性を支えます。"
date: 2021-11-28 16:10:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/H4zZAK.webp"
seoDescription: "MYDBのTMをJavaで実装。XIDファイルに実行中・コミット済み・中止済みの状態を記録し、ID発行、ファイル検証、状態照会、FileChannelによる書き込みを説明します。"
---

この章で扱うコードはすべて[backend/tm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/tm)にあります。

第0章で説明したとおりです。

> TMはXIDファイルでトランザクションの状態を管理し、ほかのモジュールが状態を問い合わせるためのインターフェースを提供します。

### XIDファイル

まずはルールを決めていきます。

MYDBの各トランザクションには、それを一意に識別するXIDがあります。XIDは1から始まり、重複せずに増えていきます。また、XID 0は特別にスーパートランザクション（Super Transaction）と定めます。明示的にトランザクションを開始せずに操作したい場合は、その操作のXIDを0にできます。XID 0のトランザクションは、常にcommitted状態です。

TransactionManagerはXID形式のファイルを管理し、各トランザクションの状態を記録します。MYDBでは、次の3つの状態があります。

1.  active：実行中で、まだ終了していない状態
2.  committed：コミット済みの状態
3.  aborted：取り消された（ロールバック済みの）状態

XIDファイルでは、各トランザクションに1バイトを割り当てて状態を保存します。また、ファイルの先頭には、このファイルが管理するトランザクション数を8バイトの数値として保存します。そのため、トランザクションxidの状態はバイトオフセット(xid-1)+8の位置に格納されます。1を引くのは、xid 0（Super XID）の状態を記録する必要がないためです。

TransactionManagerは、ほかのモジュールがトランザクションを作成したり状態を照会したりするためのインターフェースを提供します。具体的には次のとおりです。

```java
public interface TransactionManager {
    long begin();                       // 开启一个新事务
    void commit(long xid);              // 提交一个事务
    void abort(long xid);               // 取消一个事务
    boolean isActive(long xid);         // 查询一个事务的状态是否是正在进行的状态
    boolean isCommitted(long xid);      // 查询一个事务的状态是否是已提交
    boolean isAborted(long xid);        // 查询一个事务的状态是否是已取消
    void close();                       // 关闭 TM
}
```

### 実装

ルールは単純なので、あとはコードにするだけです。まず必要な定数を定義します。

```java
// XID 文件头长度
static final int LEN_XID_HEADER_LENGTH = 8;
// 每个事务的占用长度
private static final int XID_FIELD_SIZE = 1;
// 事务的三种状态
private static final byte FIELD_TRAN_ACTIVE   = 0;
private static final byte FIELD_TRAN_COMMITTED = 1;
private static final byte FIELD_TRAN_ABORTED  = 2;
// 超级事务，永远为 commited 状态
public static final long SUPER_XID = 0;
// XID 文件后缀
static final String XID_SUFFIX = ".xid";
```

ファイルの読み書きには、すべてNIOのFileChannelを使います。従来のIOのInput/Output Streamとは少し違いますが、主にインターフェースの違いなので、使い方に慣れれば大丈夫です。

コンストラクターでTransactionManagerを作成したら、まずXIDファイルが正しいか検証します。ヘッダーの8バイトの数値から本来のファイル長を計算し、実際の長さと比較します。一致しなければ不正なXIDファイルと判断します。

```java
private void checkXIDCounter() {
    long fileLen = 0;
    try {
        fileLen = file.length();
    } catch (IOException e1) {
        Panic.panic(Error.BadXIDFileException);
    }
    if(fileLen < LEN_XID_HEADER_LENGTH) {
        Panic.panic(Error.BadXIDFileException);
    }

    ByteBuffer buf = ByteBuffer.allocate(LEN_XID_HEADER_LENGTH);
    try {
        fc.position(0);
        fc.read(buf);
    } catch (IOException e) {
        Panic.panic(e);
    }
    this.xidCounter = Parser.parseLong(buf.array());
    long end = getXidPosition(this.xidCounter + 1);
    if(end != fileLen) {
        Panic.panic(Error.BadXIDFileException);
    }
}
```

検証に通らなければ、panicメソッドで強制停止します。一部の基盤モジュールでエラーが発生した場合も同様です。復旧できないエラーでは、停止するしかありません。

まず、xidの状態のファイル内オフセットを求める小さなメソッドを用意します。

```java
// 根据事务 xid 取得其在 xid 文件中对应的位置
private long getXidPosition(long xid) {
    return LEN_XID_HEADER_LENGTH + (xid-1)*XID_FIELD_SIZE;
}
```

`begin()`はトランザクションを開始します。まずxidCounter+1のトランザクションをactiveにし、その後xidCounterを増やしてファイルヘッダーを更新します。

```java
// 开始一个事务，并返回 XID
public long begin() {
    counterLock.lock();
    try {
        long xid = xidCounter + 1;
        updateXID(xid, FIELD_TRAN_ACTIVE);
        incrXIDCounter();
        return xid;
    } finally {
        counterLock.unlock();
    }
}

// 更新 xid 事务的状态为 status
private void updateXID(long xid, byte status) {
    long offset = getXidPosition(xid);
    byte[] tmp = new byte[XID_FIELD_SIZE];
    tmp[0] = status;
    ByteBuffer buf = ByteBuffer.wrap(tmp);
    try {
        fc.position(offset);
        fc.write(buf);
    } catch (IOException e) {
        Panic.panic(e);
    }
    try {
        fc.force(false);
    } catch (IOException e) {
        Panic.panic(e);
    }
}

// 将 XID 加一，并更新 XID Header
private void incrXIDCounter() {
    xidCounter ++;
    ByteBuffer buf = ByteBuffer.wrap(Parser.long2Byte(xidCounter));
    try {
        fc.position(0);
        fc.write(buf);
    } catch (IOException e) {
        Panic.panic(e);
    }
    try {
        fc.force(false);
    } catch (IOException e) {
        Panic.panic(e);
    }
}
```

ここでのファイル操作はすべて、実行直後にファイルへ書き出す必要があります。クラッシュによるデータ消失を防ぐためです。FileChannelの`force()`はキャッシュの内容をファイルへ強制的に同期し、BIOの`flush()`に似ています。引数の真偽値は、最終更新日時などのメタデータも同期するかどうかを指定します。

`commit()`と`abort()`は、`updateXID()`を使えばそのまま実装できます。

同様に、`isActive()`、`isCommitted()`、`isAborted()`はいずれもxidの状態を確認するので、共通のメソッドにまとめられます。

```java
// 检测 XID 事务是否处于 status 状态
private boolean checkXID(long xid, byte status) {
    long offset = getXidPosition(xid);
    ByteBuffer buf = ByteBuffer.wrap(new byte[XID_FIELD_SIZE]);
    try {
        fc.position(offset);
        fc.read(buf);
    } catch (IOException e) {
        Panic.panic(e);
    }
    return buf.array()[0] == status;
}
```

もちろん、確認する前にSUPER_XIDを別扱いにするのを忘れないでください。

このほかに静的メソッドの`create()`と`open()`があります。前者はxidファイルを新規作成してTMを作り、後者は既存のxidファイルからTMを作ります。一からXIDファイルを作るときは、xidCounterを0にした空のヘッダーを書き込む必要があります。そうしないと後の検証で不正と判断されます。

```java
public static TransactionManagerImpl create(String path) {
    ...
    // 写空 XID 文件头
    ByteBuffer buf = ByteBuffer.wrap(new byte[TransactionManagerImpl.LEN_XID_HEADER_LENGTH]);
    try {
        fc.position(0);
        fc.write(buf);
    } catch (IOException e) {
        Panic.panic(e);
    }
    ...
}
```

これでTMはおしまいです。なんだか簡単そうですね（￣ c￣）y-～

でも、まだ油断は禁物。本当に難しいDMはこの先です。こちらは1章では説明しきれませんよ〜。
