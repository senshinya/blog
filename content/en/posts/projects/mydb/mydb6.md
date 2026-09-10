---
title: "MYDB 6. Record Versions and Transaction Isolation"
description: "VM uses two-phase locking to ensure serializable schedules and introduces multiversion concurrency control (MVCC) to eliminate blocking between reads and writes. This chapter also defines conflicts between database operations, focusing on the interaction between updates and reads as a foundation for understanding transaction isolation levels."
date: 2021-12-18 14:58:00
categories: [projects]
tags: ["java", "mydb"]
---

All the code in this chapter is in [backend/vm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/vm).

### Introduction

In this chapter, we start discussing the Version Manager.

> VM uses two-phase locking (2PL) to make schedules serializable and implements MVCC to eliminate blocking between reads and writes. It also implements two isolation levels.

Just as the Data Manager is the core of MYDB’s data management, the Version Manager is the core of its transaction and data version management.

### 2PL and MVCC

#### Conflicts and 2PL

First, let us define a database conflict. Ignore inserts for now and consider only updates (U) and reads (R). Two operations conflict if all three conditions hold:

1.  They are performed by different transactions.
2.  They operate on the same data item.
3.  At least one is an update.

That leaves only two kinds of conflict over the same data:

1.  U operations from two different transactions conflict.
2.  A U and an R from two different transactions conflict.

Why does it matter whether operations conflict? Because **swapping the order of two non-conflicting operations does not affect the final result**, whereas swapping conflicting operations does.

Set conflicts aside for a moment. Remember the example in Chapter 4, where two concurrent transactions operate on x? Suppose x initially equals 0:

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

The final value of x is 1, clearly not the result we expect.

One of VM’s most important jobs is ensuring that schedules are serializable. MYDB uses two-phase locking (2PL) for this. If transaction i has locked x and transaction j wants to perform an operation on x that conflicts with i’s earlier operation, j blocks. For example, if T1 has locked x for U1(x), both reads and writes of x by T2 will block. T2 must wait for T1 to release the lock on x.

So 2PL does guarantee serializable schedules, but it inevitably makes transactions block one another and can even cause deadlocks. To improve transaction throughput and reduce the chance of blocking, MYDB implements MVCC.

#### MVCC

Before introducing MVCC, let us clarify what records and versions mean.

DM exposes Data Items to higher-level modules. VM manages those Data Items and exposes records, or Entries. A record is the smallest unit of data a higher-level module can operate on through VM. Internally, VM maintains multiple Versions of each record. Whenever a higher-level module changes a record, VM creates a new version of it.

MVCC reduces the probability of transactions blocking in MYDB. Suppose T1 wants to update record X. It first acquires the lock on X, then updates it by creating a new version, say x3. Before T1 releases the lock, T2 wants to read X. Instead of blocking, MYDB returns an older version, such as x2. The result is equivalent to T2 running before T1, so the schedule remains serializable. If X has no older version, T2 has to wait for T1 to release the lock. That is why it only reduces the probability of blocking.

Recall that in Chapter 4, recoverability required the operation sequences passed from VM to DM to satisfy two rules:

> Rule 1: An ongoing transaction must not read data produced by any other uncommitted transaction.  
> Rule 2: An ongoing transaction must not modify data modified or produced by any other uncommitted transaction.

With 2PL and MVCC, we can see that both conditions are easily satisfied.

### Implementing Records

MYDB uses Entry to represent a record’s structure. Although MVCC conceptually provides multiple versions, VM does not implement an Update operation. Field updates are handled by the Table Manager (TBM), which we will cover later. Thus, in VM’s actual implementation, a record has only one version.

Each record is stored in a Data Item, so Entry only needs to hold a DataItem reference:

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

We define the data format inside an Entry as follows:

```
[XMIN] [XMAX] [DATA]
```

XMIN is the ID of the transaction that created this record (version), and XMAX is the ID of the transaction that deleted it. We will explain their roles in the next section. DATA is the record’s actual data. Based on this structure, `wrapEntryRaw()`, called when creating a record, looks like this:

```java
public static byte[] wrapEntryRaw(long xid, byte[] data) {
    byte[] xmin = Parser.long2Byte(xid);
    byte[] xmax = new byte[8];
    return Bytes.concat(xmin, xmax, data);
}
```

To retrieve the record’s data, we likewise parse this structure:

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

We return a copy of the data here. To modify it, we must first call the DataItem’s `before()` method, as shown when setting XMAX:

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

`before()` and `after()` follow the data modification rules established in the DataItem chapter.

### Transaction Isolation Levels

#### Read Committed

As noted above, if the newest version of a record is locked, MYDB returns an older version when another transaction wants to modify or read that record. We can say the latest, locked version is invisible to the other transaction. This gives us the concept of version visibility.

Version visibility depends on the transaction’s isolation level. The lowest isolation level MYDB supports is read committed: transactions may read only data produced by committed transactions. Chapter 4 explained why we require at least read committed: it prevents cascading rollbacks from conflicting with commit semantics.

To implement read committed, MYDB maintains the two variables introduced above for each version:

- XMIN: the ID of the transaction that created the version
- XMAX: the ID of the transaction that deleted the version

XMIN is filled in when the version is created. XMAX is filled in when the version is deleted or a new version appears.

XMAX also explains why DM has no delete operation. To delete a version, we only need to set its XMAX. The version then becomes invisible to every transaction after XMAX, which is equivalent to deleting it.

Under read committed, version visibility is determined as follows:

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

If the condition is true, the version is visible to Ti. To find a suitable version for Ti, start from the newest version and check visibility backward, returning the first visible one.

The following method determines whether a record is visible to transaction t:

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

The Transaction structure here provides only an XID.

#### Repeatable Read

You probably know the problems with read committed from all those interview questions: non-repeatable reads and phantom reads. Here, we will solve non-repeatable reads.

A non-repeatable read means a transaction can read the same data item more than once during its execution and get different results. For example, suppose X initially equals 0:

```
T1 begin
R1(X) // T1 读得 0
T2 begin
U2(X) // 将 X 修改为 1
T2 commit
R1(X) // T1 读的 1
```

T1 reads X twice and gets different values. To avoid this, we need a stricter isolation level: repeatable read.

The problem arises because T1’s second read sees the value changed by T2, which has since committed. We can therefore impose this rule:

> A transaction may read only data versions produced by transactions that had already finished when it began.

This adds the requirement that a transaction ignore:

1.  Data from transactions that began after it.
2.  Data from transactions that were still active when it began.

For the first, simply compare transaction IDs. For the second, when Ti begins, record all currently active transactions as SP(Ti). If a record version’s XMIN is in SP(Ti), that version must also be invisible to Ti.

The repeatable-read visibility logic is therefore:

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

We need a structure representing a transaction to store this snapshot:

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

The constructor’s active argument contains all currently active transactions. Visibility under repeatable read is then checked as follows:

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
