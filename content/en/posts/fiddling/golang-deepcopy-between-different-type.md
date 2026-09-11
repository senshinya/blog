---
authorship: human-only
title: "Deep Copying Between Different Struct Types in Go"
description: "While refactoring a system, converting entities between layers made deep copying surprisingly awkward. A product VO in the view layer, an entity in the domain layer, and a PO in the persistence layer can look nearly identical, yet small type differences complicate direct conversion. I used reflection to build a general conversion method, reducing repetitive assembler methods and making the code more maintainable and flexible."
date: 2022-08-15 01:05:01
categories: [fiddling]
tags: ["Go","Reflection","Deep copy","Struct conversion"]
image: "https://blog-img.774352199.xyz/Blhm0I.webp"
seoDescription: "Use Go reflection to deep-copy structs across entity types, handling slices, maps, pointer conversions, and zero values for missing source fields."
---

I have been swamped with a system refactor lately. The blog has been gathering dust for a while.

One particularly annoying part of the refactor was converting entities between layers of a layered architecture. Take a product: the view layer may have a product VO, the domain layer a product entity or DO (domain object), and the persistence layer a product PO corresponding to a database entity...

Most of these structures are similar; many are almost or entirely identical. Others have tiny differences, such as a field being a pointer in one struct but not in another, which prevents a direct cast. That means writing lots of assembler methods to convert entities, and complicated structures make this sheer hell. Fundamentally, it is just a deep copy that cannot be handled because the types differ.

I wondered whether reflection could solve this with a reasonably general conversion method for this particular situation. An afternoon later, the following code was born:

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

The core is copyRecursive. It handles deep copies of structs, slices, and maps, including copies from pointer to non-pointer types and vice versa. The only requirement when copying structs is that every field in the destination struct have a field with the same name and underlying type in the source struct, allowing the recursive deep copy to proceed.

I will not explain the code in detail, but I do have to say:

Reflection is fucking awesome.

---

20220820 update: Copying into structs whose fields do not all exist under the same names in the source is now supported. When there is no matching source field, the destination field receives its zero value: nil for pointers and an empty struct for structs.
