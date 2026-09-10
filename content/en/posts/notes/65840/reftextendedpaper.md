---
title: "Reading the Raft Paper"
description: "Raft is a consensus algorithm designed to improve the efficiency of log replication. It is particularly suited to clusters of machines, allowing them to keep providing service even when some machines fail. It uses the replicated state machine model: logs record the order of commands so that every machine in the cluster can reach the same state. In Search of an Understandable Consensus Algorithm explores Raft’s design and compares it with Paxos, highlighting its understandability and providing a foundation for building reliable large-scale software systems. These reading notes aim to help explain the paper’s core concepts and their applications."
date: 2022-12-03 21:40:09
categories: [notes]
tags: ["raft", "6.5840", "6.824"]
---

### Introduction

Raft is a consensus algorithm for managing log replication. Consensus algorithms are used in clusters of multiple machines to keep services running even when some of those machines fail. That makes them important for building reliable large-scale software systems.

The main Raft paper is *In Search of an Understandable Consensus Algorithm (Extended Version)*, available [here](https://raft.github.io/raft.pdf). It's not very long, either: 18 pages. It compares Raft with Paxos throughout, opening with a fair amount of frustration, and emphasizes Raft's greatest strength: it's more understandable.

These are my notes from reading the paper.

### Background

Consensus algorithms were developed primarily for the replicated state machine model. Replicated state machines are usually implemented with replicated logs, each containing a sequence of commands. Every machine in the cluster executes those commands in the same order and eventually reaches the same state. Notice the word “eventually”: this indicates eventual rather than strong consistency.

The consensus algorithm keeps the replicated logs consistent across the cluster. Each consensus module communicates with those on other machines to ensure that all machines eventually execute the same commands in the same order, even if some machines fail. Together, the machines can then provide a service as though they were a single machine.

This discussion of consensus applies only to non-Byzantine failures: nodes do not deliberately fabricate information.

### The Algorithm

Raft can be divided into three relatively independent parts:

- Leader election: if the current leader fails, a new one must be elected.
- Log replication: the leader receives log entries from clients and replicates them across the cluster, keeping other machines' logs consistent with its own.
- Safety: once a machine accepts a particular command, another machine must not accept a different command at that same log index.

#### Raft Basics

A machine in a Raft cluster is always in one of three states:

- Leader: handles all client requests.
- Follower: does not handle client requests; passively receives and responds to requests from leaders and candidates.
- Candidate: participates in electing a leader.

During normal operation, the cluster has one leader and all other machines are followers.

Raft divides time into terms. Each term begins with an election in which one or more candidates try to become leader. If a candidate wins, it becomes the leader and the remaining machines become followers.

A term is a monotonically increasing integer. Each machine stores its current term and includes it in communications with other machines. If a machine discovers that its current term is lower than another machine's, it updates its own term. A candidate or leader that discovers a higher term, indicating a newer term, immediately becomes a follower.

Basic communication between Raft machines requires only two RPC types. RequestVote RPCs are initiated by candidates during elections; “canvassing for votes” sounds a little odd as a translation. AppendEntries RPCs are initiated by the leader to replicate logs and maintain heartbeats.

#### Leader Election

A machine starts as a follower and remains one as long as it receives appropriate RPCs. The leader periodically sends AppendEntries requests containing no commands as heartbeats to maintain its role. If a follower receives no such request for a while, it starts an election.

The follower becomes a candidate, increments its current term, votes for itself, and sends RequestVote RPCs to the other machines in parallel. It remains a candidate until one of three things happens:

1. A candidate receives votes from a majority of the cluster and wins. Each machine votes for at most one candidate in a term, on a first-come, first-served basis. This guarantees at most one winner per term. The winner becomes leader and sends heartbeats to the other machines to establish its role.
2. The candidate receives an AppendEntries request from another machine. If the request's term is greater than or equal to the candidate's current term, it becomes a follower. Otherwise, it rejects the request and remains a candidate.
3. Several followers become candidates at the same time, and none receives a majority. The candidates time out, increment their current terms, and start another election.

To keep the third case from repeating forever, election timeouts are randomized within a fixed interval, reducing the chance of simultaneous timeouts.

#### Log Replication

Each client request contains a command for the replicated state machine to execute. The leader appends the command to its log and sends AppendEntries requests to other machines in parallel to replicate it. Once replication completes, the leader commits the command to the state machine and replies to the client with success.

Besides the command to replicate, an AppendEntries request carries the term in which the leader received the command and an integer index identifying its position in the log.

The leader commits a command once it has successfully replicated it to a majority of machines. Raft guarantees that committed commands are durable and will eventually be executed by every available state machine. Committing an entry also commits all preceding entries, including those created by earlier leaders. The leader tracks the commit index and includes it in every AppendEntries request. When a follower learns that an entry has been committed, it applies that entry to its state machine as well.

Raft also needs to guarantee two properties:

- If two log entries have the same term and log index, they contain the same command.
- If two log entries have the same term and log index, all entries preceding them are identical as well.

The first is fairly straightforward; the second needs more attention.

In each AppendEntries request, the leader includes the term and index of the entry immediately preceding the new entries. If the follower cannot find a matching entry in its log, it rejects the request. This is the consistency check. A successful response therefore tells the leader that the follower's log agrees with its own.

When the consistency check fails, the leader forces the follower's log to match its own. It finds their last matching entry, removes all later entries from the follower's log, and sends its own subsequent entries. The leader maintains a nextIndex for each follower, recording the index of the next entry to send. A newly elected leader initializes every nextIndex to one past the last index in its own log. When a follower fails the check, the leader decrements that follower's nextIndex and retries AppendEntries.

> This part feels a little vague. I assume each AppendEntries request sends entries from nextIndex through the last entry. Otherwise, passing the consistency check would only trim the follower's log back to the point of agreement, without copying the leader's later entries to it.

#### Safety

The mechanism described so far does not completely guarantee safety. For example, a machine could become unreachable while the leader commits several entries, then later be elected leader and overwrite those entries. Raft adds an election restriction to prevent this. It ensures that a leader in any term contains all entries committed in preceding terms.

First, RequestVote includes information about the candidate's log. If a machine finds that its own log is more up to date than the candidate's, by comparing the last entry's term and index, it refuses the vote.

A leader commits an entry from its current term once a majority of machines has accepted it. If the leader fails while committing the entry, the next leader continues trying to replicate it. However, the new leader cannot immediately conclude that an entry from an earlier term is committed merely because it is stored on a majority of machines. This can lead to the problem shown in Figure 8 of the paper.

Raft therefore does not commit entries from earlier terms simply by counting replicas. It uses replica counts only to commit entries from the current term. Once an entry from the current term is committed, all preceding entries are committed implicitly.

#### Cluster Membership Changes

Changing cluster membership without taking the entire cluster offline can create two independent majorities, potentially allowing two leaders to be elected.

Raft uses a two-stage approach to make membership changes safe. The cluster first enters a joint consensus state. Once that configuration is committed, it switches to the new configuration. The cluster can continue serving requests during joint consensus. In this state:

- Log entries are replicated to every machine in both the old and new configurations.
- Any machine in either configuration may become leader.
- Elections and log replication require separate majorities of both the old and new configurations.

Configurations are stored and transmitted as special log entries. The process is:

1. The leader receives a request to change the configuration from C_old to C_new.
2. It stores C_old and C_new together in a log entry as the joint configuration C_old,new.
3. It appends that entry to machines in both configurations.
4. As soon as a machine adds the entry to its log, even before commitment, it uses that configuration for subsequent operations.
5. Once C_old,new has been accepted by the required majorities, the leader commits it. At this point, a leader can no longer be elected under C_old or C_new alone.
6. The leader creates a C_new log entry, replicates it to the machines, and commits it.

Three issues remain:

1. A new machine has no log and needs time to catch up, which could temporarily reduce availability. Raft adds a preliminary stage in which new machines receive AppendEntries but are not voting members, so consensus does not depend on them. Once they catch up, the configuration change proceeds as described above.
2. The leader may not belong to the new configuration. In that case, it steps down when it commits C_new. For a while, then, it manages a cluster that does not include itself: it replicates entries but does not count itself toward a majority.
3. Removed servers can disrupt the cluster. Since they no longer receive heartbeats, they may start elections and send RequestVote RPCs with higher terms, causing the current leader to become a follower. These elections cannot succeed, and a new leader will still come from the new cluster, but the removed machines can repeatedly time out and harm availability.

To prevent the third issue, Raft adds a restriction: a server that receives RequestVote before its timeout since hearing from the current leader has elapsed does not update its term or grant a vote. As long as the leader maintains heartbeats with the current cluster, a vote request with a higher term cannot unseat it.

#### Log Compaction

As the log grows, machines cannot keep all of it in memory. Snapshots periodically save the system state to persistent storage, allowing log entries up to the snapshot point to be safely removed from memory.

Each machine manages its own snapshots independently. A snapshot includes only committed entries. Besides the current state of the state machine, it stores two pieces of metadata:

- The index of the last entry included in the snapshot.
- The term of that entry.

This metadata is mainly needed for the AppendEntries consistency check, which compares the preceding log entry. To support membership changes, the snapshot must also contain the latest configuration as of its snapshot point. Once the snapshot has been written, the machine can delete the covered log entries and older snapshots.

Sometimes a leader needs to send a snapshot to a newly joined or lagging node. It uses a new RPC, InstallSnapshot, to do so:

```go
type InstallSnapshotRequest struct {
    // Term Leader 的任期
    Term              int64
    // LeaderID Follower 可以将客户端请求重定向到 Leader
    LeaderID          int64
    // LastIncludedIndex 快照包含的最后一个条目的索引
    LastIncludedIndex int64
    // LastIncludedTerm 快照包含的最后一个条目的任期
    LastIncludedTerm  int64
    // Offset 快照文件中的该快照块的偏移
    Offset            int64
    // Data 快照块数据
    Data              []byte
    // Done 是否是最后一个快照块
    Done              bool
}

type InstallSnapshotResponse struct {
    // Term Follower 当前任期
    Term    int64
}
```

The receiver proceeds as follows:

1. If Term is less than CurrentTerm, return immediately.
2. If this is the first snapshot chunk, Offset = 0, create the snapshot file.
3. Write the data at the specified offset.
4. If Done is false, return and wait for the next InstallSnapshot request.
5. If the log contains an entry matching LastIncludedIndex and LastIncludedTerm, retain all entries after it and return.
6. Discard the entire log.
7. Reset the state machine using the snapshot and adopt the configuration stored in it.

Usually, a snapshot covers entries that the receiver does not yet have. In that case, the receiver discards its log and uses the snapshot. If the receiver already has all the entries covered by the snapshot, the snapshot replaces that portion of the log, but subsequent entries must be retained.

There are also performance considerations. A machine can take a snapshot whenever its log reaches a fixed size in bytes. That threshold should be neither too large nor too small: too large makes snapshots slow to write, while too small makes them too frequent. Writing a snapshot can take a long time, since disk I/O is slow, and interfere with normal processing. Raft recommends copy-on-write so the machine can continue appending entries and serving requests while writing the snapshot to disk.

#### Client Interaction

The Raft cluster's leader handles all client requests. A client initially sends its request to an arbitrary machine. If that machine is not the leader, it rejects the request and returns the address of the leader from which it most recently received a heartbeat. If the leader fails, the request times out and the client tries another arbitrary machine.

Raft aims to provide linearizable semantics: each operation appears to happen instantaneously and is executed only once. But a leader may execute a command and fail before replying. The client then sends the request again to another leader, potentially executing it twice. The solution is for the **clients** to assign monotonically increasing unique identifiers to their commands, while the state machine records the identifier of the last executed command. If it receives a command that has already run, it immediately returns success without executing it again.

Read-only requests need not write to the log and can therefore be handled without reaching consensus for each request. But the supposed leader may already have been replaced in a newer term without knowing it, in which case a read could return stale data. Raft prevents this with two measures:

1. The leader must have up-to-date information about all committed entries. Leader completeness guarantees it has those entries, but at the beginning of its term it may not know which are committed. Raft addresses this by committing a no-op entry at the start of the term to establish the current commit information.
2. Before serving a read-only request, the leader must establish that it is still the leader. It can do so by exchanging heartbeats with a majority of the cluster before handling the request.

### Implementing the Algorithm

Figure 2 of the paper gives a very detailed implementation outline. That's why Raft is awesome! It excludes membership changes and log compaction.

#### Server State

```go
type ServerState struct {
    /***** 所有 Server 都包含的持久状态 *****/
    // CurrentTerm 机器遇到的最大的任期，启动时初始化为 0，单调递增
    CurrentTerm int64;
    // VotedFor 当前任期内投票的 Candidate ID，未投票则为 nil
    VotedFor    *int64;
    // Logs 日志条目，每个条目都包含了一条状态机指令和 Leader 接收该条目时的任期，index 从 1 开始
    Logs        []*Log;

    /***** 所有 Server 都包含的可变状态 *****/
    // CommitIndex 已知的最大的即将提交的日志索引，启动时初始化为 0，单调递增
    CommitIndex int64;
    // LastApplied 最大的已提交的日志索引，启动时初始化为 0，单调递增
    LastApplied int64;

    /******* Leader 包含的可变状态，选举后初始化 *******/
    // NextIndex 每台机器下一个要发送的日志条目的索引，初始化为 Leader 最后一个日志索引 +1
    NextIndex  []int64;
    // MatchIndex 每台机器已知复制的最高的日志条目，初始化为 0，单调递增
    MatchIndex []int64;
}
```

#### AppendEntries

```go
type AppendEntriesRequest struct {
    // Term Leader 的任期
    Term         int64
    // LeaderID Follower 可以将客户端请求重定向到 Leader
    LeaderID     int64
    // PrevLogIndex 新日志条目前一个日志条目的日志索引
    PrevLogIndex int64
    // PrevLogTerm 前一个日志条目的任期
    PrevLogTerm  int64
    // Entries 需要保存的日志条目，心跳包为空
    Entries      []*Log
    // LeaderCommit Leader 的 CommitIndex
    LeaderCommit int64
}
 
type AppendEntriesResponse struct {
    // Term Follower 当前任期
    Term    int64
    // Success Follower 包含 PrevLogIndex 和 PrevLogTerm 的日志条目为 true
    Success bool
}
```

The receiver's rules:

1. Return false if Term is less than CurrentTerm.
2. Return false if the log has no entry matching PrevLogIndex and PrevLogTerm.
3. If an existing entry has the same index as a new entry but a different term, delete that entry and everything after it.
4. Append any entries not already present in the log.
5. If LeaderCommit is greater than CommitIndex, set CommitIndex to the smaller of LeaderCommit and the index of the last new entry.

#### RequestVote

```go
type RequestVoteRequest struct {
    // Term Candidate 的任期
    Term         int64
    // CandidateId 拉票的 Candidate 的 ID
    CandidateId  int64
    // LastLogIndex Candidate 最后一条日志序列的索引
    LastLogIndex int64
    // LastLogTerm Candidate 最后一条日志序列的任期
    LastLogTerm  int64
}

type RequestVoteResponse struct {
    // Term 当前任期
    Term        int64
    // VoteGranted true 则拉票成功
    VoteGranted bool
}
```

The receiver's rules:

1. Return false if Term is less than CurrentTerm.
2. Return true if (VotedFor is nil or CandidateId) and the candidate's log is at least as up to date as the receiver's.

#### Server Rules

For all machines:

- If CommitIndex is greater than LastApplied, increment LastApplied and apply log[LastApplied] to the state machine.
- If an RPC request or response contains a Term greater than CurrentTerm, update CurrentTerm and become a follower.

For followers:

- Respond to RPCs from candidates and leaders.
- If the election timeout elapses without receiving AppendEntries from the current leader or granting a vote to a candidate, become a candidate. Note that it is *granting a vote*, not merely receiving a vote request, that matters.

For candidates:

- On becoming a candidate, start an election: increment the current term, vote for yourself, reset the election timer, and send RequestVote to all other machines.
- Become leader if a majority grants votes.
- Become a follower if AppendEntries arrives from a new leader.
- Start a new election if the election timeout elapses.

For leaders:

- On becoming leader, send empty AppendEntries to all other machines. Continue sending them when idle to prevent election timeouts.
- On receiving a client command, append it to the log and respond after it has been applied to the state machine.
- If the last log index is greater than a follower's NextIndex, send AppendEntries containing every entry from NextIndex onward. On success, update the follower's NextIndex and MatchIndex. On failure due to log inconsistency, decrement NextIndex and retry.
- If there is an N greater than CommitIndex such that a majority of MatchIndex values are at least N and entry N is from the current term, set CommitIndex to N.
