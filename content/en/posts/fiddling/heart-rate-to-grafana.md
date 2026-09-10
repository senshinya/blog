---
authorship: human-only
title: "My Heart Beats for U: Visualizing Heart Rate in Grafana"
description: "Periodically syncing heart-rate data from Apple Health to a server and visualizing it in Grafana provides an intuitive way to monitor it. Health Auto Export sends the data to an HTTP endpoint through its REST API automation, the server stores it in InfluxDB, and Grafana presents a clear dashboard for tracking and analyzing personal heart-rate changes."
date: 2025-03-31 23:51:00
categories: [fiddling]
tags: ["Tinkering", "Grafana", "heart rate", "Apple Watch"]
image: "https://blog-img.774352199.xyz/F4qD2T.webp"
---

A little side project: periodically sync my heart rate from Apple Health to a server and plot it in Grafana. It looks roughly like this:

![](https://blog-img.774352199.xyz/2025/e01807e95f9c8ea4384d2c4d8f4fe3cb.png)

<del>Click the ♥️ in the top-right corner of the blog to view it. It runs through Cloudflare Tunnel, so access from China is slow; use a circumvention proxy 🪜 if possible.</del> Now offline: after switching to an OPPO smartphone, I can no longer sync and upload heart-rate data.

The idea is to use the REST API feature in [Health Auto Export - JSON+CSV](https://apps.apple.com/us/app/health-auto-export-json-csv/id1115567069?l=zh-Hans-CN) to send heart-rate data on a schedule to a deployed HTTP endpoint. That writes it to InfluxDB, and Grafana connects to InfluxDB to draw the dashboard.

Scheduled syncing in [Health Auto Export - JSON+CSV](https://apps.apple.com/us/app/health-auto-export-json-csv/id1115567069?l=zh-Hans-CN) requires Premium. A lifetime license costs USD 24.99 in the US store—a little steep, but I could not find a comparable cheaper alternative.

After subscribing, create an Automation:

* Set Automation Type to `REST API`.
* For URL, enter the address of the service deployed below. The API path is `/push/heart_rate`.
* Set Data Type to `Health Metrics`.
* Under Select Health Metrics, check `Heart Rate`.
* Set Export Format to JSON.
* Sync Cadence can be one or five minutes. Apple Watch does not measure heart rate continuously.

Check Enable. Add a home-screen widget to help keep syncing after the app is closed.

Next, deploy the service, exposing a REST API endpoint that receives data and writes it to InfluxDB. I will leave InfluxDB installation to Google; note that the service uses InfluxDB 2.

The source is at [reekystive/healthkit-collector](https://github.com/reekystive/healthkit-collector). It is a Node project that can run directly with pnpm, listening on port 3000. I wrote a Dockerfile to package it as a Docker image and deployed it on my home server.

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

Set these four environment variables at startup for the InfluxDB connection.

```
INFLUXDB_TOKEN='your_influxdb_token'
INFLUXDB_URL='your_influxdb_url'
INFLUXDB_ORG='your_influxdb_org'
INFLUXDB_BUCKET='your_influxdb_bucket'
```

Once deployed, try a sync. The service should log a successful database write.

Finally, deploy Grafana, add the data source, and create a dashboard with this query:

```
from(bucket: "bpm")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "heart_rate")
  |> filter(fn: (r) => r["_field"] == "avg" or r["_field"] == "max" or r["_field"] == "min")
```

Enjoy!
