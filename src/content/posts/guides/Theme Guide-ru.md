---
title: Руководство по теме
published: 2025-01-26
updated: 2025-03-12
tags: ["Тема блога","Руководство"]
pin: 99
lang: ru
abbrlink: theme-guide
---

Retypeset — это статическая тема блога, основанная на фреймворке [Astro](https://astro.build/). Вдохновленная [Typography](https://astro-theme-typography.vercel.app/), Retypeset устанавливает новый визуальный стандарт и переосмысливает компоновку всех страниц, создавая опыт чтения, напоминающий печатные книги, возрождая красоту типографики. Детали в каждом взгляде, элегантность в каждом пространстве.

## Конфигурация темы

Ниже приведено руководство по конфигурации темы Retypeset. Настройте свой блог, изменяя конфигурационный файл [src/config.ts](https://github.com/radishzzz/astro-theme-retypeset/blob/master/src/config.ts).

### Информация о сайте

```ts
site: {
  // заголовок сайта
  title: 'Retypeset'
  // подзаголовок сайта
  subtitle: 'Revive the beauty of typography'
  // описание сайта
  description: 'Retypeset is a static blog theme...'
  // использовать многоязычные заголовок/подзаголовок/описание из src/i18n/ui.ts вместо статических выше
  i18nTitle: true // true, false
  // имя автора
  author: 'radishzz'
  // адрес сайта
  url: 'https://retypeset.radishzz.cc'
  // url фавикона
  // рекомендуемые форматы: svg, png или ico
  favicon: '/icon/favicon.svg' // или https://example.com/favicon.svg
}
```

### Цвет темы

```ts
color: {
  // режим темы по умолчанию
  mode: 'light' // light, dark
  // светлый режим
  light: {
    // основной цвет
    // используется для заголовков, эффекта наведения и т.д.
    primary: 'oklch(25% 0.005 298)'
    // вторичный цвет
    // используется для текста постов
    secondary: 'oklch(40% 0.005 298)'
    // цвет фона
    background: 'oklch(96% 0.005 298)'
  }
  // темный режим
  dark: {
    // основной цвет
    // используется для заголовков, эффекта наведения и т.д.
    primary: 'oklch(92% 0.005 298)'
    // вторичный цвет
    // используется для текста постов
    secondary: 'oklch(77% 0.005 298)'
    // цвет фона
    background: 'oklch(22% 0.005 298)'
  }
}
```

### Глобальные настройки

```ts
global: {
  // язык по умолчанию
  // язык корневого пути сайта '/'
  locale: 'zh' // zh, zh-tw, ja, en, es, ru
  // дополнительные языки
  // Создает многоязычные пути, такие как '/es/' '/ru/'
  // не указывайте повторно язык по умолчанию, можно оставить пустым массивом []
  moreLocales: ['zh-tw', 'ja', 'en', 'es', 'ru'] // ['zh', 'zh-tw', 'ja', 'en', 'es', 'ru']
  // стиль шрифта
  fontStyle: 'sans' // sans, serif
  // формат даты для постов
  dateFormat: 'YYYY-MM-DD' // YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, MONTH DAY YYYY, DAY MONTH YYYY
  // промежуток между заголовком и подзаголовком
  titleGap: 2 // 1, 2, 3
  // включить KaTeX для отображения математических формул
  katex: true // true, false
}
```

### Система комментариев

```ts
comment: {
  // включить систему комментариев
  enabled: true // true, false
  // система комментариев waline
  waline: {
    // URL сервера
    serverURL: 'https://retypeset-comment.radishzz.cc'
    // URL эмодзи
    emoji: [
      'https://unpkg.com/@waline/emojis@1.2.0/tw-emoji'
      // 'https://unpkg.com/@waline/emojis@1.2.0/bmoji'
      // дополнительные эмодзи: https://waline.js.org/en/guide/features/emoji.html
    ]
    // поиск gif
    search: false // true, false
    // загрузчик изображений
    imageUploader: false // true, false
  }
}
```

### SEO

```ts
seo: {
  // @twitter ID
  twitterID: '@radishzz_'
  // верификация сайта
  verification: {
    // консоль поиска Google
    google: 'AUCrz5F1e5qbnmKKDXl2Sf8u6y0kOpEO1wLs6HMMmlM'
    // инструменты вебмастера Bing
    bing: '64708CD514011A7965C84DDE1D169F87'
    // вебмастер Яндекса
    yandex: ''
    // поиск Baidu
    baidu: ''
  }
  // Google Analytics
  googleAnalyticsID: ''
  // Umami Analytics
  umamiAnalyticsID: '520af332-bfb7-4e7c-9386-5f273ee3d697'
  // верификация подписки
  follow: {
    // ID ленты
    feedID: ''
    // ID пользователя
    userID: ''
  }
  // ключ доступа apiflash
  // автоматически генерирует скриншоты веб-сайта для изображений Open Graph
  // получите ключ доступа на: https://apiflash.com/
  apiflashKey: ''
}
```

### Настройки подвала

```ts
footer: {
  // социальные ссылки
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
  // год начала работы веб-сайта
  startYear: 2024
}
```

### Предзагрузка ресурсов

```ts
preload: {
  // стратегии предзагрузки ссылок
  linkPrefetch: 'viewport' // hover, tap, viewport, load
  // URL сервера комментариев
  commentURL: 'https://retypeset-comment.radishzz.cc'
  // URL хостинга изображений
  imageHostURL: 'https://image.radishzz.cc'
  // пользовательский скрипт Google Analytics
  // для пользователей, которые направляют JavaScript аналитики на собственный домен
  customGoogleAnalyticsJS: ''
  // пользовательский скрипт Umami Analytics
  // для пользователей, которые развертывают Umami самостоятельно или направляют JavaScript аналитики на собственный домен
  customUmamiAnalyticsJS: 'https://js.radishzz.cc/jquery.min.js'
}
```
## Создание Новой Статьи

Создайте новый файл с расширением `.md` или `.mdx` в директории `src/content/posts/` и добавьте метаданные Front Matter в верхней части файла.

### Front Matter

```markdown
---
# Обязательно
title: Руководство по теме
published: 2025-01-26

# Опционально
description: Первые 240 символов статьи будут автоматически выбраны в качестве описания.
updated: 2025-03-26
tags: ["Тема блога", "Руководство"]

# Расширенные настройки, опционально
draft: true/false
pin: 1-99
toc: true/false
lang: en/es/ru/zh/zh-tw/ja
abbrlink: theme-guide
---
```

### Расширенная Конфигурация

#### draft

Помечает статью как черновик. Если установлено значение true, статья не может быть опубликована и доступна только для предварительного просмотра при локальной разработке. По умолчанию - false.

#### pin

Закрепляет статью вверху. Чем выше число, тем выше приоритет закрепленной статьи. По умолчанию - 0, что означает отсутствие закрепления.

#### toc

Генерировать оглавление. По умолчанию: true.

#### lang

Указывает язык статьи. Можно указать только один язык. Если не указано, статья будет отображаться во всех языковых путях по умолчанию.

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

Настраивает URL статьи.

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

### Автоматические Функции

Автоматически рассчитывает время чтения статьи. Автоматически генерирует изображения Open Graph для каждой статьи. Статьи с одинаковым abbrlink будут автоматически совместно использовать комментарии Waline, независимо от настройки lang.
