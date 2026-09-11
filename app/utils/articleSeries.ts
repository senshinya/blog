/** Curated reading order; each overview lives on the first article. */
export const articleSeries = [
	{
		id: 'mydb',
		title: { zh: 'MYDB：用 Java 实现数据库', en: 'MYDB: building a database in Java', ja: 'MYDB：Java でデータベースを作る' },
		intro: { zh: '从项目结构开始，依次实现事务、缓存、恢复、版本、索引和表管理，最后连接客户端与服务端。', en: 'Start with the architecture, then build transactions, caching, recovery, versioning, indexes and tables before connecting the client and server.', ja: '全体構成から始め、トランザクション、キャッシュ、復旧、バージョン、索引、テーブル管理を順に実装し、最後にクライアントとサーバーをつなぎます。' },
		paths: Array.from({ length: 11 }, (_, i) => `/projects/mydb/mydb${i}`),
	},
	{
		id: 'networking',
		title: { zh: '旁路由与透明代理', en: 'Gateways and transparent proxies', ja: 'サブゲートウェイと透過プロキシ' },
		intro: { zh: '从 Debian 旁路由配置入手，排查端口映射，再阅读 OPNsense、FakeIP 与 BGP 分流方案，最后扩展到跨城网络与 IPv6 出口。', en: 'Begin with the Debian gateway and port forwarding, compare OPNsense, FakeIP and BGP routing, then explore cross-city networking and IPv6 egress.', ja: 'Debian の構築とポート転送から始め、OPNsense、FakeIP、BGP の振り分けを比較し、都市間ネットワークと IPv6 出口へ進みます。' },
		paths: ['debian-as-bypass-router', 'fix-port-forward-in-bypass-router', 'opnsense-transparent-proxy', 'fake-ip-based-transparent-proxy', 'more-accurate-chnroute', 'cross-city-network-setup', 'vps-warp-ipv6'].map(slug => `/fiddling/${slug}`),
	},
	{
		id: 'mit-65840',
		title: { zh: 'MIT 6.5840 / 6.824：论文与实验', en: 'MIT 6.5840 / 6.824: papers and labs', ja: 'MIT 6.5840 / 6.824：論文と実験' },
		intro: { zh: '先读 MapReduce 论文并实现实验一，再读 Raft 论文与 Leader 选举实验。课程实验以文中使用的年份为准。', en: 'Read MapReduce and implement its lab, then study Raft and leader election. Lab instructions follow the course year used in each article.', ja: 'MapReduce の論文と実験を終えてから、Raft の論文とリーダー選出へ進みます。実験の仕様は各記事で扱う年度に従います。' },
		paths: ['mapreducepaper', 'mapreducelab', 'reftextendedpaper', 'raftlab2a'].map(slug => `/notes/65840/${slug}`),
	},
	{
		id: 'go-riscv',
		title: { zh: 'Go、RISC-V 与语言实现', en: 'Go, RISC-V and language implementation', ja: 'Go、RISC-V と言語実装' },
		intro: { zh: '先搭建 RISC-V 工具链和 Spike 环境，再看 Go 裸机尝试及其链接器问题；编程语言笔记补充编译与类型系统背景。', en: 'Set up the RISC-V toolchain and Spike, then follow the bare-metal Go attempt and its linker issues. The language notes add compiler and type-system context.', ja: 'RISC-V ツールチェーンと Spike を用意し、Go のベアメタル実行とリンカーの問題をたどります。言語の考察でコンパイラと型システムの背景を補います。' },
		paths: ['spike-install', 'go-os', 'chitchat-about-programming-language', 'parser-type-variable-ambiguity'].map(slug => `/fiddling/${slug}`),
	},
]
