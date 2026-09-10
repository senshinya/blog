---
title: "Resolving Type Name and Variable Name Ambiguity in Parsing"
description: "Distinguishing user-defined type names from ordinary variables is a challenge during parsing. A statement such as `a*b;` can be either an arithmetic expression or a declaration. Grammar rules, especially those involving type specifiers, can misidentify variables as types, affecting correctness and readability. The prevalence of declarations without initializers makes this ambiguity especially common."
date: 2025-03-15 20:35:00
categories: [fiddling]
tags: ["Tinkering", "compiler design", "parsing", "disambiguation"]
---

### Introduction

Without a symbol table during parsing, user-defined type names (typedef) are hard to distinguish from ordinary variable names. Inside a function, `a*b;` can mean multiply a by b and discard the result, or declare b with type `a*`.

There are also these grammar rules:

```
declaration := declaration_specifiers SEMICOLON
declaration_specifiers := type_specifier declaration_specifiers
type_specifier := INT
type_specifier := typedef_name
typedef_name := IDENTIFIER
```

Rule 1 is mostly used for forward declarations of structs that require no identifier. For example, `struct Node;` forward-declares the type `struct Node`. But this rule also allows something like `int a;` to be reduced by rule 1, treating a as a user-defined type name instead of a variable name. Declarations without initializers are common, so a source file can produce many ASTs satisfying the grammar. A symbol table in semantic analysis can resolve this, but inexpensive checks during parsing can reduce the number of ASTs semantic analysis must handle.

### Approach

To resolve type-name/variable-name ambiguity, we can prune incorrect branches during or after GLR execution using a lightweight symbol table. At minimum, it must track variable names and user-defined type names. Since names in inner scopes can shadow those in outer scopes, it must also track scope.

The tasks are straightforward:

1. Maintain a symbol table collecting type definitions and variable declarations.
2. When adding a symbol, check for a variable declaration or type definition with the same name in the same scope.
3. For every node reduced by `primary_expression := IDENTIFIER`, verify that `IDENTIFIER` is a declared, unshadowed variable name.
4. For every node reduced by `typedef_name := IDENTIFIER`, verify that `IDENTIFIER` is a declared, unshadowed user-defined type name.

Take the classic `a*b;` example:

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

Example 1: At `a*b;`, scope 1 (outermost) contains a user-defined type a, while scope 2 (the function) has no symbols. In the AST interpreting the statement as a declaration of variable `b` with type `a*`, a is reduced using `typedef_name := IDENTIFIER`. The symbol table confirms that a is a user-defined type declared in scope 1, so we keep this AST. In the AST interpreting it as variable `a` multiplied by variable `b`, a is reduced using `primary_expression := IDENTIFIER`. There is no variable a in the table, so we discard that AST.

Example 2: At `a*b;`, scope 1 contains a user-defined type a and scope 2 contains a variable a, which shadows the type. In the declaration AST, a is reduced using `typedef_name := IDENTIFIER`, but the table shows that a in this scope is a variable, not a user-defined type. We discard this AST. In the multiplication AST, a is reduced using `primary_expression := IDENTIFIER`; the table confirms that a is a variable name, so we keep it.

Unlike a full symbol table, this lightweight version does not check duplicate declarations of variables of the same kind within a scope, although it can check duplicate user-defined type names. Forward declarations make multiple declarations of the same variable legal, while only one may include initialization. Distinguishing initialized declarations during parsing is relatively expensive, so I recommend leaving that to semantic analysis. Type checking is also deferred for cost reasons.

Maintaining the lightweight table during GLR execution makes function parameters and for-loop declarations difficult. Their variables actually belong to an inner scope whose boundaries do not perfectly coincide with braces. A function definition can only be reduced after its opening and closing braces have been shifted, so scopes cannot simply be handled when shifting braces: several symbols on the current symbol stack must be considered together. The underlying reason is that GLR constructs an AST bottom-up, building the root step by step from leaves. Lower nodes are handled first, without awareness of their surrounding context.

Checking and rejecting individual ASTs by traversing the AST forest after GLR finishes is much simpler. It cannot prune during execution and therefore costs more time and memory, but its advantages are simplicity, simplicity, and simplicity. In practice, both approaches can be combined. Pruning during execution is cheap, and every successful pruning reduces the number of ASTs left to check afterward. Since the post-execution checks can always resolve this ambiguity, pruning during execution must follow the rule: better to let a bad branch through than reject a good one.

### During AST construction

When shifting symbols or performing reductions, we can store information in nodes and propagate it upward so that a later top-down traversal can retrieve it quickly. For this ambiguity, I add two markers:

```go
type GLRLabel struct {
	// Declaration 使用，规约出 Declaration 后消除
	TypeDef      bool     // 是否是 TypeDef
	DeclaratorID []*Token // 包含的 Identifier
}
```

typedef marks whether the declaration defines a type. If the marker is absent when a declaration is finally reduced, it is an ordinary variable declaration. DeclaratorID contains the symbols defined by the declaration; for a type definition, it contains the user-defined type names. Since function_definition handles the function name with a declarator much like declaration does (`function_definition := declaration_specifiers declarator compound_statement`), DeclaratorID also includes function names.

During AST construction, these markers propagate from child nodes to parent nodes:

```go
gslice.ForEach(children, func(child *AstNode) {
    if child.TypeDef {
        parent.TypeDef = true
    }
    parent.DeclaratorID = append(parent.DeclaratorID, child.DeclaratorID...)
})
```

When should we set them?

typedef is straightforward: set the current node's `typedef` to true when reducing `storage_class_specifier := TYPEDEF`.

DeclaratorID is more involved. The basic case is `direct_declarator := IDENTIFIER`. Enumeration constants also require handling `enumeration_constant := IDENTIFIER`.

We cannot let these markers propagate upward indefinitely. When later processing a node top-down, we want information belonging to that level, without information from lower levels mixed in. C's scope rules allow information to flow from outer scopes into inner ones, but not the reverse. We therefore clear the markers at certain reductions to stop upward propagation.

Besides reductions to `declaration` and `function_definition`, we need special handling when reducing `direct_declarator`. For a rule such as `direct_declarator := direct_declarator LEFT_PARENTHESES parameter_type_list RIGHT_PARENTHESES`, only propagate DeclaratorID from the right-hand side's `direct_declarator`, avoiding contamination from parameter declarations in `parameter_type_list`.

Two checks can be made safely during AST construction:

1. When a user-defined type is used, check whether it was declared previously. Variable shadowing cannot be checked yet.
2. If `declaration_specifiers` contains a user-defined-type `type_specifier`, it must be the only `type_specifier`: a user-defined type is already complete and should not be combined with other type specifiers.

For the first check, maintain a stack of user-defined-type scopes during construction. Push a new scope when shifting `{` and pop the top scope when shifting `}`. When reducing a Declaration, inspect its typedef marker. If set, add all its DeclaratorID entries to the top scope. At a node reduced by `typedef_name := IDENTIFIER`, this `IDENTIFIER` should refer to a previously defined type; search from the top of the stack downward.

The second check is simple: inspect `declaration_specifiers` when reducing `declaration`, `function_definition`, and `parameter_declaration`.

### After AST construction

The construction-time checks above only consider user-defined types, not variable names, so some errors and ambiguities remain. For example:

```c
typedef int a;
int main() {
	int a;
	a c;	// 类型 a 已经被变量 a 遮蔽，此处声明不合法
}
```

After construction, we therefore need a somewhat more complete symbol table that records both type names and variable names in each scope:

```go
type ScopeSymbols struct {
	TypeNames map[string]*entity.Token
	VarNames  map[string]*entity.Token
}
```

As with the construction-time checks, push a scope on `{` and pop it on `}`. At a `declaration` node, add DeclaratorID to the top scope's type names if the typedef marker is present, or to its variable names otherwise. Before adding a variable name, check whether the top scope already contains a type with that name; if so, return an error. Apply the reverse check when adding a type name.

A function definition's name must also enter the symbol table as a variable symbol. Function definitions have the form `function_definition := declaration_specifiers declarator...`, and DeclaratorID in `declarator` is the function name.

Next, check uses of type and variable names. User-defined types are used only at `typedef_name := IDENTIFIER`. Construction-time checks already verified that the type had been defined. The later check must additionally verify that a variable in an inner scope has not shadowed it; if so, return an error. Variable names appear at `primary_expression := IDENTIFIER` and receive similar checks.

A simple example of checking a variable name:

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

Function definitions and for loops need special scope handling. Function parameters and the parenthesized part of a for loop belong to the inner scope of the function or loop body, rather than the scope containing the function or loop. Taking a for loop as an example:

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
