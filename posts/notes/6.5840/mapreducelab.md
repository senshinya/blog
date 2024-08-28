---
title: 实验一 —— MapReduce
tags: ["mapreduce","6.5840","6.824"]
category: "6.5840"
date: 2022-01-20T22:29:00+08:00
---

### 前言

实验一是要实现一个 MapReduce 系统，基本就是两个部分：实现 master 程序和实现 worker 程序。这个实验基本就是劝退怪了，一来是对 golang 的 rpc 和并发的使用要比较熟悉，二来就是要对 MapReduce 的整个流程机制要比较熟悉。其实有一个小秘诀，就是拼命看论文中的这张图，再拼命看下面的流程讲解：

![mapReduce 执行流程](/images/mapreduce.jpg)

这个实验我实现了两个版本，主要是并发控制的方式有些不同。最初是基于 mutex 锁的版本，后来重构成了基于 channel 的无锁版本。无锁版本的实现比较优雅，所以讲解也主要基于无锁版本。

### 实验讲解

做实验之前，首先需要读懂实验。说明书在：[https://pdos.csail.mit.edu/6.824/labs/lab-mr.html](https://pdos.csail.mit.edu/6.824/labs/lab-mr.html)。主要这个实验需要在 Linux 环境下进行，因为进程通信基于 unix socket，MacOS 原则上来说也可以，但是据说还是会有些小问题。

代码中已经提供了一个单线程串行版的 MapReduce，代码在 `src/main/mrsequential.go`。这个版本很重要，建议先阅读一遍，可以大致了解整体的流程。有一些内容的处理也可以直接从中 copy。

并行版本的 master 程序入口在 `main/mrcoordinator.go`，worker 程序入口在 `main/mrworker.go`。实验需要实现的有三个文件，分别是 `mr/coordinator.go`、`mr/worker.go`、和 `mr/rpc.go`，分别描述了 master 的处理代码、worker 的处理代码以及它们之间通信的 rpc 结构。

mrcoordinator 会调用 `mr/coordinator.go` 中的 MakeCoordinator 函数，来构建 master 的结构，并启动 socket 监听，在返回后，主协程会不断调用 Coordinator.Done 方法，来检查是否已经完成整个 MapReduce 任务，确认完成后才会退出主协程。所以，在 MakeCoordinator 中，不应当有操作阻止函数返回，否则会阻塞后续操作。**相关的监听等工作应当通过新协程实现**。

mrworker 的处理就很简单了，只有一个主协程，直接调用了 `mr/worker.go` 的 Worker 函数，在这里处理即可。一般可以直接实现成单协程程序。

测试脚本为 `src/main/test-mr.sh`，它会将两个现成的 MapReduce 程序：wc 和 indexer 通过你的框架执行，并与串行执行的结果相比较。它同时还会检查并行运行相同的 Map 或 Reduce 任务、甚至 worker 执行任务期间发生 crash 时，最终是否能得到正确的结构。通常它会启动一个 master 进程和三个 worker 进程。如果在运行期间发生错误不退出时，可以通过 `ps -A` 命令，找到 mrcoordinator 进程的 pid，并 kill 掉即可。普通的 `ctrl + c` 可能无法完全退出，会影响后续的测试。

最后，请多阅读几遍实验指导书。

### 实现思路

#### 整体流程

workers 会首先执行完 map 任务，生成很多中间文件 “mr-X-Y”，其中，X 是 map 任务的 id，Y 是对应的 reduce 任务 id。接着 reduce 会收集所有 Y 等于 reduce 任务 id 的文件，读取并进行 reduce 操作，并将结果输出到 “mr-out-Y” 中。

#### master 实现

##### 无锁思路

由于是一个无锁的实现，要避免多协程数据冲突，所有对主要数据结构的操作应当收敛到一个协程中，这里可以称为调度协程。在 worker 通过 rpc 请求 master 时，例如获取一个 task 或者汇报完成工作，master 会通过一个自动创建的协程处理 rpc 请求，由于对主要数据结构的操作已经收敛，这个 rpc 协程就必须通过 channel 要求调度协程代办，以保证没有数据竞争。由于 worker 和 master 之间可能有多种消息，这意味着调度协程必须同时管理多个 channel。这里可以运用 golang 的 select 结构：

```go
// 只在这个 goroutine 中操作结构
func (c *Coordinator) schedule() {
    for {
        select {
        case msg := <-c.getTaskChan:
            c.getTaskHandler(msg)
        case msg := <-c.doneTaskChan:
            c.doneTaskHandler(msg)
        case msg := <-c.timeoutChan:
            c.timeoutHandler(msg)
        case msg := <-c.doneCheckChan:
            c.doneCheckHandler(msg)
        }
    }
}
```

假设这时候有一个 worker 需要获取一个 task 来执行，请求 master 的 GetTask，GetTask 处理如下：

```go
func (c *Coordinator) GetTask(_ *GetTaskReq, resp *GetTaskResp) error {
    msg := GetTaskMsg{
        resp: resp,
        ok:   make(chan struct{}),
    }
    c.getTaskChan <- msg
    <-msg.ok
    return nil
}
```

在向 getTaskChan 中，不止传入了 resp（getTask 不需要请求参数），还传入了一个 chan struct{} 类型的管道，这个管道是协调协程用于通知 rpc 协程处理完成的通道：当处理完成后，就会向 msg.ok 中写入一个 struct{}，rpc 协程就会返回。

##### Coordinator

整个 Coordinator 结构如下：

```go
type Coordinator struct {
    nMap    int
    nReduce int
    phase   TaskPhase
    allDone bool
 
    taskTimeOut map[int]time.Time
    tasks       []*Task
 
    getTaskChan   chan GetTaskMsg
    doneTaskChan  chan DoneTaskMsg
    doneCheckChan chan DoneCheckMsg
    timeoutChan   chan TimeoutMsg
}
```

phase 记录了当前任务执行的阶段，由于 reduce 任务必须在所有 map 任务结束后才能进行，所以 TaskPhase 分为 Map 和 Reduce 阶段，每个阶段中，tasks 切片只有对应阶段的任务。

taskTimeOut 记录了当前正在执行的任务的开始时间，会有一个协程定时去扫描这个 map，找出其中运行时间大于十秒的任务（超时），将对应的任务状态设置为未开始，以进行下一次调度。当然这个扫描操作也需要通过协调协程进行。超时 map 中也只有当前阶段正在执行的任务，在切换阶段时会清空超时 map。

tasks 切片保存了当前阶段所有的 Task，以及相关的状态：

```go
type ReduceTask struct {
    NMap int
}
 
type MapTask struct {
    FileName string
    NReduce  int
}
 
type TaskStatus int
 
var (
    TaskStatus_Idle     TaskStatus = 0
    TaskStatus_Running  TaskStatus = 1
    TaskStatus_Finished TaskStatus = 2
)
 
type Task struct {
    TaskId     int
    MapTask    MapTask
    ReduceTask ReduceTask
    TaskStatus TaskStatus
}
```

这里可以看到任务的状态被分成三个，分别是待执行、执行中以及执行完成。同时冗余保存了 MapTask 和 ReduceTask，具体使用哪个结构体由当前阶段来判断。

##### 具体操作

根据 Coordinator 中的管道，可以看出有四种情况需要和协调协程通信以进行操作。

当 worker 请求一个任务时，可能获取到的任务类别有四种：

```go
type TaskType int
 
var (
    TaskType_Map    TaskType = 0
    TaskType_Reduce TaskType = 1
    TaskType_Wait   TaskType = 2
    TaskType_Exit   TaskType = 3
)
```

master 首先遍历所有的 tasks，找出其中的状态为未执行的状态，并根据当前的阶段，返回 Map 或者 Reduce 任务。如果当前没有空闲任务的话，又分为以下两种情况。当前为 Map 阶段，这时需要返回 TaskType\_Wait 任务，要求 worker 等待，Map 阶段结束后还需要进行 Reduce 任务；当前为 Reduce 阶段，这时所有任务已经完成，返回 TaskType\_Exit 要求 worker 退出。

当 worker 完成时，会通知 master 任务完成。传递的信息中会带有任务的类型和任务的 Id。master 会忽略掉非当前阶段的任务，根据 taskId 修改 tasks 中的任务状态为 finished（忽略当前任务状态，直接改为完成），并删除 timeout 中的对应结构。

```go
func (c *Coordinator) doneTaskHandler(msg DoneTaskMsg) {
    req := msg.req
    if req.TaskType == TaskType_Map && c.phase == TaskPhase_Reduce {
        // 提交非当前阶段的任务，直接返回
        msg.ok <- struct{}{}
        return
    }
    for _, task := range c.tasks {
        if task.TaskId == req.TaskId {
            // 无论当前状态，直接改为完成
            task.TaskStatus = TaskStatus_Finished
            break
        }
    }
    // 删除 timeout 结构
    delete(c.taskTimeOut, req.TaskId)
    allDone := true
    for _, task := range c.tasks {
        if task.TaskStatus != TaskStatus_Finished {
            allDone = false
            break
        }
    }
    if allDone {
        if c.phase == TaskPhase_Map {
            c.initReducePhase()
        } else {
            c.allDone = true
        }
    }
    msg.ok <- struct{}{}
}
```

如果是在 Reduce 阶段发现所有任务都完成了，还会设置一下 allDone 标志位。

Coordinator 在初始化时，还会启动一个协程，这个协程每秒请求一次协调协程，检查 timeoutMap 是否有超时任务，如果超时，就将其状态置为未开始，这样在下一次 worker 请求任务时就可以调度执行了。

```go
func (c *Coordinator) timeoutHandler(msg TimeoutMsg) {
    now := time.Now()
    for taskId, start := range c.taskTimeOut {
        if now.Sub(start).Seconds() > 10 {
            for _, task := range c.tasks {
                if taskId == task.TaskId {
                    if task.TaskStatus != TaskStatus_Finished {
                        task.TaskStatus = TaskStatus_Idle
                    }
                    break
                }
            }
            delete(c.taskTimeOut, taskId)
            break
        }
    }
    msg.ok <- struct{}{}
    return
}
```

最后还有一个完成状态检查，是主线程调用 Coordinator.Done 进行的，请求协调协程时，只需要检查 allDone 标志位即可。

#### worker

worker 只有单个协程，循环从 master 处获取任务执行：

```go
func Worker(mapf func(string, string) []KeyValue,
    reducef func(string, []string) string) {
    for {
        resp := callGetTask()
        switch resp.TaskType {
        case TaskType_Map:
            handleMapTask(resp.Task, mapf)
        case TaskType_Reduce:
            handleReduceTask(resp.Task, reducef)
        case TaskType_Wait:
            time.Sleep(time.Second)
        case TaskType_Exit:
            return
        }
    }
}
```

map 和 reduce 的操作，可以参考串行单线程的实现。有一点注意是，由于可能有多个进程同时执行同一个任务，也可能会出现执行到一半崩溃的情况，遗留下的文件可能会导致后续 worker 重新执行时发生错误。所以创建输出文件时，可以通过 ioutil.TempFile 函数创建一个临时文件写入，等到写入完成后通过 os.Rename 重命名为目标文件，这样即可保证最后的输出文件一定是完整的。