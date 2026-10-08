# MentorLoop 小程序配套后端（Fastify + node:sqlite/mysql2 双驱动）
# 云托管部署物：构建产物 dist/server.js，监听 0.0.0.0:PORT（容器内必须可达）
# 双驱动：容器注入 MYSQL_* 环境变量 → mysql2 连接池（schema 由
# deploy/cloud/baseline-mp-mysql.sql 外部建库）；未注入 → 本地 node:sqlite。

# ---- 构建阶段 ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
# tsc 不搬运 .sql：db.ts 运行时从 dist 读 schema.sql（本地 SQLite 路径用）
RUN npm run build && cp src/schema.sql dist/schema.sql

# ---- 运行阶段 ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "dist/server.js"]
