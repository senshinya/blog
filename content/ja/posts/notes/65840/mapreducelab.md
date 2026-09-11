---
authorship: human-only
title: "6.5840 Lab 1：MapReduce"
description: "Lab 1では、masterとworkerという2つの主要な部分からなるMapReduceシステムを実装します。GoのRPCと並行プログラミングを十分に使いこなし、MapReduceの処理の流れも深く理解する必要があります。実装は2つの版を作り、mutexでロックする方式から、よりすっきりしたchannelによる明示的なロックを使わない方式へと改めました。後者のほうが設計もシンプルで分かりやすくなっています。実習を理解する鍵は、関連資料、特にフローチャートとその説明をしっかり読むことです。"
date: 2022-01-20 22:29:00
categories: [notes]
tags: ["MIT 6.5840","MapReduce","Go","RPC","並行プログラミング"]
image: "https://blog-img.774352199.xyz/ibVwPJ.webp"
seoDescription: "MIT 6.5840のMapReduce課題をGoで実装。channel経由で状態更新を一つのgoroutineに集め、RPCでの割り当て、段階の切り替え、再試行、出力ファイルを扱います。"
---

### はじめに

Lab 1の課題はMapReduceシステムの実装です。大きく分けると、masterプログラムとworkerプログラムの2つを作ります。この時点で挫折しそうになる課題です。GoのRPCや並行処理に慣れている必要があり、MapReduce全体の仕組みもしっかり理解しなければなりません。ちょっとしたコツは、論文のこの図を何度も眺め、その下の処理の説明をひたすら読み返すことです。

![MapReduceの実行フロー](https://blog-img.774352199.xyz/2025/6f7e7839e6f09e0d8193d530920a6f7e.jpg)

この課題では、並行処理の制御方法を変えて2つの版を実装しました。最初はmutexを使い、その後、明示的なロックを使わずchannelで制御する版に書き直しました。後者のほうがすっきりしているので、主にこちらを説明します。

### 課題を読む

実装する前に、まず課題の内容を理解します。説明書は[https://pdos.csail.mit.edu/6.824/labs/lab-mr.html](https://pdos.csail.mit.edu/6.824/labs/lab-mr.html)にあります。プロセス間通信にUnixソケットを使うため、基本的にはLinux環境で行う課題です。macOSでも原理的には動きますが、少し問題が出ることもあるそうです。

配布コードには、シングルスレッドで逐次実行するMapReduceが用意されています。`src/main/mrsequential.go`です。全体の流れをつかめるので、先に一度読んでおくとよいです。処理の一部は、そのままコピーして使うこともできます。

並列版のmasterのエントリーポイントは`main/mrcoordinator.go`、workerは`main/mrworker.go`です。実装するファイルは`mr/coordinator.go`、`mr/worker.go`、`mr/rpc.go`の3つで、それぞれmasterの処理、workerの処理、両者の通信に使うRPC構造体を記述します。

mrcoordinatorは`mr/coordinator.go`のMakeCoordinatorを呼び、masterの構造体を作ってソケットの待ち受けを開始します。この関数が戻ると、メインのgoroutineはCoordinator.Doneを繰り返し呼び、MapReduce全体の完了を確認してから終了します。そのため、MakeCoordinator内で関数が戻らなくなるような処理をすると、後続の処理が止まってしまいます。**待ち受けなどの処理は、新しいgoroutineで動かす必要があります。**

mrworkerは単純です。メインのgoroutineが`mr/worker.go`のWorker関数を呼ぶだけなので、ここに処理を書けばよく、通常は1つのgoroutineで実装できます。

テストスクリプトは`src/main/test-mr.sh`です。用意されているwcとindexerという2つのMapReduceプログラムを自作のフレームワークで実行し、逐次実行版の結果と比較します。同じMapまたはReduceタスクを並列に実行した場合や、workerが実行中にクラッシュした場合にも、正しい結果が出るか確認します。通常はmasterを1プロセス、workerを3プロセス起動します。実行中にエラーが起きて終了できなくなったら、`ps -A`でmrcoordinatorのPIDを探してkillします。普通に`ctrl + c`を押すだけでは終了しきれず、次のテストに影響することがあります。

最後に、課題の説明書は何度か読み返しましょう。

### 実装の考え方

#### 全体の流れ

まずworkerがmapタスクをすべて実行し、「mr-X-Y」という中間ファイルを多数生成します。XはmapタスクのID、Yは対応するreduceタスクのIDです。続いてreduceタスクは、Yが自分のIDと一致するファイルをすべて集め、読み込んでreduce処理を行い、結果を「mr-out-Y」に出力します。

#### masterの実装

##### 明示的なロックを使わない設計

複数のgoroutineによるデータ競合をロックなしで避けるため、主要なデータ構造への操作を1つのgoroutineに集約します。ここではこれをスケジューラーgoroutineと呼びます。workerがタスクの取得や完了報告などのRPCリクエストをmasterに送ると、masterは自動生成されたgoroutineでそのリクエストを処理します。ただし、主要なデータ構造を操作できるのはスケジューラーだけです。そこでRPCのgoroutineはchannelを介して処理を依頼します。こうすればデータ競合を防げます。workerとmasterの間には複数のメッセージ種別があるため、スケジューラーは複数のchannelを同時に扱う必要があります。ここでGoのselectが使えます。

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

workerが実行するタスクを求めてmasterのGetTaskを呼んだとします。GetTaskの処理は次のようになります。

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

getTaskChanに渡すメッセージには、respだけでなく、chan struct{}型のchannelも入れています。getTaskにはリクエストパラメーターが不要です。このchannelは、スケジューラーがRPCのgoroutineに処理完了を知らせるためのものです。処理が終わってmsg.okにstruct{}を書き込むと、RPCのgoroutineが戻れるようになります。

##### Coordinator

Coordinator全体の構造は次のとおりです。

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

phaseは現在の実行フェーズを記録します。すべてのmapタスクが終わるまでreduceタスクを始められないため、TaskPhaseはMapフェーズとReduceフェーズに分かれます。tasksスライスには、そのフェーズのタスクだけを入れます。

taskTimeOutは、現在実行中のタスクの開始時刻を記録します。別のgoroutineが定期的にこのmapを確認し、実行時間が10秒を超えたタスクをタイムアウトと判断して、未着手に戻します。これで次回のスケジューリングの対象になります。もちろん、この確認もスケジューラー経由で行います。タイムアウトのmapには現在のフェーズで実行中のタスクだけが入り、フェーズを切り替えるときに空にします。

tasksスライスには、現在のフェーズのすべてのTaskと、その状態を保存します。

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

タスクの状態は、未着手、実行中、完了の3つです。MapTaskとReduceTaskは両方保持していますが、実際にどちらを使うかは現在のフェーズで判断します。

##### 各操作の処理

Coordinatorのchannelを見ると、スケジューラーと通信して操作する場面が4つあることが分かります。

workerがタスクを要求したとき、返ってくるタスクの種別は次の4つです。

```go
type TaskType int
 
var (
    TaskType_Map    TaskType = 0
    TaskType_Reduce TaskType = 1
    TaskType_Wait   TaskType = 2
    TaskType_Exit   TaskType = 3
)
```

masterはまずtasksを走査し、未着手のタスクを探して、現在のフェーズに応じてMapまたはReduceタスクを返します。未着手のタスクがない場合は、フェーズによって処理が分かれます。Mapフェーズなら、後にReduceフェーズが控えているのでTaskType\_Waitを返して待機させます。Reduceフェーズなら、この時点ですべてのタスクは完了しているので、TaskType\_Exitを返して終了させます。

workerはタスクを終えると、タスクの種別とIDを添えてmasterに完了を通知します。masterは現在と異なるフェーズのタスクを無視し、taskIdでtasks内のタスクを探して、現在の状態にかかわらずfinishedに変更します。そのうえで、対応するtimeoutの項目を削除します。

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

Reduceフェーズですべてのタスクが終わった場合は、allDoneフラグも設定します。

Coordinatorの初期化時には、1秒ごとにスケジューラーへ依頼してtimeoutMap内のタイムアウトを確認するgoroutineも起動します。タイムアウトしたタスクは未着手に戻すことで、次にworkerがタスクを要求した際に割り当てられるようになります。

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

最後は完了状態の確認です。メインスレッドがCoordinator.Doneを呼び、スケジューラー側ではallDoneフラグを確認するだけです。

#### worker

workerは1つのgoroutineで、masterからタスクを取得して実行する処理を繰り返します。

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

mapとreduceの具体的な処理は、シングルスレッドの逐次実行版を参考にできます。注意したいのは、同じタスクを複数プロセスで同時に実行する場合や、途中でクラッシュする場合があることです。書きかけのファイルが残ると、別のworkerが再実行したときにエラーの原因になります。そこでioutil.TempFileで一時ファイルを作って書き込み、完了後にos.Renameで目的のファイル名に変更します。こうすれば、最終的な出力ファイルは必ず書き込み済みの状態になります。
