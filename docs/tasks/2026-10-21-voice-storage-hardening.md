# 任务卡：系统问题清单批次 1+2（录音上限 · 云存储清理 · fileID 属主校验）

- 日期：2026-10-21
- 关联：系统问题清单 P1-3 / P1-4 / P2-6（[基线](./2026-10-21-system-issue-inventory.md)）；里程碑 M1 语音链路
- 状态：已实现（G2 通过；G3 见 [验收结论](./2026-10-21-voice-storage-hardening.accept.md)）

## 1. 目标

关闭语音链路的三项遗留缺口：单次录音加 55s 上限、清理云存储堆积（简历随注销删除、TTS 播完即删）、对所有 `cloud://` fileID 做属主校验，消除越权读取与资源/合规风险。

## 2. 范围

- 做：
  - 客户端录音启动参数带 `duration: 55000`，并在房间页加录音计时，到时自动停止并直接送转写。
  - 客户端上传路径改为 `asr/<uid>/…`、`resumes/<uid>/…`；TTS 服务端写入路径改为 `tts/<uid>/…`。
  - 服务端 `/interview/asr-cloud`、`/resume/parse` 对 `cloud://` fileID 校验属主，非本人返回 403。
  - 账号注销时收集 `cloud://` 简历对象并调用 `/tcb/batchdeletefile` 删除。
  - 新增 `POST /interview/tts-ack`：客户端播放结束/失败/主动停止后回调，服务端删除对应 TTS 对象。
- 不做：
  - 简历真实解析与改写（P1-2，需先决策单独立卡）。
  - 微信域名 TLS CA pinning（P2-5）、TTS 超长文本切分（P3-8）。
  - 云端环境变量调整（P0-1 万能验证码、P3-9 凭据轮换），属发布前动作。
  - TCB 生命周期规则的控制台配置（无控制台权限，代码侧先收敛）。

## 3. 依赖

- 前置：语音链路批次已落地（`d53112f` → `a5e3b0b`）。
- 外部环境：云存储删除复用 `WX_APPID` / `WX_SECRET`；缺凭据时删除降级跳过，不阻断注销与面试。
- 契约：**是** → [契约冻结单](../contracts/2026-10-21-tts-ack-and-file-ownership.freeze.md)（新增端点 + 403 语义 + 路径约定）。

## 4. 验收标准

- [ ] 录音启动携带 `duration: 55000`；持续 55s 自动停止并进入转写，录音态复位（含平台自动停止分支）。
- [ ] `api/asr.uts` 与 `api/resume.uts` 上传路径均含当前用户 uid 段。
- [ ] `/interview/asr-cloud` 传入他人 fileID 返回 403；本人 fileID 行为不变（仍诚实降级）。
- [ ] `/resume/parse` 传入他人 `cloud://` fileID 返回 403；本地路径语义不变。
- [ ] 注销账号时 `cloud://` 简历对象被批量删除；无凭据时跳过且注销仍成功（幂等）。
- [ ] TTS 播放结束/失败/停止后调用 ack；服务端删除 `tts/<uid>/` 对象，非法 fileID 返回 403。
- [ ] 新增/更新单测全绿；G2 全部检查项通过。

## 5. 风险与对策

| 风险                                                     | 等级 | 对策                                                             |
| -------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| 旧版本客户端上传路径不含 uid，升级服务端后会被 403 拒绝  | 中   | 小程序尚未发布，无存量线上客户端；验收记录中标注该口径           |
| MP `duration` 到点自动停止与 UI 计时竞态，录音态可能残留 | 中   | `onStop` 统一复位 `recording` 与录音计时器，双重收口             |
| TTS ack 丢失（断网/杀进程）导致对象残留                  | 低   | ack 为 best-effort；残留量远小于现状，生命周期规则作为后续可选项 |
| 注销时云删除失败会阻断合规清理                           | 中   | 删除独立 try/catch，失败仅告警，不阻断数据库级联删除             |
| `cloud://` 路径解析对非标准 fileID 误判                  | 低   | 仅接受 `cloud://<env>.<bucket>/<path>` 形态，解析失败即拒绝      |

## 6. 产物路径

- 新增：
  - `docs/contracts/2026-10-21-tts-ack-and-file-ownership.freeze.md`
  - `docs/tasks/2026-10-21-voice-storage-hardening.gate.md`
  - `docs/tasks/2026-10-21-voice-storage-hardening.accept.md`
- 修改：
  - 客户端：`api/speech.uts`、`api/asr.uts`、`api/resume.uts`、`api/tts.uts`、`pages/interview/room.uvue`
  - 服务端：`server/src/services/asr-cloud.ts`、`server/src/services/tts.ts`、`server/src/services/wx-storage.ts`、`server/src/routes/interview.ts`、`server/src/routes/misc.ts`、`server/src/routes/me.ts`
  - 测试：`server/src/asr-cloud.spec.ts`、`server/src/tts.spec.ts`、`server/src/me.spec.ts`、`server/src/app.spec.ts`（按需）

## 7. 角色

- 主责：BE
- 配合：FE / QA / LC

## 8. 负责人

BE + 执行 Agent（Trae）

## 9. 开工前质询（未决项清单，2026-10-15 起）

| #   | 质询                                                 | 结论                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `recorder.start` 是否支持 `duration`，两端行为如何？ | 已查证：[uni-app x 官方文档](https://doc.dcloud.net.cn/uni-app-x/api/get-recorder-manager.html) 与[微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html) 均支持；到时自动 `onStop` |
| 2   | MP 自动停止后房间页录音态如何复位？                  | 已决策：`onStop` 回调统一复位 `recording` 并清理录音计时器，避免双入口竞态                                                                                                                                                                 |
| 3   | 客户端能否直接删除服务端写入的 TTS 对象？            | 已决策：不能（默认权限下仅创建者可删），改走服务端 ack 端点                                                                                                                                                                                |
| 4   | `batchdeletefile` 的路径与参数？                     | 已查证：[微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-http-api/storage/batchDeleteFile.html)：`POST /tcb/batchdeletefile`，body `{ env, fileid_list }`                                  |
| 5   | 存量无 uid 的云文件是否兼容？                        | 已决策：不兼容；小程序未发布，无线上存量客户端，服务端统一要求 uid 段                                                                                                                                                                      |
| 6   | 是否能改用 TCB 生命周期规则替代代码清理？            | 已决策：控制台无权限，代码侧 ack 先行；生命周期规则保留为可选优化（2026-10-28 前由 BE 复核是否支持）                                                                                                                                       |
| 7   | `cloud://` 路径如何解析与校验？                      | 已决策：取 `cloud://` 后首个 `/` 之后的 path，要求 `path` 以 `<top>/<uid>/` 开头，否则 403                                                                                                                                                 |
| 8   | 无云凭据时注销与 ack 行为？                          | 已决策：删除跳过 + 告警，接口仍返回成功（注销幂等、ack best-effort）                                                                                                                                                                       |
| 9   | 契约双签是否齐备？                                   | 已决策：服务端 ✓ 客户端 ✓（见冻结单）                                                                                                                                                                                                      |
