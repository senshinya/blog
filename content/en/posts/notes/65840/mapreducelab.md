---
authorship: human-only
title: "6.5840 Lab 1: MapReduce"
description: "Lab 1 asks us to implement a MapReduce system with two core components: a master and workers. This requires a good command of Go RPC and concurrent programming, along with a thorough understanding of the MapReduce workflow. I built two versions, starting with mutex locks and then moving to a more elegant channel-based implementation without explicit locks, whose design is simpler and clearer. The key to understanding the lab is to read the relevant documentation carefully, especially the flowcharts and explanations."
date: 2022-01-20 22:29:00
categories: [notes]
tags: ["mapreduce", "6.5840", "6.824"]
image: "https://blog-img.774352199.xyz/ibVwPJ.webp"
seoDescription: "Implement MIT’s MapReduce lab in Go with a channel-based coordinator, RPC task assignment, phase transitions, timeout retries, and atomic output renaming."
---

### Introduction

Lab 1 is about implementing a MapReduce system. There are essentially two parts: the master program and the worker program. This lab is quite the early hurdle. You need to be comfortable with RPC and concurrency in Go, and you need a good grasp of the entire MapReduce workflow. My little trick is to stare at this diagram from the paper, then reread the explanation of the flow beneath it, over and over:

![MapReduce execution flow](https://blog-img.774352199.xyz/2025/6f7e7839e6f09e0d8193d530920a6f7e.jpg)

I implemented two versions of this lab, differing mainly in how they handle concurrency. The first used mutexes; I later refactored it into a channel-based version without explicit locks. The latter is more elegant, so that's the version I'll focus on here.

### Understanding the Lab

Before starting, make sure you understand the assignment. The instructions are at [https://pdos.csail.mit.edu/6.824/labs/lab-mr.html](https://pdos.csail.mit.edu/6.824/labs/lab-mr.html). The lab is mainly intended for Linux, since processes communicate over Unix sockets. macOS should work in principle, though I've heard it can have a few issues.

The starter code includes a single-threaded, sequential MapReduce implementation at `src/main/mrsequential.go`. It's worth reading first to understand the overall flow. You can also copy some of its data-processing logic directly.

The parallel master's entry point is `main/mrcoordinator.go`, and the worker's is `main/mrworker.go`. You need to implement three files: `mr/coordinator.go`, `mr/worker.go`, and `mr/rpc.go`. They contain the master's logic, the worker's logic, and the RPC structures used for communication, respectively.

mrcoordinator calls MakeCoordinator in `mr/coordinator.go` to construct the master and start listening on a socket. Once that returns, the main goroutine repeatedly calls Coordinator.Done to check whether the entire MapReduce job has finished, and exits only when it has. MakeCoordinator therefore must not block indefinitely, or the subsequent checks will never run. **Start listeners and similar background work in new goroutines.**

mrworker is simpler. Its single main goroutine calls Worker in `mr/worker.go`, so you can put the processing there. A single goroutine is generally enough for the worker.

The test script, `src/main/test-mr.sh`, runs two existing MapReduce programs, wc and indexer, on your framework and compares their results with the sequential implementation. It also checks that the results remain correct when the same Map or Reduce task runs concurrently, or when a worker crashes during execution. It usually starts one master process and three worker processes. If something goes wrong and a run won't exit, use `ps -A` to find the mrcoordinator PID and kill it. A simple `ctrl + c` may leave processes behind and interfere with later tests.

Finally, read the lab instructions a few more times.

### Implementation Approach

#### Overall Flow

The workers first finish all map tasks, producing intermediate files named “mr-X-Y,” where X is the map task ID and Y is the corresponding reduce task ID. Each reduce task then gathers all files whose Y matches its ID, reads them, performs the reduction, and writes its result to “mr-out-Y.”

#### Implementing the Master

##### Working Without Explicit Locks

To avoid data races without explicit locks, all operations on the main data structures need to happen in a single goroutine. I'll call it the scheduler goroutine. When a worker makes an RPC request to the master, perhaps to ask for a task or report completion, the master handles the request in an automatically created goroutine. Since access to the main data structures is centralized, that RPC goroutine must ask the scheduler goroutine to perform the operation through a channel. There are several kinds of messages between workers and the master, so the scheduler needs to handle several channels at once. Go's select statement is useful here:

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

Suppose a worker needs a task and calls the master's GetTask. The handler looks like this:

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

The message sent to getTaskChan contains resp and a chan struct{}; getTask needs no request parameters. The scheduler uses that channel to tell the RPC goroutine that processing is complete. Once it sends a struct{} to msg.ok, the RPC goroutine can return.

##### Coordinator

Here is the full Coordinator structure:

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

phase records the current execution phase. Because reduce tasks can only begin once all map tasks have finished, TaskPhase has Map and Reduce phases. The tasks slice contains only the tasks for the current phase.

taskTimeOut records the start times of tasks currently running. A goroutine periodically scans this map for tasks that have run for more than ten seconds, treats them as timed out, and resets them to the unstarted state so they can be scheduled again. The scan must also go through the scheduler goroutine, of course. The timeout map contains only running tasks from the current phase and is cleared when phases change.

The tasks slice stores every Task in the current phase, along with its state:

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

There are three task states: idle, running, and finished. Both MapTask and ReduceTask are stored in the same structure, even though only one is needed; the current phase determines which one to use.

##### Handling Operations

The channels in Coordinator correspond to four kinds of operations that need to communicate with the scheduler goroutine.

When a worker requests a task, it can receive one of four task types:

```go
type TaskType int
 
var (
    TaskType_Map    TaskType = 0
    TaskType_Reduce TaskType = 1
    TaskType_Wait   TaskType = 2
    TaskType_Exit   TaskType = 3
)
```

The master first walks through tasks looking for an unstarted task, then returns a Map or Reduce task according to the current phase. If there are no idle tasks, there are two cases: in the Map phase, return TaskType\_Wait and ask the worker to wait, since Reduce work still follows; in the Reduce phase, all tasks are now complete, so return TaskType\_Exit and ask the worker to exit.

When a worker finishes, it notifies the master, including the task type and task ID. The master ignores tasks from a different phase, finds the task by taskId, marks it as finished regardless of its current state, and removes its timeout entry.

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

If all tasks have finished in the Reduce phase, the handler also sets the allDone flag.

During initialization, Coordinator starts a goroutine that asks the scheduler once a second to check timeoutMap for timed-out tasks. Any such task is reset to the unstarted state so it can be assigned the next time a worker requests work.

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

The last operation is the completion check. The main thread calls Coordinator.Done, which asks the scheduler goroutine to check the allDone flag.

#### Worker

The worker has just one goroutine, which repeatedly fetches tasks from the master and executes them:

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

For the map and reduce operations, refer to the sequential single-threaded implementation. One thing to watch out for: multiple processes may run the same task simultaneously, and a process may crash halfway through. Files left behind can cause problems when another worker reruns the task. Write output to a temporary file created with ioutil.TempFile, then rename it to the target filename with os.Rename after the write completes. That ensures the final output file is always complete.
