---
title: "MYDB 5. ページインデックスとDMの実装"
description: "ページインデックスはDM層の重要な構成要素です。各ページの空き容量をキャッシュすることで挿入処理を効率化し、上位モジュールが長い探索をせずに適切なページを素早く見つけられるようにします。実装ではデータ項目（DataItem）の抽象化とも密接に連携し、データベースの効率的な動作を支えます。"
date: 2021-12-11 15:16:00
categories: [projects]
tags: ["java", "mydb"]
---

この章で扱うコードは[backend/dm/pageIndex](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/pageIndex)、[backend/dm/dataItem](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/dataItem)、[backend/dm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm)にあります。

### はじめに

今回はDM層の仕上げです。シンプルなページインデックスを紹介し、DMが上位へ提供する抽象化であるDataItemも実装します。

### ページインデックス

ページインデックスは、各ページの空き容量をキャッシュします。上位モジュールが挿入するとき、ディスクやキャッシュ内の全ページを調べずに、十分な空きのあるページを素早く見つけるためのものです。

MYDBでは、ページの容量を40の区間に分ける、かなり大まかなアルゴリズムを使います。起動時に全ページの情報を走査し、空き容量に応じてこの40区間へ振り分けます。insertがページを要求するときは、必要な容量を切り上げて区間へ対応づけます。その区間からどのページを選んでも、必要な容量を満たせます。

PageIndexの実装も単純で、Listの配列です。

```java
public class PageIndex {
    // 将一页划成 40 个区间
    private static final int INTERVALS_NO = 40;
    private static final int THRESHOLD = PageCache.PAGE_SIZE / INTERVALS_NO;

    private List[] lists;
}
```

PageIndexからの取得も、区間番号を計算して取り出すだけです。

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

返されるPageInfoには、ページ番号と空き容量が入っています。

選ばれたページは、PageIndexから直接取り除かれる点に注目してください。つまり、同じページへの並行書き込みは許可しません。上位モジュールが使い終えたら、そのページをPageIndexへ戻す必要があります。

```java
public void add(int pgno, int freeSpace) {
    int number = freeSpace / THRESHOLD;
    lists[number].add(new PageInfo(pgno, freeSpace));
}
```

DataManagerを作成するときは、全ページを取得してPageIndexを埋めます。

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

Pageを使い終えたら、すぐにreleaseしてください。解放しないとキャッシュを使い切るおそれがあります。

### DataItem

DataItemは、DMが上位モジュールへ提供するデータの抽象化です。上位モジュールはアドレスを指定してDMにDataItemを要求し、その中のデータを取得します。

DataItemの実装はシンプルです。

```java
public class DataItemImpl implements DataItem {
    private SubArray raw;
    private byte[] oldRaw;
    private DataManagerImpl dm;
    private long uid;
    private Page pg;
}
```

dmへの参照を保持するのは、DataItemの解放をdmの解放処理に任せるためです。dm自体がキャッシュのインターフェースを実装し、DataItemをキャッシュしています。また、データ変更時にログを記録するためにも使います。

DataItemに保存するデータの構造は次のとおりです。

```
[ValidFlag] [DataSize] [Data]
```

ValidFlagは1バイトで、そのDataItemが有効かどうかを示します。削除するときは、有効フラグを0にするだけです。DataSizeは2バイトで、後ろに続くDataの長さを表します。

上位モジュールはDataItemを取得したら、`data()`で内容を取り出せます。返す配列はコピーではなくデータを共有するため、SubArrayを使います。

```java
@Override
public SubArray data() {
    return new SubArray(raw.raw, raw.start+OF_DATA, raw.end);
}
```

DataItemを変更するには、所定の手順を守る必要があります。変更前に`before()`を呼び、変更を取り消すなら`unBefore()`、変更が完了したら`after()`を呼びます。主な目的は、変更前イメージを保存し、適切なタイミングでログを記録することです。DMはDataItemの変更がアトミックであることを保証します。

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

`after()`は主にdmのメソッドを呼んで変更操作のログを記録します。ここでは詳しい説明を省きます。

DataItemを使い終えた後も、すぐにrelease()を呼んでキャッシュへの参照を解放します。DataItemをキャッシュするのはDMです。

```java
@Override
public void release() {
    dm.releaseDataItem(this);
}
```

### DMの実装

DataManagerはDM層のメソッドを外部へ直接提供するクラスで、DataItemオブジェクトのキャッシュでもあります。DataItemのキーは、ページ番号とページ内オフセットからなる8バイトの符号なし整数です。それぞれが4バイトを占めます。

DataItemキャッシュの`getForCache()`では、キーからページ番号を取り出し、pageCacheからページを取得して、オフセットに従ってDataItemを解析すれば十分です。

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

DataItemのキャッシュ解放では保存元への書き戻しが必要です。ただしファイルの読み書きはページ単位なので、DataItemが属するページをreleaseするだけで済みます。

```java
@Override
protected void releaseForCache(DataItem di) {
    di.page().release();
}
```

既存ファイルからDataManagerを作る場合と、空のファイルから作る場合では、手順が少し異なります。PageCacheとLoggerの作り方に加え、空のファイルでは先頭ページの初期化が必要です。既存ファイルでは先頭ページを検証し、復旧が必要か判断します。また、先頭ページのランダムなバイト列を生成し直します。

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

先頭ページの初期化と検証は、基本的にPageOneのメソッドを呼んで実現します。

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

DM層は上位に読み取り・挿入・変更という3つの機能を提供します。変更は読み出したDataItemを通じて行うため、DataManagerに必要なのは`read()`と`insert()`だけです。

`read()`はUIDに基づいてキャッシュからDataItemを取得し、有効フラグを確認します。

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

`insert()`はpageIndexから、挿入する内容を保存できるページの番号を取得します。ページを取得したら、まず挿入ログを書きます。その後にpageXでデータを挿入し、挿入位置のオフセットを返します。最後に、ページ情報をpageIndexへ戻す必要があります。

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

DataManagerを正常終了するときは、キャッシュとログを閉じます。先頭ページの検証用バイト列の設定も忘れずに。

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

これでDM層は完了です。

今日は2021年12月11日、A-SOULの1周年記念配信の日です。A-SOUL、1周年おめでとう！ 2周年も、3周年も、10周年もありますように！ 北京の「鳥の巣」スタジアムで会いましょう！！！

![](https://blog-img.774352199.xyz/2025/bee2e73291a2ecde2667bb41f2e2c5b6.jpg)

私たちは、ASOUL！
