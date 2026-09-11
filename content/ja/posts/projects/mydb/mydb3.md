---
authorship: human-only
title: "MYDB 3. データページのキャッシュと管理"
description: "DMはファイルシステムをページとして抽象化し、ページ単位で読み書きとキャッシュを行います。データページのデフォルトサイズは8Kで、大量の書き込みではサイズの調整によって性能を高められます。実装済みの汎用キャッシュ基盤を使い、ここではページ構造を具体的に定義して、効率よくページを管理します。"
date: 2021-12-05 15:28:00
categories: [projects]
tags: ["MYDB","Java","データページ","キャッシュ管理"]
image: "https://blog-img.774352199.xyz/jlFC4E.webp"
seoDescription: "MYDBのデータファイルを8KBページ単位で管理。ダーティページの書き戻し、先頭ページによる異常終了検知、空き領域オフセット、挿入と復旧用の操作をJavaで実装します。"
---

この章で扱うコードは[backend/dm/pageCache](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/pageCache)と[backend/dm/page](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/dm/page)にあります。

### はじめに

今回は、DMが下位のファイルシステムを抽象化する部分を扱います。DMはファイルシステムをページとして扱い、読み書きは毎回ページ単位で行います。ファイルシステムから読み込んだデータも、ページ単位でキャッシュします。

### ページキャッシュ

多くのデータベースの設計を参考に、データページのデフォルトサイズを8Kにします。大量のデータを書き込むときの性能を高めたい場合は、この値を適度に大きくしてもかまいません。

前回、汎用的なキャッシュ基盤を実装したので、今回はそれをそのままページのキャッシュに使えます。ただし、まずページの構造を定義する必要があります。ここでいうページはメモリ上に存在するもので、ディスクに永続化済みの抽象的なページとは区別してください。

ページを次のように定義します。

```java
public class PageImpl implements Page {
    private int pageNumber;
    private byte[] data;
    private boolean dirty;
    private Lock lock;

    private PageCache pc;
}
```

pageNumberはページ番号で、**1から始まります**。dataはページが実際に持つバイトデータです。dirtyは変更済みのダーティページかどうかを示し、ダーティページはキャッシュから追い出す際にディスクへ書き戻す必要があります。また、まだ定義していないPageCacheへの参照も保持します。これにより、Pageへの参照から、そのページのキャッシュを簡単に解放できます。

ページキャッシュのインターフェースは次のとおりです。

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

ページキャッシュの実装クラスは抽象キャッシュ基盤を継承し、`getForCache()`と`releaseForCache()`を実装します。データの保存元はファイルシステムなので、`getForCache()`ではファイルから直接読み込み、Pageで包めば十分です。

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

同様に、`releaseForCache()`でページを追い出すときも、ダーティページかどうかに応じてファイルシステムへ書き戻すかを決めるだけです。

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

PageCacheはAtomicIntegerを使い、開いているデータベースファイルのページ数も記録します。この数はファイルを開く際に計算し、新しいページを作るたびに増やします。

```java
public int newPage(byte[] initData) {
    int pgno = pageNumbers.incrementAndGet();
    Page pg = new PageImpl(pgno, initData, null);
    flush(pg);  // 新建的页面需要立刻写回
    return pgno;
}
```

なお、1つのデータを複数のページにまたがって保存することはできません。この制約は後の章にも出てきます。つまり、個々のデータのサイズはデータベースのページサイズを超えられません。

### データページの管理

#### 先頭ページ

データベースファイルの先頭ページは、起動時のチェックに使うメタデータの保存など、特別な用途に使うのが一般的です。MYDBでは起動時のチェックだけに使います。起動するたびにランダムなバイト列を生成してバイトオフセット100〜107の範囲に保存し、正常終了するときに、それを先頭ページのバイトオフセット108〜115の範囲へコピーします。

そのため、起動時に先頭ページの2か所のバイト列を比較すれば、前回正常に終了したかどうかがわかります。異常終了していれば、データの復旧処理を実行します。

起動時に初期バイト列を設定します。

```java
public static void setVcOpen(Page pg) {
    pg.setDirty(true);
    setVcOpen(pg.getData());
}

private static void setVcOpen(byte[] raw) {
    System.arraycopy(RandomUtil.randomBytes(LEN_VC), 0, raw, OF_VC, LEN_VC);
}
```

終了時にバイト列をコピーします。

```java
public static void setVcClose(Page pg) {
    pg.setDirty(true);
    setVcClose(pg.getData());
}

private static void setVcClose(byte[] raw) {
    System.arraycopy(raw, OF_VC, raw, OF_VC+LEN_VC, LEN_VC);
}
```

バイト列を比較します。

```java
public static boolean checkVc(Page pg) {
    return checkVc(pg.getData());
}

private static boolean checkVc(byte[] raw) {
    return Arrays.equals(Arrays.copyOfRange(raw, OF_VC, OF_VC+LEN_VC), Arrays.copyOfRange(raw, OF_VC+LEN_VC, OF_VC+2*LEN_VC));
}
```

JDK8と互換性がないのは、この`Arrays.compare()`のようです。同等の処理に置き換えられます。

#### 通常ページ

MYDBの通常のデータページ管理は単純です。ページの先頭には、そのページの空き領域のオフセットを表す2バイトの符号なし整数を置き、残りに実際のデータを保存します。

したがって、通常ページの管理は基本的にFSO（Free Space Offset）の操作が中心になります。たとえば、ページにデータを挿入する処理です。

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

書き込む前にFSOを取得して書き込み位置を決め、書き込んだ後にFSOを更新します。FSOの操作は次のとおりです。

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

残る`recoverInsert()`と`recoverUpdate()`は、クラッシュ後にデータベースを開き直した際、復旧処理がデータを直接挿入・更新するためのメソッドです。

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
