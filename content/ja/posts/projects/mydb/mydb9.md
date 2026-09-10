---
authorship: human-only
title: "MYDB 9. フィールドとテーブルの管理"
description: "テーブルマネージャー（TBM）は、フィールドとテーブルの構造を管理します。ParserはSQL風の文を構造化して解析し、文に含まれる情報を対応するクラスへまとめることで、その後の操作を簡単にします。この章ではMYDBのSQL構文も紹介し、管理処理全体を理解する土台を作ります。"
date: 2021-12-25 15:44:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/zOMyv5.webp"
---

この章で扱うコードは[backend/parser](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/parser)と[backend/tbm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/tbm)にあります。

### はじめに

今回は、フィールド構造とテーブル構造を管理するTBM、つまりテーブルマネージャーの実装を概説します。また、MYDBで使うSQL風の文の解析も簡単に紹介します。

### SQLパーサー

ParserはSQL風の文を構造化して解析し、文に含まれる情報を、文の種類に対応するクラスへまとめます。これらのクラスはtop.guoziyang.mydb.backend.parser.statementパッケージにあります。

MYDBが実装するSQL構文は次のとおりです。

```
<begin statement>
    begin [isolation level (read committedrepeatable read)]
        begin isolation level read committed

<commit statement>
    commit

<abort statement>
    abort

<create statement>
    create table <table name>
    <field name> <field type>
    <field name> <field type>
    ...
    <field name> <field type>
    [(index <field name list>)]
        create table students
        id int32,
        name string,
        age int32,
        (index id name)

<drop statement>
    drop table <table name>
        drop table students

<select statement>
    select (*<field name list>) from <table name> [<where statement>]
        select * from student where id = 1
        select name from student where id > 1 and id < 4
        select name, age, id from student where id = 12

<insert statement>
    insert into <table name> values <value list>
        insert into student values 5 "Zhang Yuanjia" 22

<delete statement>
    delete from <table name> <where statement>
        delete from student where name = "Zhang Yuanjia"

<update statement>
    update <table name> set <field name>=<value> [<where statement>]
        update student set name = "ZYJ" where id = 5

<where statement>
    where <field name> (><=) <value> [(andor) <field name> (><=) <value>]
        where age > 10 or age < 3

<field name> <table name>
    [a-zA-Z][a-zA-Z0-9_]*

<field type>
    int32 int64 string

<value>
    .*
```

parserパッケージのTokenizerは、文を1バイトずつ解析し、空白や上記の字句規則に従って複数のトークンに分割します。解析時にトークンを取り出しやすいよう、`peek()`と`pop()`を提供します。分割処理の詳細は省きます。

Parserは`Parse(byte[] statement)`を直接公開します。中心となる処理は、Tokenizerでトークンに分け、字句規則に従って具体的なStatementクラスにまとめて返すことです。解析自体は単純で、最初のトークンから文の種類を判定し、それぞれを処理します。詳しい説明は省きます。

コンパイラ設計の原則では、字句解析にはオートマトンを書くべきなのでしょうけど、まあ、動かないわけではありません。

### フィールドとテーブルの管理

ここで管理するのは、各レコードのフィールド値などではありません。テーブル名、フィールド情報、フィールドのインデックスといった、テーブルとフィールドの構造データです。

TBMはVMの上にあるため、個々のフィールド情報とテーブル情報はEntryへ直接保存します。フィールドのバイナリー表現は次のとおりです。

```
[FieldName][TypeName][IndexUid]
```

FieldNameとTypeName、それに後で出てくるテーブル名は、文字列をバイト列として保存します。境界を明確にするため、ここで文字列の保存形式を定めます。

```
[StringLength][StringData]
```

TypeNameはフィールドの型で、int32、int64、stringに限定します。インデックスがあればIndexUIDがインデックスの二分木のルートを指し、なければ0になります。

この構造に従い、UIDを使ってVMから読み出して解析します。

```java
public static Field loadField(Table tb, long uid) {
    byte[] raw = null;
    try {
        raw = ((TableManagerImpl)tb.tbm).vm.read(TransactionManagerImpl.SUPER_XID, uid);
    } catch (Exception e) {
        Panic.panic(e);
    }
    assert raw != null;
    return new Field(uid, tb).parseSelf(raw);
}

private Field parseSelf(byte[] raw) {
    int position = 0;
    ParseStringRes res = Parser.parseString(raw);
    fieldName = res.str;
    position += res.next;
    res = Parser.parseString(Arrays.copyOfRange(raw, position, raw.length));
    fieldType = res.str;
    position += res.next;
    this.index = Parser.parseLong(Arrays.copyOfRange(raw, position, position+8));
    if(index != 0) {
        try {
            bt = BPlusTree.load(index, ((TableManagerImpl)tb.tbm).dm);
        } catch(Exception e) {
            Panic.panic(e);
        }
    }
    return this;
}
```

フィールドの作成も同様で、関連する情報をVMで永続化すれば十分です。

```java
private void persistSelf(long xid) throws Exception {
    byte[] nameRaw = Parser.string2Byte(fieldName);
    byte[] typeRaw = Parser.string2Byte(fieldType);
    byte[] indexRaw = Parser.long2Byte(index);
    this.uid = ((TableManagerImpl)tb.tbm).vm.insert(xid, Bytes.concat(nameRaw, typeRaw, indexRaw));
}
```

データベースには複数のテーブルがあるため、TBMはそれらを連結リストで管理します。各テーブルは次のテーブルを指すUIDを持ちます。テーブルのバイナリー構造は次のとおりです。

```
[TableName][NextTable]
[Field1Uid][Field2Uid]...[FieldNUid]
```

各Entryのデータのバイト数はわかっているので、フィールド数を保存する必要はありません。UIDを使ってEntryからテーブルを読み出す処理は、フィールドの場合と同様です。

テーブルやフィールドの操作では、Where条件の範囲計算が重要になります。現在のMYDBで扱えるWhereは、2つの条件をANDまたはORで結ぶものだけです。たとえば条件付きDeleteでは、Whereを計算し、最終的に条件の範囲内にあるすべてのUIDを取得する必要があります。Where条件に使えるのはインデックス付きのフィールドだけです。範囲計算の詳細は、Tableの`parseWhere()`と`calWhere()`、Fieldの`calExp()`を参照してください。

TBMはTable構造を連結リストでつないで管理するため、リストの先頭、つまり最初のテーブルのUIDを保存しなければなりません。これでMYDBの起動時にテーブル情報をすぐに見つけられます。

MYDBはBooterクラスとbtファイルで起動情報を管理します。もっとも、現在必要なのは先頭テーブルのUIDだけです。Booterはloadとupdateを公開し、そのアトミック性を保証します。updateはbtファイルを直接変更せず、まずbt_tmpファイルへ内容を書き込み、それをbtにリネームします。OSのファイルリネームのアトミック性によって、操作全体のアトミック性を確保しようという方法です。

```java
public void update(byte[] data) {
    File tmp = new File(path + BOOTER_TMP_SUFFIX);
    try {
        tmp.createNewFile();
    } catch (Exception e) {
        Panic.panic(e);
    }
    if(!tmp.canRead()  !tmp.canWrite()) {
        Panic.panic(Error.FileCannotRWException);
    }
    try(FileOutputStream out = new FileOutputStream(tmp)) {
        out.write(data);
        out.flush();
    } catch(IOException e) {
        Panic.panic(e);
    }
    try {
        Files.move(tmp.toPath(), new File(path+BOOTER_SUFFIX).toPath(), StandardCopyOption.REPLACE_EXISTING);
    } catch(IOException e) {
        Panic.panic(e);
    }
    file = new File(path+BOOTER_SUFFIX);
    if(!file.canRead()  !file.canWrite()) {
        Panic.panic(Error.FileCannotRWException);
    }
}
```

### TableManager

TBM層はTableManagerインターフェースを通して機能を提供します。

```java
public interface TableManager {
    BeginRes begin(Begin begin);
    byte[] commit(long xid) throws Exception;
    byte[] abort(long xid);

    byte[] show(long xid);
    byte[] create(long xid, Create create) throws Exception;

    byte[] insert(long xid, Insert insert) throws Exception;
    byte[] read(long xid, Select select) throws Exception;
    byte[] update(long xid, Update update) throws Exception;
    byte[] delete(long xid, Delete delete) throws Exception;
}
```

TableManagerは最外層のServerから直接呼ばれます。MYDBはC/S構成なので、これらのメソッドは、エラーメッセージや、人が読める形の結果情報を格納したバイト配列など、実行結果をそのまま返します。

各メソッドは基本的にVMの対応するメソッドを呼ぶだけで、実装も簡単なので詳しい説明は省きます。1つだけ注意点があり、新しいテーブルはリストの先頭へ挿入するため、テーブルを作るたびにBooterファイルの更新が必要です。
