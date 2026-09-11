---
authorship: human-only
title: "MYDB 5. The Page Index and the Data Manager"
description: "The page index is an important part of DM, optimizing insertions by caching the free space available on each page. It lets higher-level modules quickly locate a suitable page without a lengthy search, making data operations more efficient. Its implementation works closely with the DataItem abstraction to support efficient database operation."
date: 2021-12-11 15:16:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/22PSG1.webp"
seoDescription: "Complete MYDB’s data manager with a free-space page index, cached DataItems, logged updates, record insertion, startup recovery checks, and orderly shutdown."
---

The code in this chapter is in [backend/dm/pageIndex](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/pageIndex), [backend/dm/dataItem](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/dataItem), and [backend/dm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm).

### Introduction

This chapter wraps up DM with a simple page index and implements the abstraction DM provides to higher-level modules: DataItem.

### The Page Index

The page index caches the free space available on each page. When a higher-level module inserts data, it can quickly find a page with enough room without inspecting every page on disk or in the cache.

MYDB uses a fairly coarse algorithm: divide a page’s space into 40 buckets. At startup, scan all pages, find their free space, and assign them to these buckets. When insert requests a page, round the required space upward to a bucket. Any page taken from that bucket will have enough room.

PageIndex itself is simple: an array of Lists.

```java
public class PageIndex {
    // 将一页划成 40 个区间
    private static final int INTERVALS_NO = 40;
    private static final int THRESHOLD = PageCache.PAGE_SIZE / INTERVALS_NO;

    private List[] lists;
}
```

Retrieving a page from PageIndex is easy too. Calculate the bucket number and take a page from it:

```java
public PageInfo select(int spaceSize) {
    int number = spaceSize / THRESHOLD;
    if(number < INTERVALS_NO) number ++;
    while(number <= INTERVALS_NO) {
        if(lists[number].size() == 0) {
            number ++;
            continue;
        }
        return lists[number].remove(0);
    }
    return null;
}
```

The returned PageInfo contains the page number and the amount of free space.

Notice that a selected page is removed from PageIndex immediately. This means concurrent writes to the same page are not allowed. After a higher-level module finishes using a page, it needs to put it back into PageIndex:

```java
public void add(int pgno, int freeSpace) {
    int number = freeSpace / THRESHOLD;
    lists[number].add(new PageInfo(pgno, freeSpace));
}
```

When DataManager is created, it reads all pages to populate PageIndex:

```java
// 初始化 pageIndex
void fillPageIndex() {
    int pageNumber = pc.getPageNumber();
    for(int i = 2; i <= pageNumber; i ++) {
        Page pg = null;
        try {
            pg = pc.getPage(i);
        } catch (Exception e) {
            Panic.panic(e);
        }
        pIndex.add(pg.getPageNumber(), PageX.getFreeSpace(pg));
        pg.release();
    }
}
```

Remember to release each Page promptly after use, or you may exhaust the cache.

### DataItem

DataItem is the data abstraction DM provides to higher-level modules. A module requests a DataItem from DM by its address, then accesses the data inside it.

The DataItem implementation is simple:

```java
public class DataItemImpl implements DataItem {
    private SubArray raw;
    private byte[] oldRaw;
    private DataManagerImpl dm;
    private long uid;
    private Page pg;
}
```

It keeps a reference to dm because releasing a DataItem relies on dm’s release method—dm also implements the cache interface to cache DataItems—and because data changes need to be logged.

The data stored in a DataItem has the following structure:

```
[ValidFlag] [DataSize] [Data]
```

ValidFlag takes one byte and indicates whether the DataItem is valid. To delete a DataItem, simply set its validity flag to 0. DataSize takes two bytes and specifies the length of the following Data.

Once a higher-level module has a DataItem, it accesses the contents through `data()`. The returned array shares the underlying data rather than copying it, which is why we use SubArray.

```java
@Override
public SubArray data() {
    return new SubArray(raw.raw, raw.start+OF_DATA, raw.end);
}
```

A higher-level module must follow a specific sequence to modify a DataItem: call `before()` before making changes, `unBefore()` to cancel them, and `after()` once they are complete. This mainly preserves the before image and ensures prompt logging. DM guarantees that DataItem modifications are atomic.

```java
@Override
public void before() {
    wLock.lock();
    pg.setDirty(true);
    System.arraycopy(raw.raw, raw.start, oldRaw, 0, oldRaw.length);
}

@Override
public void unBefore() {
    System.arraycopy(oldRaw, 0, raw.raw, raw.start, oldRaw.length);
    wLock.unlock();
}

@Override
public void after(long xid) {
    dm.logDataItem(xid, this);
    wLock.unlock();
}
```

The `after()` method mainly calls a method in dm to log the update; there is no need to go into it further.

After using a DataItem, call release() promptly to release its cache reference. DM is responsible for caching DataItems.

```java
@Override
public void release() {
    dm.releaseDataItem(this);
}
```

### Implementing DM

DataManager is the class that exposes DM’s methods to the outside. It also acts as a cache of DataItem objects. A DataItem’s cache key is an 8-byte unsigned integer composed of a page number and an in-page offset, each taking four bytes.

For the DataItem cache’s `getForCache()`, extract the page number from the key, retrieve that page from pageCache, then parse the DataItem at the specified offset:

```java
@Override
protected DataItem getForCache(long uid) throws Exception {
    short offset = (short)(uid & ((1L << 16) - 1));
    uid >>>= 32;
    int pgno = (int)(uid & ((1L << 32) - 1));
    Page pg = pc.getPage(pgno);
    return DataItem.parseDataItem(pg, offset, this);
}
```

Releasing a cached DataItem requires writing it back to its backing store. Since file IO operates on whole pages, we only need to release the page containing the DataItem:

```java
@Override
protected void releaseForCache(DataItem di) {
    di.page().release();
}
```

Creating a DataManager from an existing file differs slightly from creating one from an empty file. Besides creating PageCache and Logger differently, an empty file needs its first page initialized. An existing file needs its first page checked to determine whether recovery is necessary. The random bytes on the first page must also be regenerated.

```java
public static DataManager create(String path, long mem, TransactionManager tm) {
    PageCache pc = PageCache.create(path, mem);
    Logger lg = Logger.create(path);
    DataManagerImpl dm = new DataManagerImpl(pc, lg, tm);
    dm.initPageOne();
    return dm;
}

public static DataManager open(String path, long mem, TransactionManager tm) {
    PageCache pc = PageCache.open(path, mem);
    Logger lg = Logger.open(path);
    DataManagerImpl dm = new DataManagerImpl(pc, lg, tm);
    if(!dm.loadCheckPageOne()) {
        Recover.recover(tm, lg, pc);
    }
    dm.fillPageIndex();
    PageOne.setVcOpen(dm.pageOne);
    dm.pc.flushPage(dm.pageOne);
    return dm;
}
```

Initializing and checking the first page mainly call methods on PageOne:

```java
// 在创建文件时初始化 PageOne
void initPageOne() {
    int pgno = pc.newPage(PageOne.InitRaw());
    assert pgno == 1;
    try {
        pageOne = pc.getPage(pgno);
    } catch (Exception e) {
        Panic.panic(e);
    }
    pc.flushPage(pageOne);
}

// 在打开已有文件时时读入 PageOne，并验证正确性
boolean loadCheckPageOne() {
    try {
        pageOne = pc.getPage(1);
    } catch (Exception e) {
        Panic.panic(e);
    }
    return PageOne.checkVc(pageOne);
}
```

DM provides three operations to higher-level modules: read, insert, and update. Updates happen through a DataItem that has been read, so DataManager only needs `read()` and `insert()` methods.

`read()` retrieves a DataItem from the cache by UID and checks its validity flag:

```java
@Override
public DataItem read(long uid) throws Exception {
    DataItemImpl di = (DataItemImpl)super.get(uid);
    if(!di.isValid()) {
        di.release();
        return null;
    }
    return di;
}
```

`insert()` asks pageIndex for the number of a page large enough to hold the new data. After retrieving that page, it first writes the insertion log. Only then can it insert data through pageX, which returns the offset of the inserted data. Finally, the page information must be returned to pageIndex.

```java
@Override
public long insert(long xid, byte[] data) throws Exception {
    byte[] raw = DataItem.wrapDataItemRaw(data);
    if(raw.length > PageX.MAX_FREE_SPACE) {
        throw Error.DataTooLargeException;
    }

    // 尝试获取可用页
    PageInfo pi = null;
    for(int i = 0; i < 5; i ++) {
        pi = pIndex.select(raw.length);
        if (pi != null) {
            break;
        } else {
            int newPgno = pc.newPage(PageX.initRaw());
            pIndex.add(newPgno, PageX.MAX_FREE_SPACE);
        }
    }
    if(pi == null) {
        throw Error.DatabaseBusyException;
    }

    Page pg = null;
    int freeSpace = 0;
    try {
        pg = pc.getPage(pi.pgno);
        // 首先做日志
        byte[] log = Recover.insertLog(xid, pg, raw);
        logger.log(log);
        // 再执行插入操作
        short offset = PageX.insert(pg, raw);

        pg.release();
        return Types.addressToUid(pi.pgno, offset);

    } finally {
        // 将取出的 pg 重新插入 pIndex
        if(pg != null) {
            pIndex.add(pi.pgno, PageX.getFreeSpace(pg));
        } else {
            pIndex.add(pi.pgno, freeSpace);
        }
    }
}
```

On a clean shutdown, DataManager closes its caches and log. Do not forget to set the verification bytes on the first page:

```java
@Override
public void close() {
    super.close();
    logger.close();

    PageOne.setVcClose(pageOne);
    pageOne.release();
    pc.close();
}
```

And that wraps up DM.

Today is December 11, 2021, the day of A-SOUL’s first-anniversary livestream. Happy first anniversary, A-SOUL! Here is to the second, the third, and the tenth! See you at Beijing’s Bird’s Nest stadium!!!

![](https://blog-img.774352199.xyz/2025/bee2e73291a2ecde2667bb41f2e2c5b6.jpg)

We are ASOUL!
