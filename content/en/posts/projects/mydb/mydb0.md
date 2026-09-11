---
recommend: 1
authorship: human-only
title: "MYDB 0. Project Structure and a Few Things I Had to Say"
description: "MYDB is a personal project exploring and implementing the fundamentals of databases, built in my spare time over a little more than half a month. I picked up some basic knowledge in my university database systems course, though during my internship I mostly used the classes as an excuse to slack off. My candid answers in an interview did not cause too much trouble, but they did make me reconsider what I knew about databases and decide to learn through hands-on practice. That was how this project began."
date: 2021-11-27 14:43:00
categories: [projects]
tags: ["java", "mydb"]
image: "https://blog-img.774352199.xyz/xfci2J.webp"
---

Project: [https://github.com/CN-GuoZiyang/MYDB](https://github.com/CN-GuoZiyang/MYDB)

::github{repo="CN-GuoZiyang/MYDB"}
::
### Preface (Some Rambling)

Maybe I am addicted to reinventing wheels, or maybe I just felt I needed to brush up on database fundamentals. Either way, I finished this project in a little more than half a month, working from the end of the workday until midnight.

I do have a bit of history with databases. When my university offered its database systems course, I happened to be interning in Shenzhen. Online classes became a perfectly legitimate excuse to slack off at work, and I did just about everything except listen to the lectures. Operating systems was taught around the same time, but since I actually had some interest in OS, my grasp of it was not quite as shaky as my database knowledge.

The consequences caught up with me soon enough. In my second interview at ByteDance, the interviewer asked how much I knew about databases. In the spirit of being candid and clear, I said, “Nothing at all.” He then asked about redis, and I could only say, “Nothing about that either.” Fortunately, he did not hold it against me and passed me anyway. I do wonder whether those two “I don’t knows” tanked my interview feedback, though…

Once I started working, my team had little to do with databases, so I thought I had escaped databases and CRUD for good. Things changed surprisingly quickly: the neighboring asset management team was desperately short-staffed and asked the department to lend them people, so I was sent over to help. Asset management has fairly strict consistency requirements. I could hardly keep throwing every bit of data into redis and shrugging when something failed to go in…

### What Got Me Started

One day, while browsing GitHub, I stumbled across [@qw4990](https://github.com/qw4990)’s database project, [NYADB2](https://github.com/qw4990/NYADB2). It is a simple database written in Go, with an excellent layered design and code that is easy to read. Still fond of Java, I decided to write a Java database based on its overall architecture. I referred to this project for many implementation details along the way.

Rather embarrassingly for me, this was the author’s undergraduate hobby project. I suppose that is what being seriously good looks like. *Runs away*

RESPECT

### Overall Structure

MYDB consists of a backend and a frontend, which communicate over sockets. The frontend (client) has a very simple job: read user input, send it to the backend for execution, print the returned result, and wait for the next input. The MYDB backend parses SQL and, if it is valid, attempts to execute it and returns the result. Excluding the parser, the backend is divided into five modules. Each has a defined responsibility and exposes methods through interfaces to the modules that depend on it. The five modules are:

1.  Transaction Manager (TM)
2.  Data Manager (DM)
3.  Version Manager (VM)
4.  Index Manager (IM)
5.  Table Manager (TBM)

Their dependencies look like this:

![MYDB module dependencies](https://blog-img.774352199.xyz/2025/b536d4e4ea0ec97d629d82ffde917c54.jpg)

A topological sort of this dependency graph gives us an implementation order. In this tutorial, that order is TM -> DM -> VM -> IM -> TBM.

Here is what each module does:

1.  TM maintains transaction states in an XID file and exposes interfaces that other modules use to query a transaction’s state.
2.  DM directly manages the database’s DB file and log file. Its main responsibilities are: 1) managing and caching the pages of the DB file; 2) managing the log file so the database can recover from errors using the log; and 3) exposing the DB file as DataItems to higher-level modules and providing a cache for them.
3.  VM uses two-phase locking (2PL) to make schedules serializable and implements MVCC to eliminate blocking between reads and writes. It also implements two isolation levels.
4.  IM implements B+ tree indexes. By the way, where currently supports only indexed fields.
5.  TBM manages fields and tables. It also parses SQL statements and performs the corresponding operations on tables.

### Development Environment and Example Run

I developed the project using WSL2 and JDK11. To run it on Windows, replace the paths in the launch arguments with Windows paths. Make sure you use JDK 11 or later; JDK 8 is not compatible (or find the incompatible methods yourself and replace them with compatible alternatives—there should only be a handful).

**_JDK 8 is now supported._**

Almost every module and submodule has corresponding unit tests in the test folder. Please write plenty of unit tests yourself, too. Otherwise, when you finally run everything together, you will have no idea where the bugs came from.

**Skipping unit tests feels great—until a bug turns everything into a dumpster fire. (**

First, adjust the compilation version in pom.xml. If you import the project into an IDE, change its compilation version to match your JDK.

First, compile the source:

```shell
mvn compile
```

Next, create a database at /tmp/mydb:

```shell
mvn exec:java -Dexec.mainClass="top.guoziyang.mydb.backend.Launcher" -Dexec.args="-create /tmp/mydb"
```

Then start the database server with the default parameters:

```shell
mvn exec:java -Dexec.mainClass="top.guoziyang.mydb.backend.Launcher" -Dexec.args="-open /tmp/mydb"
```

The database server is now listening on port 9999 on your machine. Open another terminal and run the following command to start a client and connect to it:

```shell
mvn exec:java -Dexec.mainClass="top.guoziyang.mydb.client.Launcher"
```

This starts an interactive command line where you can enter SQL-like statements. Press Enter to send a statement to the server and print the result.

Here is an example:

![MYDB example run](https://blog-img.774352199.xyz/2025/e0ab6dcbb970d6435a5d5be24f085de8.jpg)
