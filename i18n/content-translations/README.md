# Blog translation guide

Chinese files under content/zh are the source. Mirror each relative path under content/en and content/ja. Do not change Chinese originals. Translate complete articles, never summaries; preserve section order, all arguments, examples, dates, caveats, jokes, personal details, blockquotes, tables, footnotes and images. Preserve the author's first-person voice and informal engineering-blog register. English should read like an English-language engineering blog; Japanese should read like a native Japanese personal technical blog, using natural です・ます prose without mechanical Chinese syntax. Do not add claims or update historical technical instructions.

## Titles and links

`titles.json` is the canonical title registry for all 45 posts and the friends page. These files are editorial references; the existing i18n runtime discovers translated content from the mirrored locale directories. Use its exact en/ja titles in frontmatter and whenever another article is cited by its full title. Generic labels such as “the previous post” can remain generic. Keep filenames, slugs, dates, categories, type, draft status, permalink and technical identifiers unchanged. For links to articles present in this registry, prepend /en or /ja to the canonical path (paths do NOT contain /posts). Keep external links and image URLs unchanged. For travel links, use the corresponding locale prefix when a translation is available; see `travels.json` for canonical travel paths and titles. A draft remains a draft in every locale. Check fragment links when translating headings; keep explicit anchors stable or adjust links to translated headings.

Translate descriptions, image alt text, prose in HTML/MDC components, reference labels and human-readable tags. Preserve executable code and configuration exactly, including string values and code comments: they remain faithful reproducible source examples. Translate explanations surrounding code; do not execute blog commands. Code and screenshots may contain Chinese, which is not untranslated article prose. Preserve code fences, math, HTML attributes, component names, link destinations and indentation. Tags in existing Latin spelling retain source spelling/case; use the glossary for Chinese tags consistently. Deduplicate tags that become identical after translation (for example, 苹果 and Apple).

## Shared terminology

| Chinese | English | Japanese |
| --- | --- | --- |
| 折腾 (tag) | Tinkering | 試行錯誤 |
| 日常 (tag) | Daily Life | 日常 |
| 胃炎 (tag) | Gastritis | 胃炎 |
| 工作 (tag) | Work | 仕事 |
| 年度总结 (tag) | Year in Review | 年間の振り返り |
| 计划 (tag) | Plans | 計画 |
| 年度计划 (tag) | Annual Plans | 年間計画 |
| 三体 (tag) | The Three-Body Problem | 三体 |
| 读书 (tag) | Reading | 読書 |
| 旁路由 | side router | サイドルーター |
| 主路由 | main router | メインルーター |
| 软路由 | software router | ソフトウェアルーター |
| 透明代理 | transparent proxy | 透過プロキシ |
| 分流 | traffic routing | トラフィック振り分け |
| 国内 / 国外 (networking) | within China / overseas | 中国国内 / 中国国外 |
| 翻墙 | censorship circumvention | 検閲回避 |
| 梯子 (networking) | circumvention proxy | 検閲回避用プロキシ |
| 防火墙 | firewall | ファイアウォール |
| 国际互联网 | global Internet | グローバルインターネット |
| 自托管 | self-hosting | セルフホスティング |
| 环境搭建 | environment setup | 環境構築 |
| 组网 | networking | ネットワーク構築 |
| 实验 (tag) | labs | 実験 |
| 端口映射 | port forwarding | ポート転送 |
| 类型系统 | type systems | 型システム |
| 编程语言 | programming languages | プログラミング言語 |
| 反射 | reflection | リフレクション |
| 深拷贝 | deep copy | ディープコピー |
| 编译原理 | compiler design | コンパイラ設計 |
| 语法分析 | parsing | 構文解析 |
| 歧义消除 | disambiguation | 曖昧性の解消 |
| 心率 | heart rate | 心拍数 |
| 苹果 / Apple | Apple | Apple |
| Apple 智能 | Apple Intelligence | Apple Intelligence |
| 手机 | smartphone | スマートフォン |
| 微软模拟飞行 | Microsoft Flight Simulator | Microsoft Flight Simulator |
| 图马思特 | Thrustmaster | Thrustmaster |
| 事务 | transaction | トランザクション |
| 事务管理器 | Transaction Manager (TM) | トランザクションマネージャー（TM） |
| 数据管理器 | Data Manager (DM) | データマネージャー（DM） |
| 版本管理器 | Version Manager (VM) | バージョンマネージャー（VM） |
| 表管理器 | Table Manager (TBM) | テーブルマネージャー（TBM） |
| 引用计数 | reference counting | 参照カウント |
| 两段锁 | two-phase locking (2PL) | 二相ロック（2PL） |
| 可串行化 | serializability | 直列化可能性 |
| 多版本并发控制 | multiversion concurrency control (MVCC) | 多版型同時実行制御（MVCC） |
| 死锁 | deadlock | デッドロック |
| 回滚 | rollback | ロールバック |
| 脏读 | dirty read | ダーティリード |
| 不可重复读 | non-repeatable read | 非反復読み取り |
| 幻读 | phantom read | ファントムリード |
| 已提交读 | read committed | READ COMMITTED |
| 可重复读 | repeatable read | REPEATABLE READ |
| 共识 | consensus | 合意 |
| 领导人 / Leader | leader | リーダー |
| 跟随者 / Follower | follower | フォロワー |
| 候选人 / Candidate | candidate | 候補者 |
| 任期 | term | 任期 |
| 日志复制 | log replication | ログレプリケーション |
| 心跳 | heartbeat | ハートビート |
| 字节 / 字节跳动 | ByteDance | ByteDance |
| npy（女朋友） | my girlfriend | 彼女 |

The author explicitly uses `npy` to mean “my girlfriend”. Preserve this relationship and gender: use “my girlfriend” in English and “彼女” in Japanese; do not neutralize it to “my partner”.

Preserve product spelling in prose: Go, Java, RISC-V, MapReduce, Raft, MYDB, OPNsense, OpenWrt, sing-box, FakeIP, AdGuard Home, Cloudflare, WARP, Grafana, InfluxDB, Apple Watch, macOS, iPadOS, Next.js, React, Vue, VitePress, MoonTV, LibreTV, Cursor, Xiaomi, OPPO. For China-specific products without an established translation, keep the original product name and briefly explain its role only when needed for comprehension. Preserve author handles and anonymized initials.

## Travel journals

Chinese sources live under `app/travels/zh/`. Mirror YAML files under `app/travels/en/` and `app/travels/ja/`; the existing registry discovers these automatically. `travels.json` defines the canonical destination titles and full post titles. English uses Kansai for 近畿地方; Japanese retains 近畿地方, with 関西 used naturally in generic references such as 関西旅行.

Translate every `title`, `posttitle`, `description`, `descriptions` item, photo `alt`, and photo `caption`. Preserve every key, list order, repeated day number, photo, `slug`, `subtitle`, `published`, `totaldays`, `coverImage`, `src`, `lat`, `lng`, and `draft` value. In particular, the Korea journal remains `draft: true` in all three languages. Short captions should sound like photo captions; retain the author's jokes and first-person observations without inventing new facts. Use established local names rather than transliterating Mandarin readings.

| Chinese | English | Japanese |
| --- | --- | --- |
| 近畿地方 / 关西 | Kansai | 近畿地方 / 関西 |
| 京都 | Kyoto | 京都 |
| 奈良 | Nara | 奈良 |
| 鸭川 | Kamo River | 鴨川 |
| 春日大社 | Kasuga Taisha | 春日大社 |
| 东大寺 | Tōdai-ji | 東大寺 |
| 若草山 | Mount Wakakusa | 若草山 |
| 因幡堂平等寺 | Inabadō (Byōdō-ji) | 因幡堂（平等寺） |
| 广目天王 | Kōmokuten | 広目天 |
| 关西国际机场 | Kansai International Airport | 関西国際空港 |
| 南韩 | South Korea | 韓国 |
| 釜山 | Busan | 釜山 |
| 首尔 | Seoul | ソウル |
| 金海机场 | Gimhae Airport | 金海空港 |
| 海云台 | Haeundae | 海雲台 |
| 海东龙宫寺 | Haedong Yonggungsa | 海東龍宮寺 |
| 机张 | Gijang | 機張 |
| 松岛 | Songdo | 松島 |
| 松岛缆车 | Songdo cable car | 松島海上ロープウェイ |
| 南山 | Namsan | 南山 |
| 首尔塔 | N Seoul Tower | Nソウルタワー |
| 仁川机场 | Incheon Airport | 仁川空港 |
| 星空图书馆 | Starfield Library | ピョルマダン図書館 |
| 景福宫 | Gyeongbokgung | 景福宮 |
| 光化门广场 | Gwanghwamun Square | 光化門広場 |
| 世宗大王 | King Sejong | 世宗大王 |
| 北岳山 | Bugaksan | 北岳山 |
| 中秋 (Korea) | Chuseok | 秋夕 |
| 拌饭 | bibimbap | ビビンバ |
| 部队锅 | budae jjigae | プデチゲ |
| 丰饶巨鹿 (game reference) | Abundant Ebon Deer | 豊穣の玄鹿 |
| 黑猴 (game nickname) | Black Myth: Wukong | 黒神話：悟空 |
| 双影奇境 | Split Fiction | スプリット・フィクション |

For the Songdo aerial cable car, use 松島海上ロープウェイ, following [Visit Busan](https://www.visitbusan.net/index.do?menuCd=DOM_000000401001001000&uc_seq=1422); individual cabins can be ゴンドラ. Do not mechanically apply this to other facilities: 南山ケーブルカー is an established local name.

In the Xiaomi root article, the garbled source label “仅换换挂载” is interpreted as “仅还原挂载” / “Unmount only”, based on the [ZygiskNext release notes](https://github.com/Dr-TSNG/ZygiskNext/releases). The surrounding English setting is described as the denylist policy; Japanese uses 除外リストのポリシー and アンマウントのみ.

## Editorial clarification (2026-09-11)

The author defines 铁批 as an avid or die-hard player of 崩坏：星穹铁道 (Honkai: Star Rail), not merely any player. In playful captions, use “a die-hard Honkai: Star Rail fan” in English and “崩壊：スターレイルのガチ勢” in Japanese, retaining the teasing tone. The current editorial review also authorizes correcting clear language errors in the Chinese sources; preserve uncertain facts for author confirmation.
