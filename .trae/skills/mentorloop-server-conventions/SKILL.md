---
name: mentorloop-server-conventions
description: Apply MentorLoop server conventions for routes, services, unified responses, idempotency and config. Use when writing or reviewing the server subpackage. 中文触发 服务端 后端 Fastify 统一响应 幂等 配置. Do not use for client-only work.
---

# MentorLoop Server Conventions

Apply these before writing or reviewing code under `server/`. Read `docs/sop/domain-server-sop.md` for the full procedure.

## Layering

`routes/` → `services/` → `rules/` · `data/` → `db`.

- `routes/` handle endpoints, auth, and input validation only — no business logic.
- `rules/` and `data/` mirror the frontend `engine/` and `data/`. Keep both sides identical.
- `rules/` and `data/` changes must be mirrored to the frontend in the same task.

## Unified response

Always use the builders in `server/src/util.ts`. Never hand-build a response body.

- Success with data — `okData(data)`
- Empty success — `ok()`
- Failure — `fail(code, message)`

## Auth

- Every endpoint except `auth` and `track` attaches the `requireAuth` pre-handler.
- Auth failure returns a business 401 via `fail(401, ...)` so the client auto-logs-out.

## Errors

- `app.ts` `setErrorHandler` is the single fallback: 4xx → `fail(400, message)`, 5xx → `fail(500, ...)` plus a log.
- Never leak raw internal exception text to the client.

## Idempotency

Writes must be idempotent.

- Use a unique index, e.g. `answers` on `(session_id, question_id, user_answer_index)`; a replay returns the existing record.
- Use a state machine for payment callbacks, e.g. `UPDATE ... WHERE id=? AND status='CREATED'`; `changes===0` means already handled.
- Use the tracking dedupe index for events.

## Config

- All config lives in `config.ts` (`Env` + `loadEnv()`). New options must update both `config.ts` and `.env.example`.
- Defaults must degrade safely: `llmEnabled=false`, `payMode='mock'`, `asrProvider='stub'`. Zero config must run, and degraded paths must not fabricate results.

## Storage and privacy

- Never persist raw recordings or audio files. Resume files are staged on disk under `UPLOAD_DIR`.
- `schema.sql` changes must be repeatable (`IF NOT EXISTS` or additive column statements).

## Checklist

- Responses use `okData` / `ok` / `fail`.
- Non-auth endpoints attach `requireAuth`.
- Writes are idempotent.
- New config is in `config.ts` and `.env.example`, with safe defaults.
- `rules/` / `data/` changes mirrored to the frontend.
- Contract changes went through `mentorloop-contract-freeze`.
- New logic has a `*.spec.ts` test.
