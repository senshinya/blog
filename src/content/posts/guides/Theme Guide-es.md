---
title: Guía del Tema
published: 2025-01-26
updated: 2025-03-12
tags: ["Tema de Blog","Guía"]
pin: 99
lang: es
abbrlink: theme-guide
---

Retypeset es un tema de blog estático basado en el framework [Astro](https://astro.build/). Inspirado por [Typography](https://astro-theme-typography.vercel.app/), Retypeset establece un nuevo estándar visual y reimagina el diseño de todas las páginas, creando una experiencia de lectura similar a la de los libros impresos, reviviendo la belleza de la tipografía. Detalles en cada mirada, elegancia en cada espacio.

## Configuración del Tema

A continuación se presenta la guía de configuración del tema Retypeset. Personaliza tu blog modificando el archivo de configuración [src/config.ts](https://github.com/radishzzz/astro-theme-retypeset/blob/master/src/config.ts).

### Información del Sitio

```ts
site: {
  // título del sitio
  title: 'Retypeset'
  // subtítulo del sitio
  subtitle: 'Revive the beauty of typography'
  // descripción del sitio
  description: 'Retypeset is a static blog theme...'
  // usar título/subtítulo/descripción en varios idiomas desde src/i18n/ui.ts en lugar de los estáticos anteriores
  i18nTitle: true // true, false
  // nombre del autor
  author: 'radishzz'
  // url del sitio
  url: 'https://retypeset.radishzz.cc'
  // url del favicon
  // formatos recomendados: svg, png o ico
  favicon: '/icon/favicon.svg' // o https://example.com/favicon.svg
}
```

### Color del Tema

```ts
color: {
  // modo de tema predeterminado
  mode: 'light' // light, dark
  // modo claro
  light: {
    // color primario
    // usado para títulos, hover, etc
    primary: 'oklch(25% 0.005 298)'
    // color secundario
    // usado para texto de publicaciones
    secondary: 'oklch(40% 0.005 298)'
    // color de fondo
    background: 'oklch(96% 0.005 298)'
  }
  // modo oscuro
  dark: {
    // color primario
    // usado para títulos, hover, etc
    primary: 'oklch(92% 0.005 298)'
    // color secundario
    // usado para texto de publicaciones
    secondary: 'oklch(77% 0.005 298)'
    // color de fondo
    background: 'oklch(22% 0.005 298)'
  }
}
```

### Configuración Global

```ts
global: {
  // idioma predeterminado
  // idioma de la ruta raíz del sitio '/'
  locale: 'zh' // zh, zh-tw, ja, en, es, ru
  // más idiomas
  // Genera rutas multilingües como '/es/' '/ru/'
  // no incluir el idioma predeterminado nuevamente, puede ser un array vacío []
  moreLocales: ['zh-tw', 'ja', 'en', 'es', 'ru'] // ['zh', 'zh-tw', 'ja', 'en', 'es', 'ru']
  // estilo de fuente
  fontStyle: 'sans' // sans, serif
  // formato de fecha para publicaciones
  dateFormat: 'YYYY-MM-DD' // YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, MONTH DAY YYYY, DAY MONTH YYYY
  // espacio entre título y subtítulo
  titleGap: 2 // 1, 2, 3
  // habilitar KaTeX para renderizar fórmulas matemáticas
  katex: true // true, false
}
```

### Sistema de Comentarios

```ts
comment: {
  // habilitar sistema de comentarios
  enabled: true // true, false
  // sistema de comentarios waline
  waline: {
    // URL del servidor
    serverURL: 'https://retypeset-comment.radishzz.cc'
    // URL de emojis
    emoji: [
      'https://unpkg.com/@waline/emojis@1.2.0/tw-emoji'
      // 'https://unpkg.com/@waline/emojis@1.2.0/bmoji'
      // más emojis: https://waline.js.org/en/guide/features/emoji.html
    ]
    // búsqueda de gif
    search: false // true, false
    // cargador de imágenes
    imageUploader: false // true, false
  }
}
```

### SEO

```ts
seo: {
  // ID de Twitter
  twitterID: '@radishzz_'
  // verificación del sitio
  verification: {
    // google search console
    google: 'AUCrz5F1e5qbnmKKDXl2Sf8u6y0kOpEO1wLs6HMMmlM'
    // herramientas para webmasters de bing
    bing: '64708CD514011A7965C84DDE1D169F87'
    // webmaster de yandex
    yandex: ''
    // búsqueda baidu
    baidu: ''
  }
  // google analytics
  googleAnalyticsID: ''
  // umami analytics
  umamiAnalyticsID: '520af332-bfb7-4e7c-9386-5f273ee3d697'
  // verificación de seguimiento
  follow: {
    // ID de feed
    feedID: ''
    // ID de usuario
    userID: ''
  }
  // clave de acceso apiflash
  // genera automáticamente capturas de pantalla del sitio web para imágenes de open graph
  // obtén tu clave de acceso en: https://apiflash.com/
  apiflashKey: ''
}
```

### Configuración del Pie de Página

```ts
footer: {
  // enlaces sociales
  links: [
    {
      name: 'RSS',
      url: '/rss.xml', // rss.xml, atom.xml
    },
    {
      name: 'GitHub',
      url: 'https://github.com/radishzzz/astro-theme-retypeset',
    },
    {
      name: 'Twitter',
      url: 'https://x.com/radishzz_',
    },
    // {
    //   name: 'Email',
    //   url: 'https://example@gmail.com',
    // }
  ]
  // año de inicio del sitio web
  startYear: 2024
}
```

### Precargar Recursos

```ts
preload: {
  // estrategias de precarga de enlaces
  linkPrefetch: 'viewport' // hover, tap, viewport, load
  // URL del servidor de comentarios
  commentURL: 'https://retypeset-comment.radishzz.cc'
  // URL de alojamiento de imágenes
  imageHostURL: 'https://image.radishzz.cc'
  // js personalizado de google analytics
  // para usuarios que redirigen javascript de analytics a un dominio personalizado
  customGoogleAnalyticsJS: ''
  // js personalizado de umami analytics
  // para usuarios que implementan umami por su cuenta, o redirigen javascript de analytics a un dominio personalizado
  customUmamiAnalyticsJS: 'https://js.radishzz.cc/jquery.min.js'
}
```

## Creación de un Nuevo Artículo

Crea un nuevo archivo con extensión `.md` o `.mdx` en el directorio `src/content/posts/`, y añade los metadatos Front Matter en la parte superior del archivo.

### Front Matter

```markdown
---
# Obligatorio
title: Guía del Tema
published: 2025-01-26

# Opcional
description: Los primeros 240 caracteres del artículo se seleccionarán automáticamente como descripción.
updated: 2025-03-26
tags: ["Tema de Blog", "Guía"]

# Avanzado, opcional
draft: true/false
pin: 1-99
toc: true/false
lang: en/es/ru/zh/zh-tw/ja
abbrlink: theme-guide
---
```

### Configuración Avanzada

#### draft

Marca el artículo como borrador. Cuando se establece como true, el artículo no se puede publicar y solo está disponible para vista previa en desarrollo local. El valor predeterminado es false.

#### pin

Fija el artículo en la parte superior. Cuanto mayor sea el número, mayor será la prioridad del artículo fijado. El valor predeterminado es 0, lo que significa que no está fijado.

#### toc

¿Generar índice? Valor predeterminado: true.

#### lang

Especifica el idioma del artículo. Solo se puede especificar un idioma. Si no se especifica, el artículo se mostrará en todas las rutas de idioma por defecto.

```md
# src/config.ts
# locale: 'en'
# moreLocales: ['es', 'ru']

# lang: ''
src/content/posts/apple.md   -> example.com/posts/apple/
                             -> example.com/es/posts/apple/
                             -> example.com/ru/posts/apple/
# lang: en
src/content/posts/apple.md   -> example.com/posts/apple/
# lang: es
src/content/posts/apple.md   -> example.com/es/posts/apple/
# lang: ru
src/content/posts/apple.md   -> example.com/ru/posts/apple/
```

#### abbrlink

Personaliza la URL del artículo.

```md
# src/config.ts
# locale: 'en'
# moreLocales: ['es', 'ru']
# lang: 'es'

# abbrlink: ''
src/content/posts/apple.md           ->  example.com/es/posts/apple/
src/content/posts/guide/apple.md     ->  example.com/es/posts/guide/apple/
src/content/posts/2025/03/apple.md   ->  example.com/es/posts/2025/03/apple/

# abbrlink: 'banana'
src/content/posts/apple.md           ->  example.com/es/posts/banana/
src/content/posts/guide/apple.md     ->  example.com/es/posts/banana/
src/content/posts/2025/03/apple.md   ->  example.com/es/posts/banana/
```

### Funciones Automatizadas

Calcula automáticamente el tiempo de lectura del artículo. Genera automáticamente imágenes Open Graph para cada artículo. Los artículos con el mismo abbrlink compartirán automáticamente comentarios de Waline, independientemente de la configuración de lang.
