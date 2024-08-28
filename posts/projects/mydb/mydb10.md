---
title: 10. 服务端客户端的实现及其通信规则
date: 2021-12-25T18:26:00+08:00
category: mydb
tags: ["java", "mydb"]
---

本章涉及代码都在 [https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/server](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/server) 、 [https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/client](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/client) 与 [https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/transport](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/transport) 中。

### 前言

NYDB 被设计为 C/S 结构，类似于 MySQL。支持启动一个服务器，并有多个客户端去连接，通过 socket 通信，执行 SQL 返回结果。

### C/S 通信

MYDB 使用了一种特殊的二进制格式，用于客户端和服务端通信。当然如果嫌麻烦的话，其实直接用明文也不是不可以。

传输的最基本结构，是 Package：

```java
public class Package {
    byte[] data;
    Exception err;
}
```

每个 Package 在发送前，由 Encoder 编码为字节数组，在对方收到后同样会由 Encoder 解码成 Package 对象。编码和解码的规则如下：

```
[Flag][data]
```

若 flag 为 0，表示发送的是数据，那么 data 即为这份数据本身；如果 flag 为 1，表示发送的是错误，data 是 Exception.getMessage() 的错误提示信息。如下：

```java
public class Encoder {
    public byte[] encode(Package pkg) {
        if(pkg.getErr() != null) {
            Exception err = pkg.getErr();
            String msg = "Intern server error!";
            if(err.getMessage() != null) {
                msg = err.getMessage();
            }
            return Bytes.concat(new byte[]{1}, msg.getBytes());
        } else {
            return Bytes.concat(new byte[]{0}, pkg.getData());
        }
    }

    public Package decode(byte[] data) throws Exception {
        if(data.length < 1) {
            throw Error.InvalidPkgDataException;
        }
        if(data[0] == 0) {
            return new Package(Arrays.copyOfRange(data, 1, data.length), null);
        } else if(data[0] == 1) {
            return new Package(null, new RuntimeException(new String(Arrays.copyOfRange(data, 1, data.length))));
        } else {
            throw Error.InvalidPkgDataException;
        }
    }
}
```

编码之后的信息会通过 Transporter 类，写入输出流发送出去。为了避免特殊字符造成问题，这里会将数据转成十六进制字符串（Hex String），并为信息末尾加上换行符。这样在发送和接收数据时，就可以很简单地使用 BufferedReader 和 Writer 来直接按行读写了。

```java
public class Transporter {
    private Socket socket;
    private BufferedReader reader;
    private BufferedWriter writer;

    public Transporter(Socket socket) throws IOException {
        this.socket = socket;
        this.reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        this.writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()));
    }

    public void send(byte[] data) throws Exception {
        String raw = hexEncode(data);
        writer.write(raw);
        writer.flush();
    }

    public byte[] receive() throws Exception {
        String line = reader.readLine();
        if(line == null) {
            close();
        }
        return hexDecode(line);
    }

    public void close() throws IOException {
        writer.close();
        reader.close();
        socket.close();
    }

    private String hexEncode(byte[] buf) {
        return Hex.encodeHexString(buf, true)+"n";
    }

    private byte[] hexDecode(String buf) throws DecoderException {
        return Hex.decodeHex(buf);
    }
}
```

Packager 则是 Encoder 和 Transporter 的结合体，直接对外提供 send 和 receive 方法：

```java
public class Packager {
    private Transporter transpoter;
    private Encoder encoder;

    public Packager(Transporter transpoter, Encoder encoder) {
        this.transpoter = transpoter;
        this.encoder = encoder;
    }

    public void send(Package pkg) throws Exception {
        byte[] data = encoder.encode(pkg);
        transpoter.send(data);
    }

    public Package receive() throws Exception {
        byte[] data = transpoter.receive();
        return encoder.decode(data);
    }

    public void close() throws Exception {
        transpoter.close();
    }
}
```

### Server 和 Client 的实现

Server 和 Client，偷懒直接使用了 Java 的 socket。

Server 启动一个 ServerSocket 监听端口，当有请求到来时直接把请求丢给一个新线程处理。这部分应该直接背板了。

HandleSocket 类实现了 Runnable 接口，在建立连接后初始化 Packager，随后就循环接收来自客户端的数据并处理：

```java
Packager packager = null;
try {
    Transporter t = new Transporter(socket);
    Encoder e = new Encoder();
    packager = new Packager(t, e);
} catch(IOException e) {
    e.printStackTrace();
    try {
        socket.close();
    } catch (IOException e1) {
        e1.printStackTrace();
    }
    return;
}
Executor exe = new Executor(tbm);
while(true) {
    Package pkg = null;
    try {
        pkg = packager.receive();
    } catch(Exception e) {
        break;
    }
    byte[] sql = pkg.getData();
    byte[] result = null;
    Exception e = null;
    try {
        result = exe.execute(sql);
    } catch (Exception e1) {
        e = e1;
        e.printStackTrace();
    }
    pkg = new Package(result, e);
    try {
        packager.send(pkg);
    } catch (Exception e1) {
        e1.printStackTrace();
        break;
    }
}
```

处理的核心是 Executor 类，Executor 调用 Parser 获取到对应语句的结构化信息对象，并根据对象的类型，调用 TBM 的不同方法进行处理。具体不再赘述。

top.guoziyang.mydb.backend.Launcher 类，则是服务器的启动入口。这个类解析了命令行参数。很重要的参数就是 -open 或者 -create。Launcher 根据两个参数，来决定是创建数据库文件，还是启动一个已有的数据库。

```java
private static void createDB(String path) {
    TransactionManager tm = TransactionManager.create(path);
    DataManager dm = DataManager.create(path, DEFALUT_MEM, tm);
    VersionManager vm = new VersionManagerImpl(tm, dm);
    TableManager.create(path, vm, dm);
    tm.close();
    dm.close();
}

private static void openDB(String path, long mem) {
    TransactionManager tm = TransactionManager.open(path);
    DataManager dm = DataManager.open(path, mem, tm);
    VersionManager vm = new VersionManagerImpl(tm, dm);
    TableManager tbm = TableManager.open(path, vm, dm);
    new Server(port, tbm).start();
}
```

客户端连接服务器的过程，也是背板。客户端有一个简单的 Shell，实际上只是读入用户的输入，并调用 Client.execute()。

```java
public byte[] execute(byte[] stat) throws Exception {
    Package pkg = new Package(stat, null);
    Package resPkg = rt.roundTrip(pkg);
    if(resPkg.getErr() != null) {
        throw resPkg.getErr();
    }
    return resPkg.getData();
}
```

RoundTripper 类实际上实现了单次收发动作：

```java
public Package roundTrip(Package pkg) throws Exception {
    packager.send(pkg);
    return packager.receive();
}
```

最后附上客户端的启动入口，很简单，把 Shell run 起来即可：

```java
public class Launcher {
    public static void main(String[] args) throws UnknownHostException, IOException {
        Socket socket = new Socket("127.0.0.1", 9999);
        Encoder e = new Encoder();
        Transporter t = new Transporter(socket);
        Packager packager = new Packager(t, e);

        Client client = new Client(packager);
        Shell shell = new Shell(client);
        shell.run();
    }
}
```

今天是 2021 年 12 月 26 日，圣诞节。

战无不胜的毛泽东思想万岁！