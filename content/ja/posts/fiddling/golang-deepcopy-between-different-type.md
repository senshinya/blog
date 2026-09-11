---
authorship: human-only
title: "Goで異なる型の構造体をディープコピーする"
description: "システムのリファクタリングで、階層ごとのエンティティ変換に苦労しました。ビュー層の商品VO、ドメイン層のentity、永続化層のPOは似ていても、型のわずかな違いで直接変換できず、ディープコピーが面倒になります。そこでリフレクションを使った汎用的な変換処理を実装し、大量のassemblerメソッドを減らして、保守性と柔軟性を高めることにしました。"
date: 2022-08-15 01:05:01
categories: [fiddling]
tags: ["Go","リフレクション","ディープコピー","構造体変換"]
image: "https://blog-img.774352199.xyz/Blhm0I.webp"
seoDescription: "レイヤー間のエンティティ変換をGoのリフレクションで実装。異なる構造体、Slice、Map、ポインターを再帰的にコピーし、コピー元にないフィールドにはゼロ値を設定します。"
---

最近はシステムのリファクタリングで大忙しです。ブログもすっかり放置してしまいました。

その中で、かなり厄介な問題に出会いました。レイヤードアーキテクチャにおける、階層ごとのエンティティの相互変換です。商品を例にすると、ビュー層には商品VO、ドメイン層には商品entity、あるいはDO（domain object）、永続化層にはデータベースのエンティティに対応する商品POがある、といった具合です。

これらの構造は大抵よく似ていて、ほぼ同じ、あるいは完全に同じものもあります。ただ、あるフィールドが一方ではポインター型で、もう一方では非ポインター型という微妙な違いがあると、直接キャストできません。そこで変換用のassemblerメソッドを大量に書くことになりますが、複雑な構造になるとまさに地獄です。本質的にはディープコピーなのに、型が違うというだけで処理できないわけです。

この特殊なケースを少し汎用的に扱える変換処理を、リフレクションで作れないかと考えました。そうして午後いっぱいかけて生まれたのが、次のコードです。

```go
func Copy(src interface{}, dstType interface{}) interface{} {
    if src == nil {
        return nil
    }
    cpy := reflect.New(reflect.TypeOf(dstType)).Elem()
    copyRecursive(reflect.ValueOf(src), cpy)
    return cpy.Interface()
}
 
func copyRecursive(src, dst reflect.Value) {
    switch src.Kind() {
    case reflect.Ptr:
        originValue := src.Elem()
        if !originValue.IsValid() {
            return
        }
        // 允许 src 为 ptr 而 dst 为非 ptr
        if dst.Kind() == reflect.Ptr {
            dst.Set(reflect.New(dst.Type().Elem()))
            copyRecursive(originValue, dst.Elem())
        } else {
            dst.Set(reflect.New(dst.Type()).Elem())
            copyRecursive(originValue, dst)
        }
    case reflect.Interface:
        if src.IsNil() {
            return
        }
        originValue := src.Elem()
        copyValue := reflect.New(dst.Type().Elem()).Elem()
        copyRecursive(originValue, copyValue)
        dst.Set(copyValue)
    case reflect.Struct:
        // time.Time 需要特殊处理
        t, ok := src.Interface().(time.Time)
        if ok {
            dst.Set(reflect.ValueOf(t))
            return
        }
        if dst.Kind() == reflect.Ptr {
            // 目标类型是指针而源类型不是指针
            copyValue := reflect.New(dst.Type().Elem()).Elem()
            copyRecursive(src, copyValue)
            dst.Set(copyValue.Addr())
            return
        }
        for i := 0; i < dst.NumField(); i++ {
            if dst.Type().Field(i).PkgPath != "" {
                // 不可导出的字段不拷贝
                continue
            }
            field := src.FieldByName(dst.Type().Field(i).Name)
            if !field.IsValid() {
                // 源字段不存在，忽略（目标自动零值）
                continue
            }
            copyRecursive(field, dst.Field(i))
        }
    case reflect.Slice:
        if src.IsNil() {
            return
        }
        dst.Set(reflect.MakeSlice(dst.Type(), src.Len(), src.Cap()))
        for i := 0; i < src.Len(); i++ {
            copyRecursive(src.Index(i), dst.Index(i))
        }
    case reflect.Map:
        if src.IsNil() {
            return
        }
        dst.Set(reflect.MakeMap(dst.Type()))
        for _, key := range src.MapKeys() {
            value := src.MapIndex(key)
            copyValue := reflect.New(dst.Type().Elem()).Elem()
            copyRecursive(value, copyValue)
            copyKey := Copy(key.Interface(), reflect.New(dst.Type().Key()).Elem().Interface())
            dst.SetMapIndex(reflect.ValueOf(copyKey), copyValue)
        }
    default:
        // 源类型是基础类型
        // 类型不一致但底层类型一致的基本类型，需要强转
        if dst.Kind() == reflect.Ptr {
            // 目标类型是指针而源类型不是指针
            copyValue := reflect.New(dst.Type().Elem()).Elem()
            copyRecursive(src, copyValue)
            dst.Set(copyValue.Addr())
            return
        }
        dst.Set(src.Convert(dst.Type()))
    }
}
```

中心となるのはcopyRecursiveです。構造体、Slice、Mapのディープコピーに対応し、ポインター型から非ポインター型、その逆のコピーもできます。唯一の条件は、構造体をコピーするとき、コピー先の全フィールドに対して、同名かつ基になる型が同じフィールドがコピー元に存在することです。これで再帰的なディープコピーができます。

コードの仕組みを細かく説明するつもりはありませんが、これだけは言わせてください。

リフレクション、マジですごい。

---

20220820 update：コピー先に、コピー元にはないフィールドが含まれる場合にも対応しました。一致するフィールドがない場合、コピー先のフィールドにはゼロ値を設定します。ポインターならnil、構造体なら空の構造体です。
