---
authorship: human-only
title: "6.5840 Lab 2A: Leader Election"
description: "Lab 2A focuses on implementing Raft leader election and heartbeats so that elections and term changes work correctly even under extreme conditions. The lab has four stages and lays the foundation for the distributed key-value store that follows. A design without explicit locks simplifies the Raft struct. The lab instructions provide the necessary background, but compared with the previous lab, this one relies on almost no reference material and places greater emphasis on implementing the system independently."
date: 2022-12-16 02:06:10
categories: [notes]
tags: ["raft", "6.5840", "6.824"]
---

### Introduction

Lab 2 in 6.824 asks us to implement Raft. The distributed key-value store in later labs will use this implementation as its consensus module, so this lab is essential groundwork.

Lab 2 splits Raft into four stages, each a separate sub-lab. Lab 2A only covers basic leader election and heartbeats, ensuring that elections and term changes work under various extreme conditions, such as disconnections.

Of course, as the starting point for all four sub-labs, 2A needs more than just election logic: it also needs the framework for the overall processing flow. Once again, I'm using a version without explicit locks. We can delete the mu variable from the Raft struct! Cue maniacal laughter.

### Understanding the Lab

The instructions are at [https://pdos.csail.mit.edu/6.824/labs/lab-raft.html](https://pdos.csail.mit.edu/6.824/labs/lab-raft.html). Unlike Lab 1, this one gives us almost nothing to work from. The code to implement lives in `src/raft/raft.go`, where the initial Raft struct is just a skeleton:

```go
type Raft struct {
    peers []*labrpc.ClientEnd // RPC end points of all peers
    persister *Persister // Object to hold this peer's persisted state
    me int // this peer's index into peers[]
    dead int32 // set by Kill()
}
```

Each Raft struct represents one server in the cluster and must hold everything that server needs.

peers contains all servers in the current cluster configuration. ClientEnd lets us send an RPC directly through Call. me is this machine's unique index in the cluster; the other machines identify it by the same index.

The entry point for Lab 2A is `Make()`. After initializing the struct, Make starts a goroutine running `rf.ticker()`. It runs an infinite loop, or rather a loop controlled by a shutdown flag. Since we don't care about what happens after shutdown here, we can treat it as infinite. This will be our main goroutine.

The hardest part of Lab 2 is how little the framework provides: we essentially have to implement Raft from scratch. Fortunately, Figure 2 of the paper gives us most of the overall design.

The tests are in `test_test.go` in the same directory. If a test fails, read its implementation and debug against the scenario it sets up.

The test command for Lab 2D is `go test -run 2A`. I recommend `go test -race -run 2A` to check for data races at the same time.

### Implementation Approach

#### Overall Flow

Without explicit locks, we need to plan the processing flow and communication between goroutines carefully. A solid foundation here also helps with the later labs, since this is the first in a series.

Let's designate `rf.ticker()` as the main goroutine. Only this goroutine may modify fields in the Raft struct; all others are prohibited from doing so. That directly avoids data races. The `ticker()` method should therefore loop indefinitely, listening for messages on a set of channels.

Which goroutines need to communicate, and which channels do we need? Elections involve two RPC types: AppendEntries and RequestVote. Incoming RPCs are initially received outside the main goroutine, so we need two channels to hand those requests over to it. Outgoing RPCs also run outside the main goroutine, since we cannot block it while waiting for responses. The responses to those two RPC types need to be passed back for processing, giving us another two channels.

We also need two timers, one for election timeouts and one for heartbeats. The lab recommends `time.Sleep()` for timing. But sleeping doesn't let us interrupt a countdown, so despite the instructions discouraging `time.Timer`, I went against the advice and used Timer to support interrupting and resetting the countdown. Getting timers right really isn't easy, though.

First, define the server states that identify each server's role:

```go
type ServerStatus uint8
 
const (
    Follower  ServerStatus = 0
    Candidate ServerStatus = 1
    Leader    ServerStatus = 2
)
```

Following Figure 2 of the Raft paper, define the basic server fields, along with the channels and timers described above:

```go
type Raft struct {
    ...

    // Status
    Status ServerStatus
    // 已提交日志，外部获取管道
    ApplyCh chan ApplyMsg

    /***** 所有 Server 都包含的持久状态 *****/
    // CurrentTerm 机器遇到的最大的任期，启动时初始化为 0，单调递增
    CurrentTerm int
    // VotedFor 当前任期内投票的 Candidate ID，未投票则为 -1
    VotedFor int
    // Logs 日志条目，每个条目都包含了一条状态机指令和 Leader 接收该条目时的任期，index 从 1 开始
    Logs []*LogEntry

    /***** 所有 Server 都包含的可变状态 *****/
    // CommitIndex 已知的最大的即将提交的日志索引，启动时初始化为 0，单调递增
    CommitIndex uint64
    // LastApplied 最大的已提交的日志索引，启动时初始化为 0，单调递增
    LastApplied uint64

    /******* Leader 包含的可变状态，选举后初始化 *******/
    // NextIndex 每台机器下一个要发送的日志条目的索引，初始化为 Leader 最后一个日志索引 +1
    NextIndex []uint64
    // MatchIndex 每台机器已知复制的最高的日志条目，初始化为 0，单调递增
    MatchIndex []uint64

    // 定时器
    electionTimer  *time.Timer
    heartbeatTimer *time.Timer

    // 处理 rpc 请求的管道
    requestVoteChan   chan RequestVoteMsg
    appendEntriesChan chan AppendEntriesMsg
}
```

Remember to initialize all channels and timers in `Make()`. Reads and writes on nil channels block indefinitely. Before Make returns, start the main goroutine to listen for channel messages:

```go
func (rf *Raft) ticker() {
    for !rf.killed() {
        select {
        case <-rf.electionTimer.C:
            rf.startElection()
            resetTimer(rf.electionTimer, RandomizedElectionTimeout())
        case <-rf.heartbeatTimer.C:
            rf.broadcastHeartbeat()
            resetTimer(rf.heartbeatTimer, FixedHeartbeatTimeout())
        case msg := <-rf.requestVoteChan:
            rf.handleRequestVote(msg)
        case msg := <-rf.appendEntriesChan:
            rf.handleAppendEntries(msg)
        case msg := <-rf.requestVoteResChan:
            rf.handleRequestVoteRes(msg)
        case msg := <-rf.appendEntriesResChan:
            rf.handleAppendEntriesRes(msg)
        }
    }
}
```

#### The Two Timers

electionTimer handles election timeouts. Each reset uses a random duration so that the entire cluster doesn't time out and start elections simultaneously. Here the range is 300–450 ms. heartbeatTimer uses a fixed interval of 100 ms.

```go
func Make(peers []*labrpc.ClientEnd, me int,
    persister *Persister, applyCh chan ApplyMsg) *Raft {
    ...
    rf.electionTimer = time.NewTimer(RandomizedElectionTimeout())
    rf.heartbeatTimer = time.NewTimer(FixedHeartbeatTimeout())
    ...
}

func RandomizedElectionTimeout() time.Duration {
    rand.Seed(time.Now().UnixNano())
    return time.Duration(rand.Intn(150)+300) * time.Millisecond
}

func FixedHeartbeatTimeout() time.Duration {
    return time.Millisecond * 100
}
```

The election timer is mainly for non-leaders. Each time a server receives a heartbeat from the leader, it resets the timer. If it hears nothing for a while, it starts an election:

1. Increment the current term.
2. Become a candidate and vote for itself.
3. Send RequestVote to the other machines.

The implementation is:

```go
func (rf *Raft) startElection() {
    if rf.Status == Leader {
        // leader 无需发起新选举
        return
    }
    rf.CurrentTerm += 1
    // fmt.Printf("server %d start election for term %d\n", rf.me, rf.CurrentTerm)
    rf.Status = Candidate
    rf.VotedFor = rf.me
    args := RequestVoteArgs{
        Term:         rf.CurrentTerm,
        CandidateId:  rf.me,
        LastLogIndex: len(rf.Logs) - 1,
    }
    if len(rf.Logs) != 0 {
        args.LastLogTerm = rf.Logs[len(rf.Logs)-1].Term
    }
    meta := ElectionMeta{
        term: rf.CurrentTerm,
        yeas: 1,
        nays: 0,
    }
    for peer := range rf.peers {
        if peer == rf.me {
            continue
        }
        go rf.sendRequestVoteRoutine(peer, args, &meta)
    }
}
```

ElectionMeta stores the election's metadata: its term and the counts of votes for and against. We cannot wait for all votes in the main goroutine, so we start a goroutine for each machine to handle its RequestVote RPC. Once a response arrives, that goroutine notifies the main goroutine through a channel. Starting an election also requires resetting the election timer.

The heartbeat timer is mainly for leaders. Whenever it expires, the leader broadcasts heartbeats to maintain its role and prevent new elections. The timer must be reset after each broadcast as well.

```go
func (rf *Raft) broadcastHeartbeat() {
    if rf.Status != Leader {
        return
    }
    // fmt.Printf("server %d broadcast heartbeat\n", rf.me)
    args := AppendEntriesArgs{
        Term:     rf.CurrentTerm,
        LeaderID: rf.me,
    }
    for peer := range rf.peers {
        if peer == rf.me {
            continue
        }
        go rf.sendAppendEntriesRoutine(peer, args)
    }
}
```

Heartbeats reuse AppendEntries RPCs. As before, RPC communication with each machine is handled in a separate goroutine.

#### RequestVote

When the election timer expires, a non-leader starts an election to try to choose a new leader. In `StartElection()` above, we already created a goroutine per machine to manage its RequestVote RPC. Here is the function that sends the request:

```go
// 发送拉票请求的协程
func (rf *Raft) sendRequestVoteRoutine(peer int, args RequestVoteArgs, electionMeta *ElectionMeta) {
    reply := RequestVoteReply{}
    ok := rf.sendRequestVote(peer, &args, &reply)
    if !ok {
        return
    }
    msg := RequestVoteResMsg{
        resp: &reply,
        meta: electionMeta,
    }
    rf.requestVoteResChan <- msg
}
```

There is nothing special here: send the RPC, wrap the result, and pass it to the main goroutine through a channel. The RPC request and response structures are:

```go
// 拉票 RPC 请求
type RequestVoteArgs struct {
    // Term Candidate 的任期
    Term int
    // CandidateId 拉票的 Candidate 的 ID
    CandidateId int
    // LastLogIndex Candidate 最后一条日志序列的索引
    LastLogIndex int
    // LastLogTerm Candidate 最后一条日志序列的任期
    LastLogTerm int64
}

// 拉票 RPC 响应
type RequestVoteReply struct {
    // Term 当前任期
    Term int
    // VoteGranted true 则拉票成功
    VoteGranted bool
}

// 拉票请求 RPC 发送入口
func (rf *Raft) sendRequestVote(server int, args *RequestVoteArgs, reply *RequestVoteReply) bool {
    ok := rf.peers[server].Call("Raft.RequestVote", args, reply)
    return ok
}
```

The receiving RPC entry point is RequestVote. Since the receiving goroutine is not the main goroutine, it also needs a channel to forward the vote request for processing:

```go
/********* 拉票请求接收端相关方法 *********/
// 拉票请求 RPC 接收入口
func (rf *Raft) RequestVote(args *RequestVoteArgs, reply *RequestVoteReply) {
    msg := RequestVoteMsg{
        req: args,
        ok:  make(chan RequestVoteReply),
    }
    rf.requestVoteChan <- msg
    resp := <-msg.ok
    *reply = resp
}

// 主协程处理拉票请求
func (rf *Raft) handleRequestVote(msg RequestVoteMsg) {
    req := msg.req
    if req.Term < rf.CurrentTerm ||
        (req.Term == rf.CurrentTerm && rf.VotedFor != -1 && rf.VotedFor != req.CandidateId) {
        msg.ok <- RequestVoteReply{
            Term:        rf.CurrentTerm,
            VoteGranted: false,
        }
        return
    }
    rf.rpcTermCheck(req.Term)
    rf.VotedFor = req.CandidateId
    resetTimer(rf.electionTimer, RandomizedElectionTimeout())
    // fmt.Printf("server %d vote for server %d for term %d\n", rf.me, msg.req.CandidateId, req.Term)
    msg.ok <- RequestVoteReply{
        Term:        rf.CurrentTerm,
        VoteGranted: true,
    }
}
```

If the server grants its vote, it must reset the election timer. `rpcTermCheck()` is a shared helper that checks whether the term in an RPC request or response exceeds the server's own term. If it does, the server updates its term and becomes a follower:

```go
// 检查 rpc 请求响应中的 term，如果大于自己的则需要更新任期并成为 Follower
func (rf *Raft) rpcTermCheck(msgTerm int) {
    if rf.CurrentTerm < msgTerm {
        rf.CurrentTerm = msgTerm
        rf.Status = Follower
        rf.VotedFor = -1
    }
}
```

When an outgoing request receives a vote response, its goroutine passes the result to the main goroutine, which counts votes and decides what to do:

```go
// 主协程处理拉票请求返回结果
func (rf *Raft) handleRequestVoteRes(msg RequestVoteResMsg) {
    meta := msg.meta
    if rf.Status != Candidate {
        return
    }
    if rf.CurrentTerm != meta.term {
        return
    }
    if msg.resp.VoteGranted {
        meta.yeas++
        if meta.yeas > len(rf.peers)/2 {
            // fmt.Printf("server %d become leader for term %d\n", rf.me, rf.CurrentTerm)
            rf.Status = Leader
            resetTimer(rf.heartbeatTimer, FixedHeartbeatTimeout())
            rf.broadcastHeartbeat()
        }
    } else {
        meta.nays++
        rf.rpcTermCheck(msg.resp.Term)
        if meta.nays > len(rf.peers)/2 {
            // 反对票超过一半，则该任期选举失败；可以给其他机器投票
            rf.VotedFor = -1
        }
    }
}
```

Two checks come first. If the server is no longer a candidate, or its current term differs from the election's term, the vote belongs to an outdated election. Just return without processing it.

For a vote in favor, check whether the yes votes now exceed half the cluster. If they do, the election has succeeded. The candidate becomes leader, resets the heartbeat timer, and broadcasts heartbeats to announce its new role.

For a vote against, there's a small optimization here. If the number of votes against exceeds half the cluster, the election has already failed. The implementation clears its vote for this term to -1 so that it can vote for another potential candidate and speed up leader election.

#### AppendEntries

For this lab, AppendEntries only needs to handle heartbeats. Actual log appending comes in Lab 2B.

`broadcastHeartbeat()` sends heartbeats to the cluster using AppendEntries. A separate goroutine manages the request to each machine:

```go
// 发送追加请求的协程
func (rf *Raft) sendAppendEntriesRoutine(peer int, args AppendEntriesArgs) {
    reply := AppendEntriesReply{}
    ok := rf.sendAppendEntries(peer, &args, &reply)
    if !ok {
        return
    }
    rf.appendEntriesResChan <- AppendEntriesResMsg{
        resp: &reply,
    }
}
```

As with RequestVote, it sends an RPC, waits for the response, and passes it back to the main goroutine through a channel. The AppendEntries request and response structures are:

```go
// 追加 RPC 请求
type AppendEntriesArgs struct {
    // Term Leader 的任期
    Term int
    // LeaderID Follower 可以将客户端请求重定向到 Leader
    LeaderID int
    // PrevLogIndex 新日志条目前一个日志条目的日志索引
    PrevLogIndex int
    // PrevLogTerm 前一个日志条目的任期
    PrevLogTerm int
    // Entries 需要保存的日志条目，心跳包为空
    Entries []*LogEntry
    // LeaderCommit Leader 的 CommitIndex
    LeaderCommit int
}

// 追加 RPC 响应
type AppendEntriesReply struct {
    // Term Follower 当前任期
    Term int
    // Success Follower 包含 PrevLogIndex 和 PrevLogTerm 的日志条目为 true
    Success bool
}

// 追加请求 RPC 发送入口
func (rf *Raft) sendAppendEntries(server int, args *AppendEntriesArgs, reply *AppendEntriesReply) bool {
    ok := rf.peers[server].Call("Raft.AppendEntries", args, reply)
    return ok
}
```

The receiving side forwards an incoming AppendEntries request to the main goroutine. For now, that goroutine only handles the heartbeat case: become a follower, reset the election timer, and check whether the term needs updating.

```go
/********* 追加请求接收端相关方法 *********/
// 追加请求 RPC 接收入口
func (rf *Raft) AppendEntries(args *AppendEntriesArgs, reply *AppendEntriesReply) {
    msg := AppendEntriesMsg{
        req: args,
        ok:  make(chan AppendEntriesReply),
    }
    rf.appendEntriesChan <- msg
    resp := <-msg.ok
    *reply = resp
}

// 主协程处理追加请求
func (rf *Raft) handleAppendEntries(msg AppendEntriesMsg) {
    rf.Status = Follower
    resetTimer(rf.electionTimer, RandomizedElectionTimeout())
    rf.rpcTermCheck(msg.req.Term)
    msg.ok <- AppendEntriesReply{
        Term: rf.CurrentTerm,
    }
}
```

Finally, the sender only needs to check the response's term, reusing `rpcTermCheck()`:

```go
// 主协程处理追加请求返回结果
func (rf *Raft) handleAppendEntriesRes(msg AppendEntriesResMsg) {
    resp := msg.resp
    rf.rpcTermCheck(resp.Term)
}
```
