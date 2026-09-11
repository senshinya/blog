---
recommend: 3
authorship: human-only
title: "構文解析で型名と変数名の曖昧さを解消する"
description: "構文解析では、ユーザー定義型名と通常の変数名を見分けることが課題になります。たとえば`a*b;`は算術式とも宣言とも解釈できます。とくに型指定子に関する文法規則によって変数名が型名と解釈され、正確さや読みやすさに影響します。初期化を伴わない変数宣言は多いため、この曖昧さはソースコードの随所に現れます。"
date: 2025-03-15 20:35:00
categories: [fiddling]
tags: ["構文解析","GLR","シンボルテーブル","スコープ","曖昧性解消"]
image: "https://blog-img.774352199.xyz/2VKHK9.webp"
seoDescription: "Cのa*bが式と宣言の両方に読める曖昧さを、GLR解析の前後で処理。簡易シンボル表、型の印、変数による隠蔽とスコープの検査で、誤ったASTを除外する方法を説明します。"
---

### 導入

構文解析段階でシンボルテーブルを持たない場合、ユーザー定義型名（typedef）と普通の変数名は見分けにくくなります。関数内の`a*b;`は、aとbを掛けて結果を捨てる式とも、型`a*`の変数bを宣言する文とも解釈できます。

さらに、次の文法規則があります。

```
declaration := declaration_specifiers SEMICOLON
declaration_specifiers := type_specifier declaration_specifiers
type_specifier := INT
type_specifier := typedef_name
typedef_name := IDENTIFIER
```

規則1は、識別子を指定する必要のない構造体の前方宣言によく使います。たとえば`struct Node;`は`struct Node`型の前方宣言です。しかしこの規則があるため、`int a;`も規則1で還元され、aが変数名ではなくユーザー定義型名と認識される可能性があります。初期化なしの変数宣言は頻出するので、1つのソースから文法を満たすASTが多数生まれます。意味解析でシンボルテーブルを持てば解決できますが、構文解析の段階でも小さなコストで処理し、意味解析に渡すASTを減らせます。

### 方針

型名と変数名の曖昧さは、GLRの実行中または実行後に簡易シンボルテーブルを使い、不正な分岐を刈り込むことで解消できます。最低限、変数名とユーザー定義型名を記録します。内側の変数名や型名が外側のシンボルを隠すこともあるので、スコープも追跡する必要があります。

やることは単純です。

1. シンボルテーブルを維持し、型定義と変数宣言を集める。
2. シンボルの追加時に、同じスコープに同名の変数宣言や型定義がないか確認する。
3. `primary_expression := IDENTIFIER`で還元した各ノードについて、`IDENTIFIER`が宣言済みで隠されていない変数名か確認する。
4. `typedef_name := IDENTIFIER`で還元した各ノードについて、`IDENTIFIER`が定義済みで隠されていないユーザー定義型名か確認する。

定番の`a*b;`で考えます。

```c
// 例 1
typedef int a;
func test_func()
{
	a*b;
}
```

```c
// 例 2
typedef int a;
func test_func()
{
	int a;
	a*b;
}
```

例1：`a*b;`の解析時、スコープ1（最外層）にはユーザー定義型aがあり、スコープ2（関数内）にはシンボルがありません。型`a*`の変数`b`の宣言と解釈するASTでは、aは`typedef_name := IDENTIFIER`で還元されます。テーブルを確認するとaは確かにスコープ1のユーザー定義型なので、このASTを残します。変数`a`と変数`b`の乗算と解釈するASTでは、aは`primary_expression := IDENTIFIER`で還元されます。変数aはテーブルにないので、このASTは破棄します。

例2：`a*b;`の解析時、スコープ1にユーザー定義型a、スコープ2に変数aがあり、変数が型を隠しています。宣言と解釈するASTではaを`typedef_name := IDENTIFIER`で還元しますが、このスコープのaは変数であって型ではないため、ASTを破棄します。乗算と解釈するASTではaを`primary_expression := IDENTIFIER`で還元し、変数名であることが確認できるのでASTを残します。

完全なシンボルテーブルと違い、この簡易版はスコープ内で同種の変数が同名で宣言される問題を検査しません。ユーザー定義型名の重複は検査できます。前方宣言があるので同じ変数の宣言は複数回許されますが、初期化を含められるのは1回だけです。構文解析で初期化の有無を見分けるのは比較的コストが高いため、意味解析まで遅らせるのがおすすめです。型検査も同じ理由でこの段階では行いません。

GLR実行中に簡易テーブルを維持する場合、関数引数やforループの変数宣言の扱いが難しくなります。これらは実際には内側のスコープに属し、スコープの境界が波括弧と完全には一致しません。関数定義への還元は左右の波括弧をシフトした後でしかできないため、波括弧をシフトした時点で単純にスコープを操作できず、現在のシンボルスタック上の複数のシンボルを合わせて判断する必要があります。根本的な理由は、GLRが葉から根へASTをボトムアップに作ることです。下位ノードを先に処理するため、その周囲の文脈を把握できません。

GLRの実行後にASTの森を走査し、1本ずつ検査して除外する方法はずっと簡単です。実行中の枝刈りができず、時間と空間の計算量は増えますが、利点は実装が簡単、実装が簡単、そして実装が簡単なことです。実際には両方を組み合わせられます。実行中の枝刈りは安価で、成功すれば後で調べるASTを減らせます。実行後の検査でこの曖昧さは必ず解消できるので、実行中は「不正な枝を見逃しても、正しい枝を誤って切らない」を守ります。

### AST構築中

シンボルのシフトや還元時にノードへ情報を保存して上へ伝えると、後でトップダウンに処理するときすぐ取り出せます。今回の曖昧さには、2つの印を追加しました。

```go
type GLRLabel struct {
	// Declaration 使用，规约出 Declaration 后消除
	TypeDef      bool     // 是否是 TypeDef
	DeclaratorID []*Token // 包含的 Identifier
}
```

typedefは、この宣言が型定義かを示します。最終的にdeclarationへ還元したときに印がなければ、普通の変数宣言です。DeclaratorIDはそのdeclarationが定義するシンボルで、型定義ならユーザー定義型の名前が入ります。function_definitionでも関数名をdeclarationと同じようなdeclaratorで扱うため（`function_definition := declaration_specifiers declarator compound_statement`）、DeclaratorIDには関数名も入ります。

この2つはAST構築中、下位ノードから上位ノードへ伝えます。

```go
gslice.ForEach(children, func(child *AstNode) {
    if child.TypeDef {
        parent.TypeDef = true
    }
    parent.DeclaratorID = append(parent.DeclaratorID, child.DeclaratorID...)
})
```

では、どこで設定するのでしょうか。

typedefは明確です。`storage_class_specifier := TYPEDEF`で還元するとき、そのノードの`typedef`をtrueにします。

DeclaratorIDは少し複雑です。基本は`direct_declarator := IDENTIFIER`です。列挙定数も考慮し、`enumeration_constant := IDENTIFIER`も処理します。

ただし、この2つを無制限に上へ伝えてはいけません。構築後にトップダウンでノードを処理するときは、その階層の情報だけを扱いたく、下位の情報が混ざっていては困ります。Cのスコープでは上位の情報は下位へ伝わりますが、下位の情報は上位に影響しません。そこで特定のノードへの還元時に印を消し、上への伝播を止めます。

`declaration`と`function_definition`への還元時に加え、`direct_declarator`の還元にも注意が必要です。`direct_declarator := direct_declarator LEFT_PARENTHESES parameter_type_list RIGHT_PARENTHESES`のような規則では、右辺の`direct_declarator`にあるDeclaratorIDだけを引き継ぎます。これで`parameter_type_list`の引数宣言が混ざるのを防げます。

AST構築中に確実に行える検査は、次の2つです。

1. ユーザー定義型の使用時に、以前に宣言された型か確認する。変数宣言による隠蔽はまだ確認できない。
2. `declaration_specifiers`にユーザー定義型の`type_specifier`が含まれるなら、`type_specifier`はそれ1つだけにする。ユーザー定義型はすでに完全な型なので、他の型指定子とは組み合わせない。

1つ目は、構築中にユーザー定義型のスコープスタックを維持します。`{`のシフトで新しいスコープを積み、`}`のシフトでスタック先頭のスコープを取り除きます。Declarationへ還元したらtypedefの印を確認し、型定義ならそのノードの全DeclaratorIDをスタック先頭のスコープへ追加します。`typedef_name := IDENTIFIER`で還元したノードでは、`IDENTIFIER`が以前に定義された型であるはずなので、スタックの上から下へ探します。

2つ目は簡単で、`declaration`、`function_definition`、`parameter_declaration`への還元時に`declaration_specifiers`を検査すればよいだけです。

### AST構築後

上記の構築中の検査は型名だけを扱い、変数名を見ていません。そのため、次のような誤りや曖昧さは残ります。

```c
typedef int a;
int main() {
	int a;
	a c;	// 类型 a 已经被变量 a 遮蔽，此处声明不合法
}
```

そこで構築後は、スコープごとに型名と変数名の両方を記録する、もう少し詳しいシンボルテーブルを使います。

```go
type ScopeSymbols struct {
	TypeNames map[string]*entity.Token
	VarNames  map[string]*entity.Token
}
```

構築中と同様、`{`でスコープを積み、`}`でスタック先頭のスコープを取り除きます。`declaration`ノードにtypedefの印があればDeclaratorIDをスタック先頭のスコープの型名に、なければ変数名に追加します。変数名の追加時は、同じスコープに同名の型名がないかを調べ、あればエラーにします。型名を追加するときも逆の検査をします。

関数定義の関数名も、変数シンボルとしてテーブルに追加します。関数定義は`function_definition := declaration_specifiers declarator...`という形で、`declarator`のDeclaratorIDが関数名です。

続いて、型名と変数名の使用箇所を検査します。ユーザー定義型の使用箇所は`typedef_name := IDENTIFIER`だけで、型が定義済みかは構築中に確認済みです。構築後には、さらに内側のスコープの変数名で隠されていないかを調べ、隠されていればエラーにします。変数名は`primary_expression := IDENTIFIER`に現れ、同じように検査します。

変数名を検査する簡単な例です。

```go
func (s *symbolStack) CheckVar(token *entity.Token, depth int) error {
	for i := depth; i >= 0; i-- {
		if previous, ok := s.stack[i].TypeNames[token.Lexeme]; ok {
			return InvalidSymbolKind(token.SourceStart, previous.SourceStart, token.Lexeme)
		}
		if _, ok := s.stack[i].VarNames[token.Lexeme]; ok {
			return nil
		}
	}
	return UndeclaredIdentifier(token.SourceStart, token.Lexeme)
}
```

関数定義とforループでは、スコープを特別扱いします。関数引数やforの条件部分、つまり括弧の中身は、関数やループが置かれたスコープではなく、その内側の関数本体・ループ本体のスコープに属します。forループを例にすると、次のようになります。

```go
currentSymbolStackDepth := s.symbolStack.currentSymbolStackDepth
s.symbolStack.SwitchScope(currentSymbolStackDepth + 1)	// 切换到深层作用域
for i := 0; i < len(node.Children)-1; i++ {
	if err := s.Chop(node.Children[i]); err != nil {
		return err
	}
}
s.symbolStack.SwitchScope(currentSymbolStackDepth)		// 切换回当前作用域
if err := s.Chop(node.Children[len(node.Children)-1]); err != nil {
	// 如果循环体中包含 {，则会自然进入
	return err
}
s.symbolStack.EnterScope(currentSymbolStackDepth)		// 若不存在循环体，则会导致深层作用域无法弹出，这里强行重置一下
```
