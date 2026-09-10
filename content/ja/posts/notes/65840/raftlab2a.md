---
authorship: human-only
title: "6.5840 Lab 2A：リーダー選出"
description: "Lab 2Aでは、Raftのリーダー選出とハートビートを実装し、さまざまな厳しい条件でも任期の交代や選挙が正常に行われるようにします。実習全体は4段階からなり、この後に実装する分散KVストアの土台になります。明示的なロックを使わない設計によって、Raft構造体を簡潔にします。実習の手引きには必要な背景知識が載っていますが、前の実習と比べると参考資料に頼れる部分はほとんどなく、自力で実装することが重視されます。"
date: 2022-12-16 02:06:10
categories: [notes]
tags: ["raft", "6.5840", "6.824"]
image: "https://blog-img.774352199.xyz/c11Uk4.webp"
---

### はじめに

6.824のLab 2は、Raftアルゴリズムを実装する課題です。後の課題で作る分散KVストアは、このRaftを合意モジュールとして使うので、とても重要な土台になります。

Lab 2ではRaft全体を4段階に分け、それぞれを小課題として実装します。Lab 2Aで扱うのは基本的なリーダー選出とハートビートだけで、切断などの厳しい状況でも任期の交代と選挙が動くようにします。

もちろん、4つの小課題の出発点なので、リーダー選出だけでなく全体の処理基盤も作る必要があります。今回も明示的なロックを使わない版を実装します。Raft構造体のmu変数、消してしまいましょう！ ちょっとおかしなテンションになってきました。

### 課題を読む

説明書は[https://pdos.csail.mit.edu/6.824/labs/lab-raft.html](https://pdos.csail.mit.edu/6.824/labs/lab-raft.html)にあります。Lab 1と違い、今回は参考になる実装がほとんどありません。実装するのは`src/raft/raft.go`で、Raft構造体もごく基本的な骨組みだけです。

```go
type Raft struct {
    peers []*labrpc.ClientEnd // RPC end points of all peers
    persister *Persister // Object to hold this peer's persisted state
    me int // this peer's index into peers[]
    dead int32 // set by Kill()
}
```

Raft構造体1つがクラスタ内のサーバー1台を表し、そのサーバーに必要な情報をすべて保持します。

peersは現在のクラスタ構成に含まれる全サーバーです。ClientEndのCallを呼べば、直接RPCを送れます。meはクラスタ内での自分の一意なインデックスで、ほかのマシンもこの値で識別します。

Lab 2Aの入口は`Make()`です。構造体を初期化した後、`rf.ticker()`をgoroutineとして起動します。この中で無限ループを回します。厳密には終了フラグを見るループですが、シャットダウン後のことはここでは気にしないので、無限ループと考えて構いません。これをメインのgoroutineとします。

Lab 2が難しいのは、フレームワーク側の実装が少なく、Raft全体をほぼゼロから作る必要があることです。幸い、論文のFigure 2に全体の実装方針がほぼ示されています。

テストは同じディレクトリの`test_test.go`にあります。通らない場合はテストの実装を読み、そのシナリオを手がかりにデバッグできます。

Lab 2Dのテストコマンドは`go test -run 2A`です。データ競合も同時に検出できる`go test -race -run 2A`をおすすめします。

### 実装の考え方

#### 全体の流れ

明示的なロックを使わないため、最初に処理の流れとgoroutine間の通信を丁寧に設計します。シリーズ最初の課題なので、ここで基盤を整えておくと後の課題にも役立ちます。

まず、`rf.ticker()`をメインのgoroutineと決めます。Raft構造体のフィールドを書き換えられるのはこのgoroutineだけとし、ほかからの変更は禁止します。これでデータ競合を避けられます。したがって`ticker()`は、複数のchannelからのメッセージを無限ループで待ち受ける形になります。

では、どのgoroutineと通信し、どんなchannelが必要でしょうか。選挙で使うRPCはAppendEntriesとRequestVoteの2種類です。受信側では、最初にRPCを受け取るのはメイン以外のgoroutineなので、メインへ渡すchannelが2つ必要です。送信側も、RPCの応答待ちでメインを止めるわけにはいかないため、別のgoroutineで送ります。この2種類のRPCの応答をメインへ返すために、さらに2つのchannelが要ります。

加えて、選挙タイムアウト用とハートビート用の2つのタイマーが必要です。説明書では、`time.Sleep()`で一定時間待つ方法が勧められています。ただ、この方法ではカウントダウンを中断できません。そこで、説明書では非推奨の`time.Timer`を、反抗して使うことにしました。中断とリセットをしたかったからです。とはいえ、Timerを正しく使うのは本当に難しいです。

まず、サーバーの役割を示す状態を定義します。

```go
type ServerStatus uint8
 
const (
    Follower  ServerStatus = 0
    Candidate ServerStatus = 1
    Leader    ServerStatus = 2
)
```

Raft論文のFigure 2に合わせて基本フィールドを定義し、先ほどのchannelとタイマーも追加します。

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

channelとタイマーは、すべて`Make()`で初期化する必要があります。nilのchannelは読み書きがブロックされるので注意してください。関数が戻る前にメインのgoroutineを起動し、channelのメッセージを待ち受けます。

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

#### 2つのタイマー

electionTimerは選挙タイムアウト用です。クラスタ全体が同時にタイムアウトしないよう、毎回ランダムな時間で初期化します。ここでは300〜450msにしています。heartbeatTimerはハートビート用で、固定の100msです。

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

選挙タイマーは主にリーダー以外が使います。リーダーからハートビートを受け取るたびにリセットし、一定時間何も届かなければ選挙を始めます。手順は次のとおりです。

1. 現在の任期を1増やす。
2. 候補者になり、自分に投票する。
3. ほかのマシンにRequestVoteを送る。

実装はこちらです。

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

ElectionMetaには、この選挙の任期と賛成・反対票の数を保存します。メインのgoroutineで全マシンの投票を待つことはできないので、マシンごとにgoroutineを立ててRequestVoteを管理します。応答を受け取ったらchannelでメインへ知らせます。また、選挙を始めた後は選挙タイマーをリセットします。

ハートビートタイマーは主にリーダーが使い、自身の役割を維持します。タイマーが切れるたびにクラスタへハートビートを送り、新たな選挙が始まらないようにします。送信後はこちらのタイマーもリセットします。

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

ハートビートにはAppendEntries RPCを流用します。ほかのマシンとのRPC通信は、同様に個別のgoroutineで処理します。

#### RequestVoteの処理

選挙タイマーが切れると、リーダー以外のマシンは新たな選挙を始めます。前述の`StartElection()`では、各マシンへのRequestVoteを管理するgoroutineを起動しました。その送信関数はこちらです。

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

特別な処理はありません。RPCを送り、結果を包んでchannel経由でメインへ渡すだけです。リクエストと応答の構造体を定義します。

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

受信側の入口はRequestVoteメソッドです。RPCを受け取るgoroutineはメインではないので、ここでもchannelを使って投票要求をメインへ渡します。

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

賛成票を投じた場合は、選挙タイマーもリセットします。`rpcTermCheck()`は、RPCのリクエストや応答に含まれる任期が自身より大きいかを調べる共通処理です。大きければ任期を更新し、フォロワーになります。

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

投票要求を送ったgoroutineは、応答を受け取ると結果をメインへ渡します。メイン側で票を数え、選挙結果を判断します。

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

最初に2つ確認します。現在のサーバーが候補者ではない、または現在の任期と投票の任期が一致しないなら、過去の選挙に対する応答なので、そのまま戻ります。

賛成票なら、賛成の数が過半数に達したかを確認します。達していれば当選です。候補者はリーダーになり、ハートビートタイマーをリセットして、全マシンへハートビートを送り、リーダーになったことを知らせます。

反対票の場合には、ちょっとした最適化を入れています。反対が過半数を超えたら、この選挙は失敗と判断できます。この実装では、その任期の投票先を-1に戻し、ほかの候補者へ投票できるようにして、リーダー選出を早めています。

#### AppendEntriesの処理

この課題では、AppendEntriesはハートビートだけ処理できれば十分です。実際のログ追加はLab 2Bで実装します。

`broadcastHeartbeat()`では、AppendEntriesを使ってクラスタ全体へハートビートを送ります。各マシンへのリクエストは、それぞれのgoroutineで管理します。

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

RequestVoteと同じく、RPCを送って応答を待ち、channel経由でメインへ渡します。AppendEntriesのリクエストと応答は次の定義です。

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

受信側は、AppendEntriesをメインへ渡して処理します。現時点ではハートビートだけなので、フォロワーへの移行、選挙タイマーのリセット、必要に応じた任期の更新を行えば十分です。

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

最後に送信側の応答処理です。任期を確認するだけなので、ここでも`rpcTermCheck()`を使えます。

```go
// 主协程处理追加请求返回结果
func (rf *Raft) handleAppendEntriesRes(msg AppendEntriesResMsg) {
    resp := msg.resp
    rf.rpcTermCheck(resp.Term)
}
```
