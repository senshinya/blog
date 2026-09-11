---
authorship: human-only
title: "MYDB 3. Caching and Managing Data Pages"
description: "DM abstracts the filesystem into pages and uses them as the unit of reading, writing, and caching. The default page size is 8K, with larger pages available to improve write performance under heavy loads. With the general-purpose cache framework already in place, we now define the page structure and implement efficient page caching."
date: 2021-12-05 15:28:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/jlFC4E.webp"
seoDescription: "Implement MYDB’s 8 KB page cache, dirty-page writeback, first-page shutdown checks, free-space offsets, and data insertion and recovery operations in Java."
---

The code in this chapter is in [backend/dm/pageCache](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/pageCache) and [backend/dm/page](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/page).

### Introduction

This chapter focuses on DM’s abstraction over the filesystem. DM views the filesystem as pages, and every filesystem read and write operates on a page at a time. Data read from the filesystem is cached in pages as well.

### The Page Cache

Following the design of most databases, we set the default data page size to 8K. You can increase it somewhat to improve performance when writing large amounts of data to the database.

In the previous chapter, we implemented a general-purpose cache framework, which we can reuse here to cache pages. First, though, we need to define the page structure. Note that this is a page stored in memory, distinct from the abstract page already persisted on disk.

We define a page as follows:

```java
public class PageImpl implements Page {
    private int pageNumber;
    private byte[] data;
    private boolean dirty;
    private Lock lock;

    private PageCache pc;
}
```

Here, pageNumber is the page’s number, **starting at 1**. data contains the page’s actual bytes. dirty indicates whether the page is dirty; dirty pages must be written back to disk when evicted from the cache. We also keep a reference to PageCache (not yet defined), making it easy to release the cached page whenever we have a Page reference.

The page cache interface is defined as follows:

```java
public interface PageCache {
    int newPage(byte[] initData);
    Page getPage(int pgno) throws Exception;
    void close();
    void release(Page page);

    void truncateByBgno(int maxPgno);
    int getPageNumber();
    void flushPage(Page pg);
}
```

The concrete page cache class extends the abstract cache framework and implements `getForCache()` and `releaseForCache()`. Since the backing store is the filesystem, `getForCache()` simply reads from the file and wraps the result in a Page:

```java
@Override
protected Page getForCache(long key) throws Exception {
    int pgno = (int)key;
    long offset = PageCacheImpl.pageOffset(pgno);

    ByteBuffer buf = ByteBuffer.allocate(PAGE_SIZE);
    fileLock.lock();
    try {
        fc.position(offset);
        fc.read(buf);
    } catch(IOException e) {
        Panic.panic(e);
    }
    fileLock.unlock();
    return new PageImpl(pgno, buf.array(), this);
}

private static long pageOffset(int pgno) {
    // 页号从 1 开始
    return (pgno-1) * PAGE_SIZE;
}
```

Likewise, when `releaseForCache()` evicts a page, it only needs to check whether it is dirty to decide whether to write it back to the filesystem:

```java
@Override
protected void releaseForCache(Page pg) {
    if(pg.isDirty()) {
        flush(pg);
        pg.setDirty(false);
    }
}

private void flush(Page pg) {
    int pgno = pg.getPageNumber();
    long offset = pageOffset(pgno);

    fileLock.lock();
    try {
        ByteBuffer buf = ByteBuffer.wrap(pg.getData());
        fc.position(offset);
        fc.write(buf);
        fc.force(false);
    } catch(IOException e) {
        Panic.panic(e);
    } finally {
        fileLock.unlock();
    }
}
```

PageCache also uses an AtomicInteger to track the number of pages in the open database file. This number is calculated when the file is opened and incremented when a page is created.

```java
public int newPage(byte[] initData) {
    int pgno = pageNumbers.incrementAndGet();
    Page pg = new PageImpl(pgno, initData, null);
    flush(pg);  // 新建的页面需要立刻写回
    return pgno;
}
```

One point to keep in mind: a single data record is not allowed to span pages. We will see this in later chapters. It means that an individual record cannot be larger than a database page.

### Managing Data Pages

#### The First Page

The first page of a database file typically has special uses, such as storing metadata for startup checks. MYDB uses it only for a startup check. Each time the database starts, it generates a sequence of random bytes and stores it at bytes 100–107. On a clean shutdown, this sequence is copied to bytes 108–115 of the first page.

At the next startup, the database compares these two byte sequences to determine whether the previous shutdown was clean. If not, it must run the data recovery procedure.

Set the initial bytes at startup:

```java
public static void setVcOpen(Page pg) {
    pg.setDirty(true);
    setVcOpen(pg.getData());
}

private static void setVcOpen(byte[] raw) {
    System.arraycopy(RandomUtil.randomBytes(LEN_VC), 0, raw, OF_VC, LEN_VC);
}
```

Copy the bytes at shutdown:

```java
public static void setVcClose(Page pg) {
    pg.setDirty(true);
    setVcClose(pg.getData());
}

private static void setVcClose(byte[] raw) {
    System.arraycopy(raw, OF_VC, raw, OF_VC+LEN_VC, LEN_VC);
}
```

Compare the bytes:

```java
public static boolean checkVc(Page pg) {
    return checkVc(pg.getData());
}

private static boolean checkVc(byte[] raw) {
    return Arrays.equals(Arrays.copyOfRange(raw, OF_VC, OF_VC+LEN_VC), Arrays.copyOfRange(raw, OF_VC+LEN_VC, OF_VC+2*LEN_VC));
}
```

It seems `Arrays.compare()` is the method incompatible with JDK8. You can replace it with an equivalent alternative.

#### Regular Pages

MYDB keeps regular data pages simple. Each starts with a 2-byte unsigned number giving the offset of the free space in that page. The rest holds the actual data.

Regular page management therefore mostly revolves around the FSO (Free Space Offset). For example, inserting data into a page:

```java
// 将 raw 插入 pg 中，返回插入位置
public static short insert(Page pg, byte[] raw) {
    pg.setDirty(true);
    short offset = getFSO(pg.getData());
    System.arraycopy(raw, 0, pg.getData(), offset, raw.length);
    setFSO(pg.getData(), (short)(offset + raw.length));
    return offset;
}
```

Read the FSO before writing to determine where to write, then update it afterward. Here are the FSO operations:

```java
private static void setFSO(byte[] raw, short ofData) {
    System.arraycopy(Parser.short2Byte(ofData), 0, raw, OF_FREE, OF_DATA);
}

// 获取 pg 的 FSO
public static short getFSO(Page pg) {
    return getFSO(pg.getData());
}

private static short getFSO(byte[] raw) {
    return Parser.parseShort(Arrays.copyOfRange(raw, 0, 2));
}

// 获取页面的空闲空间大小
public static int getFreeSpace(Page pg) {
    return PageCache.PAGE_SIZE - (int)getFSO(pg.getData());
}
```

The remaining two methods, `recoverInsert()` and `recoverUpdate()`, let the recovery routine directly insert and update data when the database is reopened after a crash.

```java
// 将 raw 插入 pg 中的 offset 位置，并将 pg 的 offset 设置为较大的 offset
public static void recoverInsert(Page pg, byte[] raw, short offset) {
    pg.setDirty(true);
    System.arraycopy(raw, 0, pg.getData(), offset, raw.length);

    short rawFSO = getFSO(pg.getData());
    if(rawFSO < offset + raw.length) {
        setFSO(pg.getData(), (short)(offset+raw.length));
    }
}

// 将 raw 插入 pg 中的 offset 位置，不更新 update
public static void recoverUpdate(Page pg, byte[] raw, short offset) {
    pg.setDirty(true);
    System.arraycopy(raw, 0, pg.getData(), offset, raw.length);
}
```
