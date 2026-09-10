---
title: "MYDB 7. Deadlock Detection and the Version Manager"
description: "VM must handle version skipping introduced by MVCC as well as deadlocks. By simply marking a transaction, MYDB can cancel or roll it back and keep data from aborted transactions from affecting others. This design makes concurrent transaction handling more efficient and reliable, avoids the deadlock risks common with traditional 2PL, and improves overall stability and performance."
date: 2021-12-23 21:20:00
categories: [projects]
tags: ["java", "mydb"]
---

All the code in this chapter is in [backend/vm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/vm).

### Introduction

This chapter finishes VM. We will look at the version-skipping problem MVCC can introduce, how MYDB avoids deadlocks caused by 2PL, and how everything comes together in the Version Manager.

### The Version-Skipping Problem

Before discussing version skipping, a quick aside: MVCC makes canceling or rolling back transactions very easy in MYDB. We only need to mark the transaction as aborted. Under the visibility rules from the previous chapter, a transaction can see data from other transactions only if they have committed. Data produced by an aborted transaction therefore has no effect on other transactions. It is as though that transaction never existed.

For version skipping, consider the following scenario. X initially has only version x0, and T1 and T2 both use repeatable read:

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

This runs without a problem, but the logic is not quite right. T1 updates X from x0 to x1, which is fine. T2, however, updates X from x0 to x2, skipping x1.

Read committed allows version skipping; repeatable read does not. The solution is straightforward: if Ti needs to modify X, but X has already been modified by a transaction Tj invisible to Ti, require Ti to roll back.

The previous chapter identified two cases in which Tj is invisible to Ti:

1.  XID(Tj) > XID(Ti)
2.  Tj in SP(Ti)

Checking for version skipping is therefore simple: get the newest committed version of X and check whether its creator is visible to the current transaction:

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

### Deadlock Detection

As discussed previously, 2PL blocks a transaction until the thread holding the lock releases it. We can represent this waiting relationship as a directed edge: Tj waiting for Ti becomes Tj --> Ti. Together, these edges form a graph, which need not be connected. Detecting a deadlock then amounts to checking whether the graph contains a cycle.

MYDB uses a LockTable object to maintain this graph in memory, with the following structures:

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

Whenever a transaction needs to wait, we try adding an edge and check for deadlocks. If one is detected, we remove and reject the edge and abort the transaction.

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

If add determines that waiting is necessary, it returns a locked Lock object. The caller then attempts to acquire that lock, thereby blocking the thread. For example:

```java
Lock l = lt.add(xid, uid);
if(l != null) {
    l.lock();   // 阻塞在这一步
    l.unlock();
}
```

Cycle detection is a simple depth-first search, with the caveat that the graph may be disconnected. Give each node a visitation stamp initialized to -1. Then traverse all nodes, starting a DFS at each node whose stamp is not -1. All nodes encountered in one connected graph receive the same number, with different numbers for different graphs. Encountering a previously visited node while traversing a graph indicates a cycle.

The implementation is simple:

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

When a transaction commits or aborts, it can release all its locks and remove itself from the wait-for graph.

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

The while loop releases the locks on every resource held by this thread, allowing waiting threads to acquire them:

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

We try releasing waiters from the beginning of the List, so this is even a fair lock. Simply unlock the Lock object; the application thread can then acquire it and continue.

### Implementing VM

VM exposes its functionality to higher-level modules through the VersionManager interface:

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

Its implementation also serves as an Entry cache, extending `AbstractCache<Entry>`. The methods for loading and releasing cache entries are simple:

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

`begin()` starts a transaction, initializes its structure, and stores it in activeTransaction for checks and snapshots:

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

`commit()` commits a transaction, mainly freeing the relevant structures, releasing its locks, and updating its state in TM:

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

There are two ways to abort a transaction: manually and automatically. A manual abort calls abort(). An automatic abort rolls the transaction back when a deadlock is detected or when version skipping occurs:

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

`read()` reads an entry. We just need to remember the visibility check:

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

`insert()` wraps the data in an Entry and hands it straight to DM for insertion:

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

`delete()` looks a little more complicated:

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

Most of it is actually three preliminary steps: checking visibility, acquiring the resource lock, and checking for version skipping. The deletion itself only sets XMAX.

Today is December 24, 2021. Christmas Eve.

> May your future be bright  
> May you and the one you love be together at last  
> May you find happiness in this earthly world  
> I wish only to face the sea, with spring warmth and flowers in bloom
