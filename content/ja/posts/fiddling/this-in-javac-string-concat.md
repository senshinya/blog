---
authorship: human-only
title: "Javaのthisキーワードでコンパイル時の定数伝播が効かなくなる問題"
description: "Javaでは`this`を使うことで、コンパイラの定数最適化が効かなくなる場合があります。このコード例の`ab1`と`ab2`は同じstatic final変数`s`を参照しているように見えますが、比較結果は異なります。静的変数を直接参照して文字列を連結する`ab1`に対し、`this`経由の`ab2`では同じ定数伝播の最適化が行われません。わずかな構文の違いが、コンパイル結果を変える例です。"
date: 2022-04-16 00:01:28
categories: [fiddling]
tags: ["試行錯誤", "java"]
---

少し長いタイトルになりましたが、なかなか面白い問題です。次のコードを見てください。

```java
public class Test {
    final static String s = "a";

    public void test() {
        String cmp = "ab";
        String ab1 = s + "b";
        String ab2 = this.s + "b";
        System.out.println(ab1 == cmp);
        System.out.println(ab2 == cmp);
    }

    public static void main(String[] args) {
        new Test().test();
    }
}
```

まず出力を予想してみましょう。7行目のsと8行目のthis.sは、同じstatic final変数sを指しています。結果が分からなくても、少なくとも2つの出力は同じになりそうです。ところが実際にはこうなります。

```shell
true
false
```

javapで生成されたバイトコードを逆アセンブルしてみます。test()の部分は次のとおりです。

```shell
  public void test();
    descriptor: ()V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=3, locals=4, args_size=1
         0: ldc           #7                  // String ab
         2: astore_1
         3: ldc           #7                  // String ab
         5: astore_2
         6: aload_0
         7: pop
         8: ldc           #11                 // String a
        10: invokedynamic #13,  0             // InvokeDynamic #0:makeConcatWithConstants:(Ljava/lang/String;)Ljava/lang/String;
        15: astore_3
        16: getstatic     #17                 // Field java/lang/System.out:Ljava/io/PrintStream;
        19: aload_2
        20: aload_1
        21: if_acmpne     28
        24: iconst_1
        25: goto          29
        28: iconst_0
        29: invokevirtual #23                 // Method java/io/PrintStream.println:(Z)V
        32: getstatic     #17                 // Field java/lang/System.out:Ljava/io/PrintStream;
        35: aload_3
        36: aload_1
        37: if_acmpne     44
        40: iconst_1
        41: goto          45
        44: iconst_0
        45: invokevirtual #23                 // Method java/io/PrintStream.println:(Z)V
        48: return
```

定数プールの#7は次の内容です。

```shell
   #7 = String             #8             // ab
   #8 = Utf8               ab
```

まず最初のtrueは、よく知られた話だと思います。ソースをclassバイトコードにコンパイルするとき、コンパイラはそのクラスのメソッド内に現れるfinal定数をリテラルに置き換えます。そのためJavaコード6行目の`String ab1 = s + "b"`;は`String ab1 = "a" + "b"`;になります。さらに、リテラル同士の連結なのでコンパイラが連結も済ませ、最終的には`String ab1 = "ab";`と同等になります。cmpとab1はどちらも定数プールの文字列"ab"を指すため、cmp == ab1です。逆アセンブルしたバイトコードの0行目と3行目はまったく同じで、ldc（Load Constant）の引数はいずれも#7です。

バイトコードの8〜15行目は、文字列ab2を用意する処理です。ここではmakeConcatWithConstantsというメソッドが動的に呼び出されています。これはJavaでStringを「+」で連結するためのブートストラップメソッドです。このメソッドはヒープに新しい文字列を作るので、ab2 != cmpになります。

ちなみにmakeConcatWithConstantsは、文字列の「+」演算を処理するためJDK 9で導入されました。JDK 8より前のjavacは、ずっとStringBuilderを使っていました。

では、何がこの違いを生むのでしょうか。原因は明らかにthisキーワードです。Javaはコンパイル時に、すべてのインスタンスメソッドへ現在のインスタンスを指す参照thisを暗黙に追加します。バイトコードではthisをメソッドの引数として渡します。void()には引数がないのに、バイトコード5行目のargs\_sizeが1なのはこのためです。クラス変数でもインスタンス変数でも、オブジェクト参照経由でアクセスする変数に対しては、Javaコンパイラはこの最適化を一律に無効にしてしまいます。ここをthis.sからTest.sに変えると、出力はtrueになります。
