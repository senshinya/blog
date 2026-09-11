---
authorship: human-only
title: "Reading the MapReduce Paper"
description: "MapReduce is an efficient parallel computing model designed to simplify processing large datasets. By defining the two key functions, Map and Reduce, users can break complex tasks into simple operations. The framework automatically handles data distribution and task scheduling, allowing developers to focus on the algorithm rather than low-level details. Its widespread use in distributed systems demonstrates its flexibility and practical value."
date: 2022-01-16 17:32:00
categories: [notes]
tags: ["mapreduce", "6.5840", "6.824"]
image: "https://blog-img.774352199.xyz/ApIDdC.webp"
seoDescription: "Notes on Google’s MapReduce paper: the programming model, master-worker scheduling, intermediate data flow, failure recovery, and backup tasks for stragglers."
---

### Introduction

MapReduce is a software architecture model proposed by Google years ago for parallel computation over large datasets. The idea is now used in many distributed systems.

Google published the theory in its 2004 paper, *MapReduce: Simplified Data Processing on Large Clusters*. The full paper is available [here](https://static.googleusercontent.com/media/research.google.com/zh-CN//archive/mapreduce-osdi04.pdf). Just 13 pages, and far denser than plenty of other short papers I've read.

These are notes I took as I read, so they may be a little disorganized.

### Programming Model

MapReduce is a very simple parallel processing model. To use a MapReduce framework, you only need to specify two functions:

- A Map function that turns a key-value pair into a series of **intermediate** key-value pairs.
- A Reduce function that combines all intermediate values sharing the same key.

The framework takes care of everything else: distributing data, assigning tasks, handling failures, balancing load, and so on. You don't need to master those details and can focus on the application logic.

The overall flow looks like this:

Map receives an input key-value pair and produces a series of intermediate key-value pairs. The MapReduce framework groups all intermediate values with the same intermediate key and passes them to Reduce. Reduce receives an intermediate key and a collection of intermediate values, usually aggregating them into a smaller set. Sometimes a Reduce call produces just one result, or none at all.

For example, counting words in a large collection of text:

```c
map(String key, String value):
    // key：文章名称
    // value：文章内容
    for 单词 w in value:
        增加中间计数 (w, "1")
 
reduce(String key, Iterator values):
    // key：一个单词
    // value：一系列计数
    int result = 0;
    for v in values:
        result += ParseInt(v);
    输出 (ToString(result))
```

### Implementation

#### Execution Flow

As a programming model, or simply an approach to programming, MapReduce can be implemented in many ways. The paper describes Google's implementation for a large number of machines connected over a local network. Its execution flow is shown below:

![MapReduce execution flow](https://blog-img.774352199.xyz/2025/6f7e7839e6f09e0d8193d530920a6f7e.jpg)

1. The MapReduce framework first splits the input files into M pieces, typically 16–64 MB each. It then starts the machines, or processes, in the cluster.
2. One process is the special master process. The remaining worker processes receive their assignments from the master. There are M map tasks and R reduce tasks to assign. The master chooses idle workers and assigns each one a map task or a reduce task.
3. A worker assigned a map task reads its input split, parses key-value pairs from it, and passes each pair to the user-defined map function. The intermediate key-value pairs returned by map are buffered in memory.
4. The buffered pairs are partitioned into R regions by a partitioning function and periodically written to local disk. Their locations on disk are sent to the master, which forwards them to the workers assigned reduce tasks.
5. When a reduce worker receives these locations from the master, it sends RPC requests to the map workers holding the data to read it. After reading all the intermediate data, it sorts it by key so that values with the same key are grouped together. Sorting is necessary because a single reduce task usually handles many distinct keys. If the data is too large, an external sort may be used.
6. The reduce worker iterates over the sorted intermediate data. For each key, it passes the key and its collection of values to the user-defined reduce function. The output is appended to a final output file, one per reduce partition.
7. Once all map and reduce tasks have finished, the MapReduce job is complete.

The results are stored in R output files. These files are often used as input to the next MapReduce job.

#### Fault Tolerance

I'll only cover worker failures here, not master failures, since those can involve more complicated issues such as elections and consensus.

The master and workers maintain a heartbeat. If a worker doesn't respond for a while, the master considers it failed. All **map tasks completed by that worker** are reset to the unstarted state and reassigned to other workers. Any **map or reduce tasks still in progress** when it failed are also marked as unstarted.

Completed map tasks need to run again because their output lives on the failed machine's local disk. Completed reduce tasks don't: their output is stored in a global file system.

Suppose worker A originally ran a map task, then failed, and the task was reassigned to B. All workers running reduce tasks are notified. Any reduce task that hasn't already read the data from A will read it from B instead.

Sometimes a machine is very slow but still has a working network connection, so it isn't considered failed. It becomes a bottleneck, forcing the entire system to wait for it to finish. Google's implementation addresses this with a backup-task mechanism: as the overall MapReduce operation nears completion, the master assigns tasks that are still running to other idle workers as well. The task counts as complete as soon as either the original worker or the backup worker finishes it.

I'll skip the performance improvements, smaller optimizations, and extensions.
