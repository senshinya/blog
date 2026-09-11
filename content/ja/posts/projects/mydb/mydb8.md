---
authorship: human-only
title: "MYDB 8. インデックス管理"
description: "MYDBはB+木によるクラスタ化インデックスを実装します。IMはバージョンマネージャー（VM）を経由せず、データマネージャー（DM）と直接やり取りし、インデックスデータをデータベースファイルへ直接書き込みます。この章では二分木インデックスの構造を詳しく説明し、葉フラグ、キー数、兄弟ノードの識別子など、インデックス検索の基盤となる要素を扱います。"
date: 2021-12-24 21:01:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/f92X4o.webp"
seoDescription: "MYDBのDM上にB+木索引を実装。ノード保存、ルートUID管理、範囲検索を説明し、分裂後に親への登録が未完了でも兄弟リンクで検索を続ける仕組みと復旧を扱います。"
---

この章で扱うコードはすべて[backend/im](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/im)にあります。

### はじめに

IM、つまりインデックスマネージャーは、MYDBにB+木によるクラスタ化インデックスを提供します。現在のMYDBはインデックスによる検索だけに対応しており、フルテーブルスキャンはできません。興味がある方は実装してみてください。

依存関係図のとおり、IMはVMを経由せず、DMを直接利用します。インデックスデータはバージョン管理を通さず、データベースファイルへ直接挿入します。

今回はB+木のアルゴリズム自体には深入りせず、実装を中心に説明します。

### 二分木インデックス

二分木は複数のNodeで構成され、それぞれを1つのDataItemに保存します。構造は次のとおりです。

```
[LeafFlag][KeyNumber][SiblingUid]
[Son0][Key0][Son1][Key1]...[SonN][KeyN]
```

LeafFlagは葉ノードかどうか、KeyNumberはノード内のキー数、SiblingUidはDMに保存された兄弟ノードのUIDを表します。その後には子ノード（SonN）とKeyNが交互に並びます。検索しやすくするため、最後のKeyNは常にMAX_VALUEとします。

Nodeクラスは、所属するB+木、DataItem、SubArrayへの参照を持ち、データの変更や解放を素早く行えるようにします。

```java
public class Node {
    BPlusTree tree;
    DataItem dataItem;
    SubArray raw;
    long uid;
    ...
}
```

ルートノードのデータは、次のように生成できます。

```java
static byte[] newRootRaw(long left, long right, long key)  {
    SubArray raw = new SubArray(new byte[NODE_SIZE], 0, NODE_SIZE);
    setRawIsLeaf(raw, false);
    setRawNoKeys(raw, 2);
    setRawSibling(raw, 0);
    setRawKthSon(raw, left, 0);
    setRawKthKey(raw, key, 0);
    setRawKthSon(raw, right, 1);
    setRawKthKey(raw, Long.MAX_VALUE, 1);
    return raw.raw;
}
```

初期状態の2つの子ノードはleftとright、初期キーはkeyです。

同様に、空のルートノードのデータを生成します。

```java
static byte[] newNilRootRaw()  {
    SubArray raw = new SubArray(new byte[NODE_SIZE], 0, NODE_SIZE);
    setRawIsLeaf(raw, true);
    setRawNoKeys(raw, 0);
    setRawSibling(raw, 0);
    return raw.raw;
}
```

Nodeには、B+木の挿入と検索を補助するsearchNextとleafSearchRangeという2つのメソッドがあります。

searchNextはkeyに対応するUIDを探し、見つからなければ兄弟ノードのUIDを返します。

```java
public SearchNextRes searchNext(long key) {
    dataItem.rLock();
    try {
        SearchNextRes res = new SearchNextRes();
        int noKeys = getRawNoKeys(raw);
        for(int i = 0; i < noKeys; i ++) {
            long ik = getRawKthKey(raw, i);
            if(key < ik) {
                res.uid = getRawKthSon(raw, i);
                res.siblingUid = 0;
                return res;
            }
        }
        res.uid = 0;
        res.siblingUid = getRawSibling(raw);
        return res;
    } finally {
        dataItem.rUnLock();
    }
}
```

leafSearchRangeは現在のノードで[leftKey, rightKey]の範囲検索を行います。rightKeyがノード内の最大キー以上なら、次のノードの検索を続けられるよう、兄弟ノードのUIDも返すことにします。

```java
public LeafSearchRangeRes leafSearchRange(long leftKey, long rightKey) {
    dataItem.rLock();
    try {
        int noKeys = getRawNoKeys(raw);
        int kth = 0;
        while(kth < noKeys) {
            long ik = getRawKthKey(raw, kth);
            if(ik >= leftKey) {
                break;
            }
            kth ++;
        }
        List<Long> uids = new ArrayList<>();
        while(kth < noKeys) {
            long ik = getRawKthKey(raw, kth);
            if(ik <= rightKey) {
                uids.add(getRawKthSon(raw, kth));
                kth ++;
            } else {
                break;
            }
        }
        long siblingUid = 0;
        if(kth == noKeys) {
            siblingUid = getRawSibling(raw);
        }
        LeafSearchRangeRes res = new LeafSearchRangeRes();
        res.uids = uids;
        res.siblingUid = siblingUid;
        return res;
    } finally {
        dataItem.rUnLock();
    }
}
```

B+木は挿入や削除で動的に変化し、ルートノードも固定ではありません。そのためbootDataItemを設け、そこにルートのUIDを保存します。なお、IMがDMを操作するときのトランザクションは、すべてSUPER_XIDです。

```java
public class BPlusTree {
    DataItem bootDataItem;

    private long rootUid() {
        bootLock.lock();
        try {
            SubArray sa = bootDataItem.data();
            return Parser.parseLong(Arrays.copyOfRange(sa.raw, sa.start, sa.start+8));
        } finally {
            bootLock.unlock();
        }
    }

    private void updateRootUid(long left, long right, long rightKey) throws Exception {
        bootLock.lock();
        try {
            byte[] rootRaw = Node.newRootRaw(left, right, rightKey);
            long newRootUid = dm.insert(TransactionManagerImpl.SUPER_XID, rootRaw);
            bootDataItem.before();
            SubArray diRaw = bootDataItem.data();
            System.arraycopy(Parser.long2Byte(newRootUid), 0, diRaw.raw, diRaw.start, 8);
            bootDataItem.after(TransactionManagerImpl.SUPER_XID);
        } finally {
            bootLock.unlock();
        }
    }
}
```

IMが上位に提供する主な機能は、インデックスの挿入とノード検索の2つです。B+木の挿入・検索のアルゴリズムと実装の詳しい説明は省きます。

IMがインデックスの削除を提供しないことを不思議に思うかもしれません。上位モジュールがVMでEntryを削除するとき、実際にはXMAXを設定します。対応するインデックスを消さなくても、その後Entryを読もうとすると、インデックス経由では見つかるものの、XMAXが設定済みなので適切なバージョンを取得できず、内容が見つからないというエラーを返します。

### 起こり得るエラーと復旧

B+木の操作では、ノード内部のエラーと、ノード間の関係のエラーという2種類が考えられます。

ノード内部のエラーとは、Tiがノードのデータを変更している途中でMYDBがクラッシュする場合です。IMはDMに依存しているので、再起動後にTiがundoされ、ノードへの誤った影響は取り除かれます。

ノード間のエラーは、次の形で発生します。ノードuへの挿入で新しいノードvが作られ、sibling(u)=vになったものの、vが親ノードへまだ挿入されていない状態です。

```
[parent]
    
    v
   [u] -> [v]
```

正しい状態は次のようになります。

```
[ parent ]
       
 v      v
[u] -> [v]
```

この場合も、挿入や検索がそのノードで失敗すれば、兄弟ノードをたどって処理を続けるので、最終的にはvを見つけられます。欠点は、親から直接vへ行けず、uを経由して間接的に到達することだけです。

今日は12月25日、クリスマスです。Happy Xmas！
