---
title: "MYDB 8. Index Management"
description: "MYDB implements a clustered index using a B+ tree. IM interacts directly with the Data Manager (DM), bypassing the Version Manager (VM), so index data is written directly to the database file. This chapter details the binary-tree index structure and its basic node fields, including the leaf flag, key count, and sibling identifier, establishing the framework for indexed lookups."
date: 2021-12-24 21:01:00
categories: [projects]
tags: ["java", "mydb"]
---

All the code in this chapter is in [backend/im](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/im).

### Introduction

IM, the Index Manager, provides MYDB with a B+ tree-based clustered index. MYDB currently supports only indexed lookups, not full table scans. If you are interested, feel free to implement those yourself.

As the dependency graph shows, IM builds directly on DM, without going through VM. Index data is inserted straight into the database file and does not need version management.

This chapter focuses on the implementation rather than explaining the B+ tree algorithm in detail.

### The Binary-Tree Index

The binary tree consists of Nodes, each stored in a DataItem with this structure:

```
[LeafFlag][KeyNumber][SiblingUid]
[Son0][Key0][Son1][Key1]...[SonN][KeyN]
```

LeafFlag indicates whether this is a leaf node, KeyNumber is the number of keys in the node, and SiblingUid is the UID of its sibling in DM. These are followed by interleaved child nodes (SonN) and keys (KeyN). The final KeyN is always MAX_VALUE to simplify searching.

Node holds references to its B+ tree, DataItem, and SubArray, making it easy to modify and release the data quickly.

```java
public class Node {
    BPlusTree tree;
    DataItem dataItem;
    SubArray raw;
    long uid;
    ...
}
```

We can generate the data for a root node like this:

```java
static byte[] newRootRaw(long left, long right, long key)  {
    SubArray raw = new SubArray(new byte[NODE_SIZE], 0, NODE_SIZE);
    setRawIsLeaf(raw, false);
    setRawNoKeys(raw, 2);
    setRawSibling(raw, 0);
    setRawKthSon(raw, left, 0);
    setRawKthKey(raw, key, 0);
    setRawKthSon(raw, right, 1);
    setRawKthKey(raw, Long.MAX_VALUE, 1);
    return raw.raw;
}
```

Its initial children are left and right, and its initial key is key.

Similarly, we can generate an empty root node:

```java
static byte[] newNilRootRaw()  {
    SubArray raw = new SubArray(new byte[NODE_SIZE], 0, NODE_SIZE);
    setRawIsLeaf(raw, true);
    setRawNoKeys(raw, 0);
    setRawSibling(raw, 0);
    return raw.raw;
}
```

Node has two helper methods for B+ tree insertion and search: searchNext and leafSearchRange.

searchNext finds the UID corresponding to a key. If it cannot find one, it returns the sibling node’s UID.

```java
public SearchNextRes searchNext(long key) {
    dataItem.rLock();
    try {
        SearchNextRes res = new SearchNextRes();
        int noKeys = getRawNoKeys(raw);
        for(int i = 0; i < noKeys; i ++) {
            long ik = getRawKthKey(raw, i);
            if(key < ik) {
                res.uid = getRawKthSon(raw, i);
                res.siblingUid = 0;
                return res;
            }
        }
        res.uid = 0;
        res.siblingUid = getRawSibling(raw);
        return res;
    } finally {
        dataItem.rUnLock();
    }
}
```

leafSearchRange searches the current node over the range [leftKey, rightKey]. By convention, if rightKey is greater than or equal to the largest key in the node, it also returns the sibling’s UID so the search can continue in the next node.

```java
public LeafSearchRangeRes leafSearchRange(long leftKey, long rightKey) {
    dataItem.rLock();
    try {
        int noKeys = getRawNoKeys(raw);
        int kth = 0;
        while(kth < noKeys) {
            long ik = getRawKthKey(raw, kth);
            if(ik >= leftKey) {
                break;
            }
            kth ++;
        }
        List<Long> uids = new ArrayList<>();
        while(kth < noKeys) {
            long ik = getRawKthKey(raw, kth);
            if(ik <= rightKey) {
                uids.add(getRawKthSon(raw, kth));
                kth ++;
            } else {
                break;
            }
        }
        long siblingUid = 0;
        if(kth == noKeys) {
            siblingUid = getRawSibling(raw);
        }
        LeafSearchRangeRes res = new LeafSearchRangeRes();
        res.uids = uids;
        res.siblingUid = siblingUid;
        return res;
    } finally {
        dataItem.rUnLock();
    }
}
```

A B+ tree adjusts dynamically during insertions and deletions, so its root is not fixed. We therefore use a bootDataItem to store the root node’s UID. Notice that every transaction IM uses when operating on DM is SUPER_XID.

```java
public class BPlusTree {
    DataItem bootDataItem;

    private long rootUid() {
        bootLock.lock();
        try {
            SubArray sa = bootDataItem.data();
            return Parser.parseLong(Arrays.copyOfRange(sa.raw, sa.start, sa.start+8));
        } finally {
            bootLock.unlock();
        }
    }

    private void updateRootUid(long left, long right, long rightKey) throws Exception {
        bootLock.lock();
        try {
            byte[] rootRaw = Node.newRootRaw(left, right, rightKey);
            long newRootUid = dm.insert(TransactionManagerImpl.SUPER_XID, rootRaw);
            bootDataItem.before();
            SubArray diRaw = bootDataItem.data();
            System.arraycopy(Parser.long2Byte(newRootUid), 0, diRaw.raw, diRaw.start, 8);
            bootDataItem.after(TransactionManagerImpl.SUPER_XID);
        } finally {
            bootLock.unlock();
        }
    }
}
```

IM mainly offers two capabilities to higher-level modules: inserting index entries and searching nodes. I will not go into the algorithms or implementations of B+ tree insertion and search here.

You may wonder why IM does not provide index deletion. When a higher-level module deletes an Entry through VM, it actually sets XMAX. Even if the corresponding index entry remains, a later read can find the Entry through the index but, because XMAX is set, no suitable version is available. The read therefore returns a not-found error.

### Possible Errors and Recovery

Two kinds of errors can occur during B+ tree operations: errors within a node and errors in the relationships between nodes.

An error within a node occurs when MYDB crashes while Ti is modifying the node’s data. Because IM depends on DM, Ti will be undone when the database restarts, removing the erroneous effects on the node.

An error between nodes must have this form: an insertion into node u creates a new node v, and sibling(u)=v, but v has not yet been inserted into the parent.

```
[parent]
    
    v
   [u] -> [v]
```

The correct state should look like this:

```
[ parent ]
       
 v      v
[u] -> [v]
```

In this situation, an insertion or search that fails at a node continues through its siblings and can still find v eventually. The only drawback is that v cannot be reached directly from its parent; it must be reached indirectly through u.

Today is December 25, Christmas Day. Happy Xmas!
