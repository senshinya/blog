---
authorship: human-only
title: "MYDB 2. A Reference-Counted Cache Framework and Shared Byte Arrays"
description: "The Data Manager (DM) bridges higher-level modules and the filesystem, handling paging and caching while ensuring data safety and recovery. Its cache uses reference counting rather than traditional LRU, aiming for a reusable, efficient foundation for subsequent data operations."
date: 2021-11-30 23:18:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/WdIGoG.webp"
---

All the code in this chapter is in [backend/common](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/common).

### Introduction

In this chapter, we begin looking at MYDB’s lowest-level module, the Data Manager:

> DM directly manages the database’s DB file and log file. Its main responsibilities are: 1) managing and caching the pages of the DB file; 2) managing the log file so the database can recover from errors using the log; and 3) exposing the DB file as DataItems to higher-level modules and providing a cache for them.

DM’s work really boils down to two things: it is an abstraction layer between higher-level modules and the filesystem, reading and writing files below and providing data wrappers above; it also handles logging.

Notice that DM provides caching in both directions, using in-memory operations to keep things efficient.

### A Reference-Counted Cache Framework

#### Why Not LRU?

Both page management and DataItem management need caches, so we will design a more general-purpose cache framework here.

At this point, you may be wondering why we are using reference counting instead of the supposedly “far more advanced” LRU policy.

Let us start with the cache interface. An LRU cache needs only a `get(key)` method: entries can be evicted automatically when the cache fills up. Now imagine the cache fills up and evicts a resource. A higher-level module then wants to force a resource back to its backing store, and it happens to be the one that was just evicted. The module discovers that its data has disappeared from the cache. This leaves an awkward question: should it write the resource back to the backing store?

1.  Do not write it back. We cannot tell when it was evicted, much less whether the DataItem has changed since eviction. This is extremely unsafe.
2.  Write it back. If the data is still the same as it was at eviction, this is an unnecessary write.
3.  Put it back in the cache and write it back on the next eviction. That seems to solve the problem, but the cache is already full, so we need to evict another resource to make room. This can cause cache thrashing.

We could, of course, record the resource’s last-modified time and have the cache record its eviction time. But…

> Entities should not be multiplied beyond necessity. — Occam’s razor

The root of the problem is that LRU eviction is outside the higher-level module’s control, and the module is unaware of it. Reference counting solves exactly this problem: a resource is evicted only after higher-level modules explicitly release their references and the cache knows no module is using it anymore.

That is reference counting. We add a `release(key)` method for a higher-level module to release its reference when it no longer needs a resource. When the reference count reaches zero, the cache evicts the resource.

Conversely, when the cache is full, reference counting cannot automatically free space. We should simply report an error at that point, much like the JVM throwing an OOM.

#### Implementation

`AbstractCache<T>` is an abstract class with two abstract methods that subclasses implement for their specific operations:

```java
/**
 * 当资源不在缓存时的获取行为
 */
protected abstract T getForCache(long key) throws Exception;
/**
 * 当资源被驱逐时的写回行为
 */
protected abstract void releaseForCache(T obj);
```

Beyond ordinary caching, reference counting needs a count for each resource. To support multiple threads, we also need to record which resources are currently being fetched from the backing store, since fetching is relatively time-consuming. That gives us these three Maps:

```java
private HashMap<Long, T> cache;                     // 实际缓存的数据
private HashMap<Long, Integer> references;          // 资源的引用个数
private HashMap<Long, Boolean> getting;             // 正在被获取的资源
```

When `get()` retrieves a resource, it first enters an infinite loop to keep trying the cache. It checks whether another thread is currently fetching this resource from the backing store. If so, come back and check again in a bit. (

```java
while(true) {
    lock.lock();
    if(getting.containsKey(key)) {
        // 请求的资源正在被其他线程获取
        lock.unlock();
        try {
            Thread.sleep(1);
        } catch (InterruptedException e) {
            e.printStackTrace();
            continue;
        }
        continue;
    }
    ...
}
```

If the resource is already cached, we can return it directly, remembering to increment its reference count. Otherwise, if the cache is not full, register the key in getting to indicate that this thread is about to fetch the resource from the backing store.

```java
while(true) {
    if(cache.containsKey(key)) {
        // 资源在缓存中，直接返回
        T obj = cache.get(key);
        references.put(key, references.get(key) + 1);
        lock.unlock();
        return obj;
    }

    // 尝试获取该资源
    if(maxResource > 0 && count == maxResource) {
        lock.unlock();
        throw Error.CacheFullException;
    }
    count ++;
    getting.put(key, true);
    lock.unlock();
    break;
}
```

Fetching the resource is straightforward: call the abstract method. Once it finishes, remember to remove the key from getting.

```java
T obj = null;
try {
    obj = getForCache(key);
} catch(Exception e) {
    lock.lock();
    count --;
    getting.remove(key);
    lock.unlock();
    throw e;
}

lock.lock();
getting.remove(key);
cache.put(key, obj);
references.put(key, 1);
lock.unlock();
```

Releasing a cached resource is much simpler. Decrement its count in references. If the count reaches zero, write the resource back and remove all its associated cache entries:

```java
/**
 * 强行释放一个缓存
 */
protected void release(long key) {
    lock.lock();
    try {
        int ref = references.get(key)-1;
        if(ref == 0) {
            T obj = cache.get(key);
            releaseForCache(obj);
            references.remove(key);
            cache.remove(key);
            count --;
        } else {
            references.put(key, ref);
        }
    } finally {
        lock.unlock();
    }
}
```

The cache should also support a safe shutdown, forcing every cached resource back to its backing store when it closes.

```java
lock.lock();
try {
    Set<Long> keys = cache.keySet();
    for (long key : keys) {
        release(key);
        references.remove(key);
        cache.remove(key);
    }
} finally {
    lock.unlock();
}
```

That completes a simple cache framework. Other caches only need to extend this class and implement its two abstract methods.

### Shared Byte Arrays

Here is one rather irritating thing about Java.

Java treats arrays as objects and stores them as objects in memory. In languages such as C, C++, and Go, arrays are implemented using pointers. This is why you sometimes hear:

> Only Java has real arrays.

For this project, though, that does not seem to be good news. In Go, for example, you can write:

```go
var array1 [10]int64
array2 := array1[5:]
```

Here, array2 shares the same memory as array1 from its fifth element through its last, even though the two arrays have different lengths.

You cannot do this in Java. So much for being a high-level language~

In Java, an operation like subArray merely copies the data underneath; it cannot share the same memory.

So I wrote a SubArray class to specify, rather loosely, which part of an array may be used:

```java
public class SubArray {
    public byte[] raw;
    public int start;
    public int end;

    public SubArray(byte[] raw, int start, int end) {
        this.raw = raw;
        this.start = start;
        this.end = end;
    }
}
```

Honestly, this is an ugly solution, but it is what I have for now. If you know another way, please leave a comment below. I do not want the code to look this ugly either /(ㄒo ㄒ)/~~
