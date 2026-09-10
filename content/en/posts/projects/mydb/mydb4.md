---
authorship: human-only
title: "MYDB 4. Log Files and Recovery Strategies"
description: "Log files are essential to MYDB’s design, allowing data to be recovered after a crash. DM logs every operation on underlying data, forming a continuous sequence of records. Stored in a specific binary format with checksums and individual operation records, these logs let the database accurately reconstruct its data on restart and maintain consistency and integrity."
date: 2021-12-08 22:55:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/TRcbsj.webp"
---

The code in this chapter is in [backend/dm/logger](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/logger) and [backend/dm/Recover.java](https://github.com/CN-GuoZiyang/MYDB/blob/master/src/main/java/top/guoziyang/mydb/backend/dm/Recover.java).

### Introduction

MYDB supports data recovery after a crash. Whenever DM operates on the underlying data, it writes a log record to disk. When the database restarts after a crash, these logs can restore the data file and ensure its consistency.

### Reading and Writing Logs

The binary log file has the following layout:

```
[XChecksum][Log1][Log2][Log3]...[LogN][BadTail]
```

XChecksum is a four-byte integer containing a checksum calculated over all subsequent logs. Log1 through LogN are regular log records. BadTail is log data that could not be fully written before the crash; it may or may not be present.

Each log record has this format:

```
[Size][Checksum][Data]
```

Size is a four-byte integer giving the number of bytes in Data. Checksum is the checksum for this individual record.

The checksum for a log record is calculated using a particular seed:

```java
private int calChecksum(int xCheck, byte[] log) {
    for (byte b : log) {
        xCheck = xCheck * SEED + b;
    }
    return xCheck;
}
```

Calculating checksums for all records and accumulating them gives us the checksum of the log file.

Logger follows the iterator pattern. Repeated calls to `next()` read the next record from the file, extract its Data, and return it. `next()` mainly relies on `internNext()`, shown below. position is the current read offset in the log file:

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

When opening a log file, first validate its XChecksum and remove any BadTail at the end. Since the BadTail record was not fully written, the file checksum does not include its checksum. Removing BadTail therefore ensures the log file is consistent.

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

To write a log record, first wrap the data in the log format, write it to the file, and then update the file checksum. Updating the checksum also flushes the buffer to ensure the contents reach disk.

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

### Recovery Strategy

The recovery strategy comes from NYADB2. It is quite a brain teaser, at least to me.

DM provides two operations to higher-level modules: inserting new data (I) and updating existing data (U). Why no delete operation? We will get to that in the VM chapters.

DM’s logging policy is simple enough to state in one sentence:

> Before an I or U operation, write its corresponding log record and ensure it reaches disk; only then perform the data operation.

This policy gives DM more flexibility about when to synchronize data operations to disk. The log is guaranteed to reach disk before the data operation. Even if the database crashes before that operation is flushed, the data can still be recovered from the on-disk log.

DM records the two kinds of data operation as follows:

- (Ti, I, A, x): transaction Ti inserts data x at location A
- (Ti, U, A, oldx, newx): transaction Ti updates the data at location A from oldx to newx

First, ignore concurrency: only one transaction can operate on the database at a time. The log will look something like this:

```
(Ti, x, x), ..., (Ti, x, x), (Tj, x, x), ..., (Tj, x, x), (Tk, x, x), ..., (Tk, x, x)
```

#### Single-Threaded Execution

With a single thread, the logs of Ti, Tj, and Tk never interleave. Recovery is easy in this case. Suppose the last transaction in the log is Ti:

1.  Redo the logs of all transactions before Ti.
2.  Check Ti’s state in the XID file. If Ti has finished, whether committed or aborted, redo it. Otherwise, undo it.

Here is how to redo a transaction T:

1.  Scan all of T’s log records in forward order.
2.  For an insertion (Ti, I, A, x), insert x at A again.
3.  For an update (Ti, U, A, oldx, newx), set the value at A to newx.

Undo is straightforward too:

1.  Scan all of T’s log records in reverse order.
2.  For an insertion (Ti, I, A, x), delete the data at A.
3.  For an update (Ti, U, A, oldx, newx), set the value at A to oldx.

Note that MYDB does not actually have a physical delete operation. Undoing an insertion only sets its flag to invalid. We will discuss deletion in the VM chapters.

#### Multithreaded Execution

The procedure above guarantees recoverability for single-threaded MYDB. What about multiple threads? Let us consider two cases.

The first case:

```
T1 begin
T2 begin
T2 U(x)
T1 R(x)
...
T1 commit
MYDB break down
```

At the crash, T2 is still active. When the database restarts and runs recovery, T2 is undone and its effects are removed. But T1 read a value updated by T2, so undoing T2 means T1 should be undone too. This is a cascading rollback. However, T1 has already committed, and the effects of every committed transaction must be durable. We have a contradiction. We therefore need this guarantee:

> Rule 1: An ongoing transaction must not read data produced by any other uncommitted transaction.

For the second case, suppose x initially equals 0:

```
T1 begin
T2 begin
T1 set x = x+1 // 产生的日志为 (T1, U, A, 0, 1)
T2 set x = x+1 // 产生的日志为 (T1, U, A, 1, 2)
T2 commit
MYDB break down
```

At the crash, T1 is still active. On restart, recovery undoes T1 and redoes T2. Regardless of which happens first, however, x ends up as either 0 or 2. Both are wrong.

> Ultimately, this happens because our logs are too simple: they record only a “before image” and an “after image,” using the former for undo and the latter for redo. This simple logging and recovery scheme cannot capture the semantics of every possible database operation.

There are two solutions:

1.  Add more types of log records.
2.  Restrict database operations.

MYDB chooses to restrict database operations, with this guarantee:

> Rule 2: An ongoing transaction must not modify data modified or produced by any other uncommitted transaction.

In MYDB, VM ensures that the operation sequences actually passed down to DM satisfy both rules. How it does so will be explained in the VM chapters—there is quite a lot waiting for us there. With these rules, recovery under concurrency becomes simple:

1.  Redo all transactions that had finished at the time of the crash, whether committed or aborted.
2.  Undo all transactions that were unfinished (active) at the time of the crash.

After recovery, the database is in a state where all finished transactions have completed and all unfinished transactions have yet to begin.

#### Implementation

First, define the formats of the two log types:

```java
private static final byte LOG_TYPE_INSERT = 0;
private static final byte LOG_TYPE_UPDATE = 1;

// updateLog:
// [LogType] [XID] [UID] [OldRaw] [NewRaw]

// insertLog:
// [LogType] [XID] [Pgno] [Offset] [Raw]
```

As described above, the recovery routine has two main steps: redo all finished transactions and undo all unfinished ones:

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

For each of updateLog and insertLog, redo and undo are combined into one method:

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

Notice that deletion in `doInsertLog()` uses `DataItem.setDataItemRawInvalid(li.raw);`. We will explain DataItem in the next chapter. In essence, this marks the DataItem as invalid, performing a logical deletion.
