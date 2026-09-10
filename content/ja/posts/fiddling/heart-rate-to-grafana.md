---
authorship: human-only
title: "My Heart Beats for U：心拍数をGrafanaで可視化する"
description: "Appleヘルスケアの心拍数を定期的にサーバーへ同期し、Grafanaで可視化して直感的に確認できるようにしました。Health Auto ExportのREST API機能でHTTPエンドポイントへデータを送り、InfluxDBに保存します。Grafanaのダッシュボードから、自分の心拍数の変化を追ったり分析したりできます。"
date: 2025-03-31 23:51:00
categories: [fiddling]
tags: ["試行錯誤", "Grafana", "心拍数", "Apple Watch"]
image: "https://blog-img.774352199.xyz/F4qD2T.webp"
---

ちょっとしたものを作りました。Appleヘルスケアの心拍数を定期的にサーバーへ同期して、Grafanaでグラフにします。こんな感じです。

![](https://blog-img.774352199.xyz/2025/e01807e95f9c8ea4384d2c4d8f4fe3cb.png)

<del>ブログ右上の♥️から見られます。Cloudflare Tunnel経由なので中国国内からは遅く、できれば検閲回避用プロキシ🪜を使ってください。</del>現在は公開を終了しています。OPPOのスマートフォンへ替えたため、心拍数を同期・アップロードできなくなりました。

仕組みは、[Health Auto Export - JSON+CSV](https://apps.apple.com/us/app/health-auto-export-json-csv/id1115567069?l=zh-Hans-CN)のREST API機能で心拍数を定期的に自前のHTTPエンドポイントへ送り、InfluxDBに書き込むというものです。GrafanaをInfluxDBにつないでダッシュボードを描画します。

[Health Auto Export - JSON+CSV](https://apps.apple.com/us/app/health-auto-export-json-csv/id1115567069?l=zh-Hans-CN)で定期同期するにはPremiumが必要です。米国ストアのLifetimeは24.99 USDと少し高めですが、安い代替手段は見当たりませんでした。

購入したらAutomationを新規作成します。

* Automation Typeは`REST API`。
* URLはこのあとデプロイするサービスのアドレスで、APIパスは`/push/heart_rate`です。
* Data Typeは`Health Metrics`。
* Select Health Metricsで`Heart Rate`にチェック。
* Export FormatはJSON。
* Sync Cadenceは1分でも5分でもかまいません。Apple Watchは常時心拍数を測定しているわけではありません。

Enableにチェックを入れればOKです。アプリを終了しても同期が続くよう、ホーム画面にウィジェットを置いておくとよいです。

次はREST APIを公開するサービスをデプロイし、受け取ったデータをInfluxDBに書き込みます。InfluxDBの導入方法は検索してください。ここでは省略しますが、このサービスはInfluxDB 2を使う点に注意してください。

ソースは[reekystive/healthkit-collector](https://github.com/reekystive/healthkit-collector)にあります。Nodeのプロジェクトで、pnpmから直接起動すると3000番ポートで待ち受けます。私はDockerfileを書いてDockerイメージにまとめ、自宅サーバーへデプロイしました。

```go
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Set working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Set working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set environment variables
# These are default values that can be overridden when running the container
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port your app runs on (using the PORT environment variable)
EXPOSE ${PORT}

# Command to run the application
CMD ["node", "dist/index.js"]
```

起動時には、InfluxDB接続用の環境変数を4つ設定します。

```
INFLUXDB_TOKEN='your_influxdb_token'
INFLUXDB_URL='your_influxdb_url'
INFLUXDB_ORG='your_influxdb_org'
INFLUXDB_BUCKET='your_influxdb_bucket'
```

デプロイ後に同期を試すと、DBへの書き込みに成功したログが出ます。

最後にGrafanaを立て、Data Sourceを追加してダッシュボードを作ります。クエリは次のとおりです。

```
from(bucket: "bpm")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "heart_rate")
  |> filter(fn: (r) => r["_field"] == "avg" or r["_field"] == "max" or r["_field"] == "min")
```

Enjoy！
