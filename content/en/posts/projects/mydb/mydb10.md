---
authorship: human-only
title: "MYDB 10. Implementing the Server, Client, and Wire Protocol"
description: "MYDB uses a client/server architecture similar to MySQL, allowing multiple clients to connect to a server over sockets, execute SQL queries, and receive results. Communication uses a special binary format, though plain text would also be an option for a simpler implementation. The basic transport structure supports effective communication and processing between client and server."
date: 2021-12-25 18:26:00
categories: [projects]
tags: ["java", "mydb"]
---

The code in this chapter is in [backend/server](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/server), [client](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/client), and [transport](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/transport).

### Introduction

MYDB is designed with a client/server architecture, similar to MySQL. You start a server, multiple clients connect to it, and they communicate over sockets to execute SQL and return results.

### Client/Server Communication

MYDB uses a special binary format for communication between client and server. Of course, if that seems like too much trouble, plain text would work too.

The basic unit of transmission is a Package:

```java
public class Package {
    byte[] data;
    Exception err;
}
```

Before transmission, Encoder encodes each Package as a byte array. At the other end, Encoder decodes it back into a Package object. The encoding and decoding rules are:

```
[Flag][data]
```

A flag of 0 means the package contains data, and data is the payload itself. A flag of 1 means it contains an error, and data is the error message from Exception.getMessage(). Here is the implementation:

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

Transporter writes the encoded message to an output stream to send it. To avoid problems with special characters, we convert the bytes to a hexadecimal string and append a newline. Sending and receiving then become simple line-by-line operations using BufferedReader and Writer.

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

Packager combines Encoder and Transporter, exposing send and receive directly:

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

### Implementing Server and Client

For Server and Client, I took the easy route and used Java sockets directly.

Server starts a ServerSocket listening on a port and hands each incoming request to a new thread. This is the sort of boilerplate you can probably write from memory.

HandleSocket implements Runnable. After the connection is established, it initializes a Packager and loops, receiving and processing client data:

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

Executor is the core of request processing. It calls Parser to obtain a structured statement object, then dispatches to different TBM methods according to the object’s type. I will not go into the details here.

The top.guoziyang.mydb.backend.Launcher class is the server’s entry point. It parses the command-line arguments, with -open and -create being the important ones. Launcher uses them to decide whether to create database files or start an existing database.

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

Connecting the client to the server is boilerplate too. The client has a simple Shell that just reads user input and calls Client.execute().

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

RoundTripper implements one request-response exchange:

```java
public Package roundTrip(Package pkg) throws Exception {
    packager.send(pkg);
    return packager.receive();
}
```

Finally, here is the client’s entry point. It is simple: just run the Shell:

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

Today is December 26, 2021. Christmas.

Long live invincible Mao Zedong Thought!
