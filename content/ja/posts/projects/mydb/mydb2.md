---
title: "MYDB 2. 参照カウント方式のキャッシュ基盤と共有バイト配列"
description: "データマネージャー（DM）は上位モジュールとファイルシステムをつなぎ、ページとキャッシュを管理しながら、データの安全性と復旧を支えます。キャッシュには従来のLRUではなく参照カウント方式を採用し、汎用性と効率を高めて、この先のデータ操作の土台を作ります。"
date: 2021-11-30 23:18:00
categories: [projects]
tags: ["java", "mydb"]
---

この章で扱うコードはすべて[backend/common](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/common)にあります。

### はじめに

この章からは、MYDBの最下層のモジュールであるデータマネージャーについて見ていきます。

> DMはデータベースのDBファイルとログファイルを直接管理します。主な役割は、1）DBファイルをページ単位で管理してキャッシュすること、2）エラー発生時にログから復旧できるようログファイルを管理すること、3）DBファイルをDataItemとして抽象化して上位モジュールに提供し、そのキャッシュも行うことです。

DMの役割は、大きく2つにまとめられます。1つは上位モジュールとファイルシステムの間の抽象化層で、下に向けてはファイルを直接読み書きし、上に向けてはデータを包んで提供します。もう1つはログ機能です。

上向きにも下向きにもキャッシュを提供し、メモリ上の操作で効率を確保している点に注目してください。

### 参照カウント方式のキャッシュ基盤

#### なぜLRUではないのか？

ページ管理にもデータ項目（DataItem）の管理にもキャッシュが必要なので、ここでは汎用的なキャッシュ基盤を設計します。

ここまで読むと、「とても先進的な」LRUを使わず、なぜ参照カウント方式なのかと思うかもしれません。

まずキャッシュのインターフェースから考えます。LRUなら`get(key)`だけ用意すればよく、キャッシュがいっぱいになったときに自動的に追い出せます。ですが、こんな場面を想像してください。キャッシュがいっぱいになって、あるリソースが追い出されました。その直後、上位モジュールがリソースを保存元へ強制的に書き戻そうとします。それが、たった今追い出されたリソースでした。上位モジュールから見ると、データがキャッシュから消えています。さて、保存元への書き戻しは必要なのでしょうか。

1.  書き戻さない。いつ追い出されたのかわからず、その後データ項目が変更されたかどうかもわかりません。非常に危険です。
2.  書き戻す。追い出されたときと今のデータが同じなら、無駄な書き戻しになります。
3.  キャッシュへ戻して、次に追い出すときに書き戻す。一見解決したようですが、キャッシュはすでにいっぱいです。戻すには別のリソースを追い出す必要があり、キャッシュのスラッシングを招くおそれがあります。

もちろん、リソースの最終更新時刻と、キャッシュから追い出した時刻を記録することもできます。でも……。

> 必要もないのに存在者を増やしてはならない。――オッカムの剃刀

根本の問題は、LRUではリソースの追い出しを制御できず、上位モジュールもそれを把握できないことです。参照カウント方式なら、この問題を解決できます。上位モジュールが明示的に参照を解放し、どのモジュールもそのリソースを使っていないと確認できたときにだけ、キャッシュから追い出します。

これが参照カウント方式です。上位モジュールがリソースを使わなくなったときに参照を解放するため、`release(key)`を追加します。参照数が0になると、キャッシュからそのリソースを追い出します。

一方、キャッシュがいっぱいになっても、参照カウント方式では自動で空きを作れません。この場合は、そのままエラーにします。JVMでいきなりOOMになるようなものです。

#### 実装

`AbstractCache<T>`は抽象クラスで、具体的な処理を実装クラスに任せる2つの抽象メソッドを持ちます。

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

参照カウントなので、通常のキャッシュ機能に加えて参照数を管理します。さらに、複数スレッドに対応するため、どのリソースを保存元から取得中かも記録する必要があります。取得には比較的時間がかかるためです。そこで、次の3つのMapを使います。

```java
private HashMap<Long, T> cache;                     // 实际缓存的数据
private HashMap<Long, Integer> references;          // 资源的引用个数
private HashMap<Long, Boolean> getting;             // 正在被获取的资源
```

`get()`でリソースを取得するときは、まず無限ループに入り、キャッシュからの取得を繰り返し試みます。最初に、別のスレッドがそのリソースを保存元から取得中かを確認します。取得中なら、少し待ってまた様子を見に来ます（。

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

すでにキャッシュにあれば、そのまま返せます。参照数を1増やすのを忘れずに。なければ、キャッシュに空きがあることを確認してgettingに登録し、このスレッドが保存元から取得を始めることを示します。

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

保存元からの取得は単純で、抽象メソッドを呼ぶだけです。取得が終わったら、gettingからkeyを削除します。

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

キャッシュの解放はもっと簡単です。referencesの値を1減らし、0になったら保存元へ書き戻して、関連するキャッシュ内の管理情報をすべて削除します。

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

キャッシュには安全に閉じる機能も必要です。閉じる際は、キャッシュ内のすべてのリソースを強制的に保存元へ書き戻します。

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

これでシンプルなキャッシュ基盤ができました。ほかのキャッシュは、このクラスを継承して2つの抽象メソッドを実装すれば使えます。

### 共有バイト配列

ここで、Javaのちょっと困ったところに触れておきます。

Javaでは配列をオブジェクトとして扱い、メモリ上でもオブジェクトとして保存します。一方、CやC++、Goなどでは、配列をポインターで実装します。そのため、こんな言い方もあります。

> 本物の配列があるのはJavaだけ。

ただ、このプロジェクトにとっては、あまりうれしい話ではありません。たとえばGoなら、次のように書けます。

```go
var array1 [10]int64
array2 := array1[5:]
```

この場合、array2はarray1の5番目の要素から最後の要素までと同じメモリ領域を共有します。2つの配列の長さが違っていてもです。

Javaではこれができません。高級言語って何なんでしょうね〜。

JavaでsubArrayのような操作をしても、内部ではコピーするだけで、同じメモリ領域を共有できません。

そこで、配列の使用可能な範囲を緩く定めるSubArrayクラスを書きました。

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

正直、かなり不格好な方法ですが、今のところはこれでしのぐしかありません。別の方法をご存じなら、下のコメントで教えてください。私だって、こんな不格好に書きたいわけではないのです /(ㄒo ㄒ)/~~
