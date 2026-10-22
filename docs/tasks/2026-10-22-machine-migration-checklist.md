# 换机迁移准备清单（2026-10-22）

- 性质：**交接 / 迁移操作手册**（只描述准备与验证步骤，不改业务代码）
- 基线：`main` @ `bb05754`，工作区干净，已与 `origin/main` 同步
- 适用：Windows 新机（主开发环境）；macOS 差异见 §7
- 关联：[剩余任务明细报告](./2026-10-22-remaining-work-report.md) · [工程化工具链方案](../engineering-toolchain-plan.md) · [E2E 说明](../../e2e/mp/README.md)

## 0. 原则

1. **代码只走远端**：新机器 `git clone`，不拷贝工程目录；当前所有提交已推送。
2. **密钥只走安全通道**：`server/.env`、云端环境变量、`WX_SECRET`、`MP_APP_KEY` 等不入仓库、不进聊天记录。
3. **构建产物不迁移**：`node_modules/`、`dist/`、`unpackage/`、缓存一律重建。
4. **先最小可跑，再补云端能力**：默认配置即可跑单测、构建小程序、起本地服务。

## 1. 必装工具

| #   | 工具                  | 版本要求                                                 | 用途                            | 验收方式                       |
| --- | --------------------- | -------------------------------------------------------- | ------------------------------- | ------------------------------ |
| 1   | Git                   | 任意较新版本                                             | 克隆 / 提交                     | `git --version`                |
| 2   | Node.js               | **24 LTS**（`.nvmrc`=24；engines `^22.18 \|\| >=24.11`） | 构建、测试、服务端              | `node -v`                      |
| 3   | pnpm                  | **11.27.0**（由 `packageManager` 锁定）                  | 依赖与 workspace                | `pnpm -v`                      |
| 4   | HBuilderX             | **≥ 5.26**                                               | App 编译 / 真机运行；小程序打包 | 打开项目识别为 uni-app x       |
| 5   | 微信开发者工具        | 最新稳定版                                               | 小程序预览、自动化 E2E          | 可导入 `dist/` 产物            |
| 6   | Android Studio / SDK  | 与 HBuilderX 匹配                                        | App Android 真机或模拟器        | HBuilderX 可识别设备           |
| 7   | Xcode + 证书          | 仅 macOS                                                 | App iOS 编译与签名              | Xcode 可构建                   |
| 8   | Python 3 + fonttools  | 仅改图标时需要                                           | `scripts/build-icons.py`        | `python -c "import fontTools"` |
| 9   | Playwright 浏览器     | 仅 Web E2E 时需要                                        | `pnpm test:e2e`                 | `pnpm exec playwright install` |
| 10  | CloudBase CLI (`tcb`) | 最新版                                                   | 云托管部署与回读                | `tcb -v`、`tcb login`          |
| 11  | Docker                | 可选                                                     | 本地验证服务端镜像              | `docker build server`          |

> Node 24 同时满足根 `engines`、weapp-tailwindcss 与 CI（`.github/workflows/ci.yml` 使用 Node 24）。
> HBuilderX 低于 5.26 会导致蒸汽模式 / App 编译能力缺失；`pnpm typecheck` 依赖 HBuilderX 环境，CI 中为 `continue-on-error`。

## 2. 账号与权限

| #   | 账号 / 凭据         | 需要准备                                       | 用途                             | 备注                    |
| --- | ------------------- | ---------------------------------------------- | -------------------------------- | ----------------------- |
| 1   | GitHub              | `LinBoomBoom/mentorloop-app` 读写权限          | clone / push                     | 建议配置 SSH 或 PAT     |
| 2   | 微信公众平台        | 小程序 `wx83b5d63ecd739421` 开发者或管理员     | 预览、真机调试、体验版、消息推送 | 需绑定新机登录微信      |
| 3   | 腾讯云              | 账号 + CloudBase 环境 `prod-d6gaa83ds8accb61b` | 云托管、TTS、云存储              | 建议最小权限子用户      |
| 4   | DeepSeek / LLM 网关 | 独立 API Key                                   | 报告解释、简历 AI 评审           | 不写入仓库              |
| 5   | 虚拟支付后台        | `OfferID=1450672438`、现网 `AppKey`            | 虚拟支付签名                     | **AppKey 仅进云端变量** |
| 6   | Apple Developer     | 证书 / Provisioning Profile                    | iOS 打包与 IAP                   | 需 macOS                |
| 7   | Android 签名        | release keystore 与口令                        | Android 正式包                   | 单独安全保管            |
| 8   | 域名 / 备案         | 生产域名、备案主体                             | 合法域名与上线                   | 提审前完成              |

> 需要迁移的敏感项清单：`WX_SECRET`、`MP_APP_KEY`、`MYSQL_PASSWORD`、`JWT_SECRET`、`TENCENTCLOUD_SECRET_ID/KEY`、`LLM_API_KEY`、`WX_API_V3_KEY`、`WX_MCH_PRIVATE_KEY`、Android keystore。
> 上述一律不进 Git；建议通过密码管理器或直接在云端控制台重新录入。

## 3. 仓库与依赖

```powershell
git clone https://github.com/LinBoomBoom/mentorloop-app.git
cd mentorloop-app
git checkout main
git log --oneline -3          # 期望包含 bb05754

corepack enable
pnpm install --frozen-lockfile
```

要点：

- 根目录是 pnpm workspace，根安装会覆盖 `server/` 子包；
- 建议 `git config core.autocrlf false`，仓库以 `.gitattributes` 统一 LF，避免 `pnpm format:check` 全仓误报；
- 配置提交身份：`git config user.name` / `user.email`（commitlint 要求 Conventional Commits，描述用中文）。

## 4. 本地环境变量

```powershell
Copy-Item server\.env.example server\.env
```

默认配置（不填任何密钥）即可：

- SQLite：`DB_PATH=./data/mentorloop.db`；
- 支付：`PAY_MODE=mock` / `MP_PAY_MODE=mock`；
- ASR / TTS：`stub`；
- 内容库：本地无云 MySQL 时由 `server/src/data/content-fixture.json` 自举。

需要联调时再按需填写：

| 场景                | 变量                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| 微信登录 / 语音     | `WX_APPID`、`WX_SECRET`、`TRUST_WX_HEADERS`                                                  |
| LLM 报告 / 简历评审 | `LLM_ENABLED`、`LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL=deepseek-v4-flash`                  |
| TTS                 | `TTS_PROVIDER=tencent`、`TENCENTCLOUD_*`、`TENCENT_TTS_VOICE_TYPE=101001`、`WX_CLOUD_ENV_ID` |
| 支付                | `MP_PAY_MODE`、`MP_OFFER_ID`、`MP_APP_KEY`                                                   |
| 云 MySQL            | `MYSQL_*`、`DESKTOP_DB_NAME`                                                                 |

> `server/.env` 与 `server/data/` 均被 gitignore，不随仓库迁移。需要保留旧机本地数据时，单独拷贝 `server/data/mentorloop.db` 与 `server/data/uploads/`。

## 5. 机器相关配置

| 配置项                        | 当前默认 / 现状                                | 新机处理                                                       |
| ----------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `WX_DEVTOOLS_CLI`             | `E:\微信web开发者工具\cli.bat`                 | 安装路径不同必须设置该环境变量                                 |
| `MP_SHOT_DIR`                 | `D:\调试截图`                                  | 按新机目录调整（可选）                                         |
| 微信开发者工具服务端口        | 需开启                                         | 设置 → 安全设置 → 服务端口「开启」                             |
| 自动化信任                    | 建议开启                                       | 同页开启「自动化接口打开工具时默认信任项目」                   |
| DevTools 导入目录             | `dist/dev/mp-weixin` 或 `dist/build/mp-weixin` | **禁止导入 `unpackage/`**（WXSS 路径越界，见 ISS-20261011-01） |
| HBuilderX 编译器              | 需 uni-app x 编译器与 App 真机插件             | 打开仓库根，确认 `manifest.json` 的 `uni-app-x.vapor=true`     |
| Android SDK                   | HBuilderX 内配置                               | 重新指定 SDK 与设备                                            |
| `project.private.config.json` | 已入库                                         | 不要用本机 DevTools 的改动覆盖提交                             |

## 6. 启动与验证

### 6.1 质量门禁

```powershell
node scripts/check-uvue-css.mjs
node scripts/check-design-tokens.mjs
node scripts/check-sop-registry.mjs
pnpm lint
pnpm test
pnpm --filter @mentorloop/server typecheck
pnpm --filter @mentorloop/server test
pnpm --filter @mentorloop/server build
pnpm build:mp-weixin
```

期望：lint 0 error / 0 warning、格式通过、客户端与服务端单测全绿、服务端构建成功、小程序产物生成于 `dist/build/mp-weixin`。

### 6.2 本地服务

```powershell
pnpm --filter @mentorloop/server dev          # http://127.0.0.1:8787
node server/e2e/smoke.mjs http://127.0.0.1:8787
```

### 6.3 小程序预览

```powershell
pnpm dev:mp-weixin                            # watch → dist/dev/mp-weixin
# 微信开发者工具导入 dist/dev/mp-weixin
```

### 6.4 自动化（可选）

```powershell
# 1) 起自动化会话
& "$env:WX_DEVTOOLS_CLI" auto --project "d:\LsqCoding\mentorloop-app\dist\build\mp-weixin" --auto-port 9420 --trust-project
# 2) 跑场景
pnpm test:mp --no-build --ws=ws://127.0.0.1:9420
```

已知限制：`automator.launch()` 在 Node ≥ 18.20 必然失败，必须走上面的两步法；脚本改动后需 `cli close` 再 `cli auto`。

### 6.5 截图核验（可选）

```powershell
pnpm shot:mp prep
```

## 7. macOS 差异

- 新增：Xcode、iOS 证书与 Provisioning Profile、CocoaPods（如插件需要）；
- HBuilderX 安装 macOS 版，App iOS 编译与真机调试只能在 macOS 完成；
- `WX_DEVTOOLS_CLI` 指向 macOS 版开发者工具 CLI（通常为 `cli`，非 `cli.bat`）；
- 命令改用 bash/zsh，路径分隔符与默认目录需重设；
- Windows 仅能完成小程序与 Android 端，iOS 验收需留在 Mac。

## 8. 云端部署（仅在需要发布时）

前置：`tcb login` 成功、具备 CloudBase 环境权限、云端环境变量已录入。

```powershell
cd server
tcb cloudrun deploy -e prod-d6gaa83ds8accb61b -s mentorloop-mp-api --source . --port 8787 --min-num 1 --max-num 5 --open-access-types MINIAPP --wait --force
```

注意事项：

1. 云端环境变量共 **24 键**，必须在控制台版本配置中填写；`tcb cloudrun deploy` 不传 `EnvParams`；
2. 部署后回读 `MP_PAY_MODE`（计划切 `virtual`）、`LLM_MODEL`（建议 `deepseek-v4-flash`）；
3. 健康检查 `GET /healthz` 应返回 200；
4. 小程序后台「消息推送」URL 指向 `https://<云托管域名>/membership/virtual/notify`，并点一次平台测试推送；
5. 生产禁止 `MOCK_SMS_CODE=123456` 与 `ALLOW_WEAK_SMS_CODE=true` 同时存在。

## 9. 不迁移清单

| 项                                                     | 原因                                 |
| ------------------------------------------------------ | ------------------------------------ |
| `node_modules/`                                        | 按锁文件重装                         |
| `dist/`、`unpackage/`、`.temp/`、`.cache/`             | 构建产物，重编即可                   |
| `server/.env`                                          | 含密钥，安全通道单独处理             |
| `server/data/`                                         | 本地 SQLite 与上传文件，按需单独拷贝 |
| `e2e/mp/shots/`、`playwright-report/`、`test-results/` | 一次性调试产物                       |
| HBuilderX / DevTools 本机缓存                          | 重建，避免版本错配                   |

## 10. 验收清单

- [ ] `node -v` 为 24.x，`pnpm -v` 为 11.27.x；
- [ ] `pnpm install --frozen-lockfile` 成功；
- [ ] 三项脚本机检通过：uvue CSS、设计 token、SOP 注册表；
- [ ] `pnpm lint` / `pnpm test` 全绿；
- [ ] 服务端 `typecheck` / `test` / `build` 全绿；
- [ ] `pnpm build:mp-weixin` 成功，DevTools 可导入并正常渲染；
- [ ] 本地服务 `/healthz` 返回 200，`server/e2e/smoke.mjs` 通过；
- [ ] 需要语音/LLM/支付的场景已在 `server/.env` 或云端配置对应密钥；
- [ ] 需要自动化时，DevTools 服务端口已开且 `pnpm test:mp` 可连；
- [ ] 需要部署时，`tcb` 已登录且部署后变量回读正确；
- [ ] 未把任何密钥写入仓库或提交记录。

## 11. 最短路径（只想继续写小程序）

1. 装 Git、Node 24、pnpm 11、微信开发者工具；
2. `git clone` → `pnpm install --frozen-lockfile`；
3. `pnpm dev:mp-weixin`；
4. DevTools 导入 `dist/dev/mp-weixin`；
5. 提交前跑 `pnpm lint && pnpm test && pnpm build:mp-weixin`。

完成以上即可继续日常开发；其余工具按「语音联调 / App 打包 / 云端发布」逐档补齐。
