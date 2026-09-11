---
authorship: human-only
title: "MYDB 10. サーバー・クライアントの実装と通信プロトコル"
description: "MYDBはMySQLに似たC/S構成を採用し、複数のクライアントがソケットでサーバーへ接続してSQLを実行し、結果を受け取れます。通信には専用のバイナリー形式を使いますが、実装を簡単にするならプレーンテキストも選択肢です。サーバーとクライアントの基本的な転送構造によって、データのやり取りと処理を行います。"
date: 2021-12-25 18:26:00
categories: [projects]
tags: ["MYDB","Java","Socket","クライアントサーバー構成","通信プロトコル"]
image: "https://blog-img.774352199.xyz/PAHrUZ.webp"
seoDescription: "MYDBのJava Socketサーバーと対話型クライアントを実装。データとエラーの符号化、16進数の行単位通信、SQL実行、起動処理と要求・応答の流れをつなぎます。"
---

この章で扱うコードは[backend/server](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/backend/server)、[client](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/client)、[transport](https://github.com/CN-GuoZiyang/MYDB/tree/master/src/main/java/top/guoziyang/mydb/transport)にあります。

### はじめに

MYDBはMySQLに似たC/S構成で設計されています。サーバーを起動し、複数のクライアントが接続して、ソケット通信でSQLを実行し、結果を返します。

### C/S間の通信

MYDBはクライアントとサーバーの通信に専用のバイナリー形式を使います。もちろん、面倒ならプレーンテキストを使ってもかまいません。

転送の最も基本となる構造はPackageです。

```java
public class Package {
    byte[] data;
    Exception err;
}
```

各Packageは送信前にEncoderでバイト配列へ変換し、受信側でもEncoderでPackageオブジェクトへ戻します。エンコードとデコードのルールは次のとおりです。

```
[Flag][data]
```

flagが0ならデータの送信で、dataがそのデータ本体です。flagが1ならエラーの送信で、dataにはException.getMessage()のエラーメッセージが入ります。実装は次のとおりです。

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

エンコード後のメッセージはTransporterが出力ストリームへ書き込んで送信します。特殊文字による問題を避けるため、データを16進数の文字列（Hex String）へ変換し、末尾に改行を付けます。これでBufferedReaderとWriterを使い、行単位で簡単に送受信できます。

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

PackagerはEncoderとTransporterを組み合わせたもので、sendとreceiveを直接公開します。

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

### ServerとClientの実装

ServerとClientは、手を抜いてJavaのsocketをそのまま使いました。

ServerはServerSocketでポートを待ち受け、リクエストが来たら新しいスレッドへ渡して処理します。このあたりは、お決まりのコードをそのまま書く部分ですね。

HandleSocketはRunnableを実装し、接続確立後にPackagerを初期化して、クライアントからのデータを受信・処理するループに入ります。

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

処理の中心はExecutorです。Parserを呼んで文の構造化された情報を取得し、オブジェクトの型に応じてTBMのメソッドを呼び分けます。詳細は省きます。

top.guoziyang.mydb.backend.Launcherがサーバーの起動エントリーポイントです。コマンドライン引数を解析し、特に重要な-openと-createに応じて、データベースファイルを作るか、既存のデータベースを起動するかを決めます。

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

クライアントの接続処理も定型的です。クライアントには簡単なShellがあり、ユーザーの入力を読んでClient.execute()を呼ぶだけです。

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

RoundTripperは、1回の送受信を実装しています。

```java
public Package roundTrip(Package pkg) throws Exception {
    packager.send(pkg);
    return packager.receive();
}
```

最後にクライアントの起動エントリーポイントを載せます。Shellをrunするだけの簡単なものです。

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

今日は2021年12月26日、クリスマスです。

不敗の毛沢東思想万歳！
