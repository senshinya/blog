---
recommend: 2
authorship: human-only
title: "Some Thoughts on Programming Languages"
seoTitle: "Programming language design: type systems, runtimes and implementation"
description: "Designing a new programming language is challenging and fun. Setting aside complicated compiler theory and implementation details to focus on where code runs helps clarify how languages are built. Starting from the RISC-VI instruction set, this discussion explores the underlying architecture, layered computer systems, and virtual-machine model, reflecting on the nature of programming languages as well as their implementation."
date: 2023-04-08 13:16:36
categories: [fiddling]
tags: ["Programming language design","Type systems","Compiler design","RISC-V"]
image: "https://blog-img.774352199.xyz/uO420B.webp"
seoDescription: "Using a hypothetical language design, I compare runtimes, types, arrays, parameter passing, inheritance, and generics across C, Java, Go, and other languages."
---

This post introduces some basic concepts, implementation approaches, and the current state of programming-language theory by talking through how to design a language.

### I'm designing a programming language... am I?

Let's design a brand-new programming language: C--.

Yes, ourselves.

For now, set aside complicated compiler theory, compiler and interpreter implementation, and the details of implementing particular features. Look at the title: these are just some thoughts!

We will build our own language from the bottom up.

Let's assume the bottom layer: our language compiles to RISC-VI format, with a corresponding RISC-VI instruction set. This assembly language is very basic, offering only simple operations on memory and registers.

### Where does the code run?

This sounds like a question about the RISC-VI instruction set or architecture, unrelated to the high-level features we want to design. But it determines which layer of the computer system our code occupies, something a language designer must consider first:

> A computer system is, fundamentally, a hierarchy of virtual machines.

In this layered model, each upper layer wraps and hides the interfaces below it, adding its own features for the next layer to use.

An operating system virtualizes the hardware, or bare machine. Suppose your computer uses x86. When you compile and run a small C program, the OS first parses the binary's format. On Linux, that executable is in ELF format. After parsing it, the OS loads its segments into memory and jumps to the first instruction in the code segment. Reality is less simple, of course: an actual OS manages memory more carefully and isolates running tasks using processes and other mechanisms.

By a remarkable coincidence(?), compiled C binaries can run not only atop an OS but on bare metal. The obvious example is the Linux kernel, mostly written in C; Rust code recently entered mainline too, which is promising. In system programming, C programs mainly use OS-provided system calls. On x86 Linux, a program reading a file into memory typically uses sys_read. Linux reads the data on its behalf, after permission checks and other preliminaries. But if you write an OS in C, there are no system calls to use. Even files are an OS abstraction. You must interact with the disk hardware somehow, modifying controller registers just to read data from a particular location.

This fits the definition of a virtual machine perfectly. You could even call Linux a VM for executing ELF files, though it does much more. If we set aside the C standard library provided by the OS, C runs at the bare-metal layer. Strictly speaking, its compiled output runs there, but let's use that shorthand for now.

Another example 🌰: Python, a typical interpreted language. Its official interpreter, CPython, is written in C. In our layered model, CPython is a VM built on the OS, wrapping OS interfaces for higher-level Python programs to call.

Taken to an extreme, even a compiled language like C can be regarded as interpreted: the CPU reads, decodes, and executes instructions one at a time; they just happen to be binary. Python's instructions are readable, and CPython takes human-readable strings as input.

A major advantage of interpreted languages is portability. The interpreter hides OS differences and supplies the same APIs to the high-level language, letting you **write once, run anywhere**. By the law of conservation of suffering, your convenience is paid for by the interpreter's author. Still, a compiled language needs compiler implementations for different instruction sets too, so perhaps the suffering is not so different.

Speaking of **run anywhere**, we have to mention the famous **compile once, run anywhere**: Java! It combines compilation with interpretation. The JVM is Java's runtime, analogous to CPython for Python. A java file first compiles into a class file, the format the JVM reads. This is binary too, but the format is the same across operating systems using different instruction sets. That is why a class file compiled on x86 also runs on a RISC-V JVM. After reading it, the JVM loads, decodes, and executes instructions one by one, like an interpreter. Calling Java purely compiled or interpreted is therefore difficult.

The JVM is a successful virtual machine in the computer-systems sense. It supports not only Java but languages such as Scala and Groovy. The crucial fact is that all of them can compile to class format.

We generally regard interpreted languages as slower and compiled ones as faster. As languages have developed, many interpreted implementations have added features to improve performance. During Java class-file interpretation, for example, the JVM dynamically identifies hot code and compiles it directly to machine code. When that code runs again, it executes the compiled version rather than being interpreted anew. This is JIT, just-in-time compilation. Python's Numba library similarly uses JIT to accelerate execution.

Of course, if you write a C interpreter, you can call C an interpreted language too...

### Type systems

We have established where C-- runs, but it is still rudimentary, arguably nonexistent:

- On the compiled-language path, RISC-VI is an instruction-set architecture, generally independent of the high-level language.
- On the interpreted-language path, we might design and implement RISC-VI and its interpreter ourselves.

RISC-VI manipulates only memory and registers. To it, both are meaningless byte arrays, and any byte may be manipulated within the limits permitted by the VM below.

Suppose our language has no type system and operates directly on byte arrays. In C terms, that means defining no types and using void * pointers for everything. We can only take addresses, dereference, and read or assign bytes. That is barely different from assembly! Creating a four-byte integer on the heap and setting it to 1 would look like this, using C syntax, though without types it really is like assembly:

```c
void *intBytes = malloc(4);    // 堆上分配四字节
*(intBytes+3) = 0x01;          // 假设大端序，偏移为 3 处设置为 1
```

Where did our familiar int, float, and friends go? That is the type system's job.

> A type is fundamentally a way to interpret a region of memory.

A type system divides unstructured stack and heap space into meaningful blocks, assigning interpretations according to type. For programmers, the most visible difference is the syntax used to define them. In C, int usually denotes a four-byte integer, while double denotes an IEEE 754 double-precision floating-point value. The type determines how the compiler's generated runtime code operates on those bytes.

With a type system, creating that four-byte integer becomes:

```c
int *intBytes = (int *)malloc(4);
*intBytes = 1;
```

By declaring intBytes as an int pointer, we say that its target memory should be interpreted as an integer. On the second line, we can assign 1 through intBytes without worrying that it lands in byte 0 instead of byte 3. Knowing the pointer's type, the compiler customizes all operations accordingly. The final machine code still sets the third byte to 1, but the compiler handles that; we work with types.

An interesting detail is that C handles pointer-offset calculations at compile time. In this example, `intBytes+1` actually means the address in intBytes plus 4, because int occupies four bytes. This is also central to C's implementation of arrays.

> The type system is a compile-time feature, in C's case.

Struct definitions likewise guide the compiler's memory operations. Consider:

```c
typedef exampleStruct struct {
	int a;
	int b;
}
```

This struct contains two ints, occupying eight bytes. A pointer `esp` of type exampleStruct means that the eight-byte region starting at that address should be interpreted according to exampleStruct's layout. Accessing int b with `esp.b` or `esp->b` means treating bytes at offsets four through seven from esp as an int.

In that sense, a struct's field names serve at runtime only to indicate offsets from the start of the struct.

Declaring a struct directly inside a function with `exampleStruct esp;`, instead of using a pointer, is special compiler handling for stack allocation. You can even view it as syntactic sugar, because:

1. You do not manually initialize the struct; declaring it makes it available. The compiler has already chosen its position in the stack frame at compile time.
2. You do not manage its lifetime. It is freed when the function ends, by moving the stack pointer upward on a downward-growing stack, without overwriting the memory.

The drawback is obvious: that second advantage is also a disadvantage. Once the function returns, the allocation is released, so it cannot be used outside the function.

Compared with C, Java's type system is quite restricted: type information is stored directly in the object's memory, and casts can only move between parent and child nodes of the type tree.

#### Pass by value or pass by reference?

A frequent topic of discussion, and misunderstanding, is whether function arguments are passed by value or by reference.

At bottom, all argument passing can be viewed as passing values; so-called reference passing is an optimization built on that.

C is straightforward. Whether arguments use registers or the stack, the original contents must be copied or backed up so they remain unchanged after the called function returns. A pointer, stripped of its pointer-ness, is just a number, perhaps 32 or 64 bits depending on the architecture. Passing it has the same result as putting the address in a long and passing that.

“Pass by reference” comes up mostly around Java. A reference is essentially an object handle through which programs access some of an object's information. The handle does not itself represent the memory address, but its implementation must contain the actual address. Passing a reference into a function or method can be viewed as passing a struct containing that address, much like passing a pointer in C, hence the similar behavior.

Java also has eight primitive types, each with a corresponding wrapper class, which makes the implementation feel inconsistent. Supposedly this was an early attempt to attract C++ programmers. Elegance took a hit.

### What is an array?

With a basic type system in place, we should consider a special but common compound type: arrays. But what is an array, and do arrays really exist?

C actually has no arrays at runtime; they are compile-time syntactic sugar implemented with pointers. An array name is the address of its zeroth element: after declaring `int a[10]`, using a is equivalent to `&a[0]`. Subscripting with brackets is also implemented by typed-pointer offsets. Accessing the element with `a[1]` can be viewed as `*(a+1)`. More concretely:

```c
int b = a[0];

// 等同于
void *p = (void *)a;
p += 4;
int b = *((int *)p);
```

Because arrays are based on typed pointers and can be freely converted to and from the corresponding pointer type, the language does no bounds checking. If I define a ten-element array on the stack, reading or writing an eleventh element sometimes causes no immediate problem.

You might object that out-of-bounds accesses cause segmentation faults. That is not C checking bounds. An access beyond the array may read unreadable memory or write unwritable memory, causing an OS error. This is not a language-level error.

C offers three forms for array parameters: a pointer, an array with a specified size, and one without a specified size:

```c
void func(int *array);
void func(int array[10]);
void func(int array[]);
```

With the first and third forms, func cannot recover the original length through len. With the second, the reported length is always 10, even if the argument is not a ten-element array. This illustrates that length information lives in the type definition; type changes during argument passing can lose it. It also fits the idea of arrays being fundamentally pointer-based: their memory contains only consecutive elements, with no additional information.

Java, by contrast, has real arrays. Every array is an object, with information such as element type and length in its header. Java can therefore check bounds at runtime and throw IndexOutOfBoundsException.

### Procedural or object-oriented?

This is not really a question. Broadly, procedural and object-oriented programming are styles and paradigms rather than distinctions between particular languages. C can also support object-oriented programming through structs.

We can adopt a narrower definition: only a language that natively and fully implements the three pillars of object orientation—encapsulation, inheritance, and polymorphism—counts as object-oriented.

Simple encapsulation needs little explanation; even C can bundle things into a struct. But an important aim is to hide implementation details so that external code can access and manipulate data only through an object's interfaces. C structs have no access control; their fields can be modified freely, making that sort of encapsulation effectively meaningless. One large syntactic difference between Java/C++ and C is invoking member methods with the dot operator. The implementation is not special: a member method is a function whose first argument is an object pointer. The compiler adds that argument automatically and calls it this. Otherwise, it is no different from an ordinary function.

Java, C++, and Go have something in common: they implement inheritance through composition, directly or indirectly. Because composition is involved, custom constructors must first call the parent's constructor. Go makes the composition particularly obvious by embedding an unnamed parent struct. Accessing a parent's field is really accessing that contained object's field, making it look very much like syntactic sugar:

```go
type Parent struct {
	a int64
}

type Child struct {
	Parent
	b int64
}

c := &Child{Parent{}, 0}
a := c.a
//或者
a := c.Parent.a;
```

Compared with Java and C++, Go's inheritance feels like playing house. There is no dedicated control over a child's access to parent fields, just the usual initial-letter capitalization that determines package exports. It lacks something like Java's protected for specifically controlling child-to-parent access.

A typical expression of polymorphism is that a parent pointer can refer to different child objects, and invoking their shared method produces different behavior. Java and C++ exemplify two approaches. Java has the JVM runtime, which makes polymorphism easy: even when calling through a parent-type handle, the handle leads to the object's concrete type and method information, so selecting the implementation is straightforward. Java thus has runtime polymorphism. C++, meanwhile, has compile-time polymorphism. Each class has a virtual function table, and instances carry a pointer to theirs. The table lists methods that inheritance may override. The compiler ensures that a method implemented by both parent and child occupies the same position in both tables. A potentially inherited method call thus becomes “call the Nth function in the virtual table.” Calling through a parent pointer actually finds a function pointer in the child object's table, invoking the child's implementation and achieving polymorphism.

### Implementing generics

Thanks to IDEA's intelligent completion, generics are among the most widely used advanced language features. Yet Java only introduced generic programming in JDK 5, and C++ only introduced template programming, one implementation of generics, in C++11, making them relatively new. Interestingly, these represent two very different implementation strategies.

Java generics exist at compile time and disappear at runtime: type erasure. They provide compile-time checks that supplied objects or types satisfy the generic parameters. If you bypass those checks by manually constructing a class file or using runtime reflection, the JVM cannot help. For instance, normal code permits only Strings in a `List<String>`. With erasure, however, it is simply a `List` at runtime, or effectively a `List<Object>`. Somehow insert an Integer at runtime and the JVM will not complain.

C++ implements generics through code generation, hence the name templates. The compiler inspects the template arguments used at each instantiation and generates every method of the generic class for each distinct argument set. Suppose a template class `ClassName< typename T >` contains `Test(T t)`, and we instantiate it with `ClassName<int> testObj`. The compiled output really contains a `Test(int t)` method. As with Java, runtime code has no awareness of generics; generated classes and methods look just like handwritten ones. This is undoubtedly safer than Java's approach. Code generation rather than erasure avoids the situation where bypassing compilation leaves no checks at all.

One disadvantage is that each template-generated C++ class must be complete. Even functions that do not involve template parameters are generated repeatedly, despite identical code, potentially wasting considerable space. C# optimizes this. Rather than generating final template code at compile time, it determines the different implementations needed. The .NET runtime's JIT compiler—CLR is analogous to the JVM—generates shared machine code for the template, while each instantiated generic type stores specialization information in an additional table. Most code can then be shared. See the paper for details. Still, this is hardly C++'s fault: C# has a runtime, and without its own runtime or one compiled into the output, C++ would struggle to implement such dynamic sharing.

### Closing thoughts

Once you have decided all this, you have essentially determined what your language looks like, even before choosing its syntax! What remains is fairly standard, step-by-step work: implement it.

You can add all the advanced features you like, such as GC or unusual lifetime management. A VM makes implementing them much easier, but is not required. Go, for example, compiles GC code directly into the final output, effectively bundling a tiny VM with each executable.

Most people do not need to implement their own language, but understanding these shared ideas and distinctive features is still worthwhile. There is no best programming language, only the most suitable one for a particular situation. Debates over the “best language” are therefore rather silly: each language exists to solve some problem. A new language that differs from an existing one only in syntax, with no distinctive features, will struggle to last. If it solves no new problem, why bother learning it?

Understanding these features has unexpected benefits too. When programmers are drinking and talking big, or a tech chat group starts another well-reasoned best-language argument, you will have plenty to say.
