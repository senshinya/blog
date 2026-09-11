---
authorship: human-only
title: "MYDB 9. Field and Table Management"
description: "The Table Manager (TBM) manages field and table structures. Parser turns SQL-like statements into structured representations, wrapping their information in the corresponding classes to simplify subsequent operations. This chapter also covers MYDB’s SQL syntax as a foundation for understanding the management process."
date: 2021-12-25 15:44:00
categories: [projects]
tags: ["MYDB","Java","SQL parsing","Table management"]
image: "https://blog-img.774352199.xyz/zOMyv5.webp"
seoDescription: "Build MYDB’s SQL parser and table manager, storing field and table metadata, resolving indexed WHERE ranges, and updating the table-list head with Booter."
---

The code in this chapter is in [backend/parser](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/parser) and [backend/tbm](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/tbm).

### Introduction

This chapter outlines the implementation of TBM, the Table Manager, which manages field and table structures. It also briefly introduces the parsing of MYDB’s SQL-like statements.

### The SQL Parser

Parser performs structured parsing of SQL-like statements, packaging their information into classes corresponding to each statement type. These classes live in the top.guoziyang.mydb.backend.parser.statement package.

MYDB implements the following SQL syntax:

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

Tokenizer in the parser package processes a statement byte by byte, splitting it into tokens according to whitespace and the lexical rules above. It exposes `peek()` and `pop()` to make retrieving tokens for parsing convenient. I will not go into the tokenization implementation here.

Parser exposes a `Parse(byte[] statement)` method. It uses Tokenizer to split the input, then follows the lexical rules to build and return a specific Statement object. The parsing process is simple: distinguish the statement type by its first token and handle each type separately. I will leave the details there.

Compiler design says lexical analysis ought to use an automaton, but hey, this works.

### Managing Fields and Tables

Field and table management here means managing structural data—table names, field information, indexes, and so on—rather than the values of individual fields in each record.

Since TBM builds on VM, each field’s metadata and each table’s metadata are stored directly in Entries. A field has this binary representation:

```
[FieldName][TypeName][IndexUid]
```

FieldName, TypeName, and the table names introduced below are all strings stored as bytes. We define a string storage format here so their boundaries are unambiguous.

```
[StringLength][StringData]
```

TypeName specifies the field’s type, limited to int32, int64, and string. If the field has an index, IndexUID points to the root of its binary-tree index; otherwise IndexUID is 0.

Given this structure, we can read and parse a field from VM by UID as follows:

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

Creating a field is similar: persist the relevant information through VM:

```java
private void persistSelf(long xid) throws Exception {
    byte[] nameRaw = Parser.string2Byte(fieldName);
    byte[] typeRaw = Parser.string2Byte(fieldType);
    byte[] indexRaw = Parser.long2Byte(index);
    this.uid = ((TableManagerImpl)tb.tbm).vm.insert(xid, Bytes.concat(nameRaw, typeRaw, indexRaw));
}
```

A database contains multiple tables. TBM organizes them into a linked list, with each table storing the UID of the next. A table has this binary structure:

```
[TableName][NextTable]
[Field1Uid][Field2Uid]...[FieldNUid]
```

Because each Entry’s data has a known byte length, there is no need to store the number of fields. Reading table data from an Entry by UID is similar to reading a field.

An important step in field and table operations is calculating the range for a Where condition. MYDB currently supports only two conditions joined by AND or OR. For a conditional Delete, for example, evaluating Where ultimately means collecting every UID within the condition’s range. MYDB only allows indexed fields in Where conditions. For the range calculations, see Table’s `parseWhere()` and `calWhere()` methods and Field’s `calExp()`.

Since TBM links Table structures in a list, it must save the head of that list: the UID of the first table. This lets MYDB quickly find the table information at startup.

MYDB uses Booter and a bt file to manage startup information, though currently the only item needed is the first table’s UID. Booter exposes load and update and guarantees atomicity. Rather than changing the bt file directly, update first writes the new contents to a bt_tmp file and then renames that file to bt. The intention is to make the operation atomic by relying on the operating system’s atomic file rename.

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

TBM exposes its services through the TableManager interface:

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

TableManager is called directly by the outermost Server layer—MYDB uses a client/server architecture—so its methods directly return execution results, such as error messages or byte arrays containing human-readable result text.

The individual methods are simple wrappers around VM operations, so I will not explain each one. One small point worth mentioning: new tables are inserted at the head of the list, so every table creation must update the Booter file.
