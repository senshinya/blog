---
authorship: human-only
title: "MYDB 1. Starting with the Transaction Manager"
description: "MYDB manages transactions through an XID file. Each transaction has a unique XID, incrementing from 1; XID 0 denotes a super transaction whose state is always committed. TransactionManager maintains this file and records three states: active, committed, and aborted. This mechanism supports accurate transaction state queries and management, providing a foundation for system stability and reliability."
date: 2021-11-28 16:10:00
categories: [projects]
tags: ["java", "mydb"]
---

All the code in this chapter is in [backend/tm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/tm).

As described in Chapter 0:

> TM maintains transaction states in an XID file and exposes interfaces that other modules use to query a transaction’s state.

### The XID File

First, let us define the rules.

Every transaction in MYDB has an XID that uniquely identifies it. XIDs start at 1 and increase, with no duplicates. XID 0 is reserved for a Super Transaction. An operation that needs to run without explicitly starting a transaction can use XID 0. The transaction with XID 0 is always committed.

TransactionManager maintains a file in the XID format to record each transaction’s state. In MYDB, a transaction has one of three states:

1.  active: still in progress, not yet finished
2.  committed: committed
3.  aborted: canceled (rolled back)

The XID file allocates one byte per transaction to store its state. The file header also contains an 8-byte number recording how many transactions the file manages. Transaction xid’s state is therefore stored at byte offset (xid-1)+8. We subtract 1 because xid 0 (the Super XID) does not need its state recorded.

TransactionManager exposes interfaces for other modules to create transactions and query their states. Specifically:

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

### Implementation

The rules are simple; now we just need to code them. First, define the necessary constants:

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

All file reads and writes use NIO’s FileChannel. This differs somewhat from traditional IO’s Input/Output Streams, mainly in the API; you just need to get familiar with it.

After constructing a TransactionManager, we first validate the XID file. The check is simple: use the 8-byte number in its header to calculate the expected file length and compare it with the actual length. If they differ, the file is invalid.

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

If validation fails, the panic method forcibly shuts the process down. Errors in some foundational modules are handled this way too: an unrecoverable error leaves us no choice but to stop.

First, a small helper finds the file offset of an xid’s state:

```java
// 根据事务 xid 取得其在 xid 文件中对应的位置
private long getXidPosition(long xid) {
    return LEN_XID_HEADER_LENGTH + (xid-1)*XID_FIELD_SIZE;
}
```

The `begin()` method starts a transaction: it sets transaction xidCounter+1 to active, then increments xidCounter and updates the file header.

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

Every file operation here must immediately be flushed to the file to prevent data loss in a crash. FileChannel’s `force()` forces cached contents to be synchronized to the file, much like BIO’s `flush()`. Its boolean argument specifies whether to synchronize file metadata too, such as the last-modified time.

The `commit()` and `abort()` methods can use `updateXID()` directly.

Similarly, `isActive()`, `isCommitted()`, and `isAborted()` all check an xid’s state, so one common helper can handle them:

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

Of course, remember to handle SUPER_XID separately before checking.

There are also two static methods: `create()` creates an xid file and a TM, while `open()` creates a TM from an existing xid file. When creating an XID file from scratch, write an empty header by setting xidCounter to 0; otherwise it will fail validation later:

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

And that is TM done. Does not look too hard, does it? （￣ c￣）y-～

Just wait: the really difficult part, DM, is still ahead. That will take more than one chapter~
