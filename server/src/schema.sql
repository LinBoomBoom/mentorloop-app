-- MentorLoop 服务端 Schema（SQLite，P1.1）
-- 隐私最小化：不落库录音原文/音频文件，仅存用户文本回答；简历文件暂存在磁盘 UPLOAD_DIR。

CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  uid                TEXT    NOT NULL UNIQUE,
  phone              TEXT,
  openid             TEXT    UNIQUE,
  session_key        TEXT,                            -- 微信会话密钥（仅服务端；不下发、不落日志）
  session_key_updated_at INTEGER,                     -- epoch ms；NULL=未获取
  nickname           TEXT,
  channel            TEXT    NOT NULL,                -- 'phone' | 'wechat'
  free_quota_total   INTEGER NOT NULL DEFAULT 3,
  free_quota_used    INTEGER NOT NULL DEFAULT 0,
  single_quota_total INTEGER NOT NULL DEFAULT 0,
  single_quota_used  INTEGER NOT NULL DEFAULT 0,
  resume_single_total INTEGER NOT NULL DEFAULT 0,
  resume_single_used  INTEGER NOT NULL DEFAULT 0,
  member_until       INTEGER,                         -- epoch ms；NULL=非会员
  desktop_user_id    TEXT,                            -- 桌面端 mentorloop.users.id（账号互通绑定，可空）
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_codes (
  phone      TEXT    PRIMARY KEY,
  code       TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id                  TEXT    PRIMARY KEY,           -- uuid
  user_id             INTEGER NOT NULL REFERENCES users(id),
  position_id         TEXT    NOT NULL,
  position_name       TEXT,
  experience_level    TEXT    NOT NULL,
  experience_range    TEXT,
  mode                TEXT    NOT NULL,              -- quick/standard/deep
  status              TEXT    NOT NULL DEFAULT 'CREATED',
  current_question_id TEXT,
  question_seq        INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  ended_at            INTEGER
);

CREATE TABLE IF NOT EXISTS answers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id        TEXT    NOT NULL REFERENCES sessions(id),
  question_id       TEXT    NOT NULL,
  user_answer_index INTEGER NOT NULL,                -- 0=首答,1/2..=追问
  is_followup       INTEGER NOT NULL DEFAULT 0,
  speaker           TEXT    NOT NULL DEFAULT 'user',
  text              TEXT    NOT NULL,
  idempotency_key   TEXT,
  created_at        INTEGER NOT NULL,
  UNIQUE(session_id, question_id, user_answer_index)
);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id, question_id);

CREATE TABLE IF NOT EXISTS session_asked (
  session_id  TEXT NOT NULL REFERENCES sessions(id),
  question_id TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  PRIMARY KEY (session_id, question_id)
);

-- 跨场次出题历史（2026-10-24 契约冻结：面试最大 90 天 / 300 题不重复）
CREATE TABLE IF NOT EXISTS user_asked_history (
  user_id     INTEGER NOT NULL REFERENCES users(id),
  question_id TEXT    NOT NULL,
  position_id TEXT    NOT NULL,
  asked_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_user_asked_recent ON user_asked_history(user_id, asked_at);

CREATE TABLE IF NOT EXISTS reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT    NOT NULL UNIQUE REFERENCES sessions(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  payload      TEXT    NOT NULL,                     -- JSON InterviewReport
  generated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resumes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  original_url     TEXT,                             -- 本地磁盘暂存相对路径或 cloud:// fileID
  file_name        TEXT,                             -- 原始文件名（历史记录展示）
  file_type        TEXT,                             -- pdf | docx
  content_hash     TEXT,                             -- SHA-256（缓存/幂等）
  target_position  TEXT,                             -- 目标岗位（评审口径）
  mode             TEXT,                             -- full | preview
  parse_payload    TEXT,                             -- JSON ResumeParseResult
  optimize_payload TEXT,                             -- JSON ResumeIssue[]（旧列，复用存 issues）
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resumes_cache ON resumes(user_id, content_hash);

-- 简历额度消耗流水（会员月度额度按自然月计数；预览按日计数）
CREATE TABLE IF NOT EXISTS resume_usages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  mode       TEXT    NOT NULL,                        -- member | preview
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resume_usages_user ON resume_usages(user_id, mode, created_at);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT    PRIMARY KEY,                -- orderId
  user_id        INTEGER NOT NULL REFERENCES users(id),
  sku_id         TEXT    NOT NULL,
  sku_kind       TEXT    NOT NULL,                   -- 'member' | 'single' | 'resume'
  amount         INTEGER NOT NULL,                   -- 分
  status         TEXT    NOT NULL DEFAULT 'CREATED', -- CREATED/PAID/CLOSED
  transaction_id TEXT,                               -- 微信支付单号（回调写入）
  paid_at        INTEGER,                            -- 支付完成时间戳
  created_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  session_id TEXT,
  event      TEXT NOT NULL,
  payload    TEXT,                                  -- 合并 props 后的 JSON
  platform   TEXT,
  client_ts  INTEGER,
  server_ts  INTEGER NOT NULL
);
-- 幂等防重埋点：同 事件/用户/会话/客户端时间戳 只录一次
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_dedupe
  ON tracking_events(event, IFNULL(user_id,0), IFNULL(session_id,''), IFNULL(client_ts,0));

-- 索引对齐（2026-10-11）：与 deploy/cloud/baseline-mp-mysql.sql 保持一致。
-- MySQL 版已有以下二级索引，SQLite 版此前缺失，导致按 user_id 的查询全表扫。
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- 内容库题目表（2026-10-18 批次 A：出题数据源由代码常量题库切换为云端内容库）
-- 源：桌面库 mentorloop.interview_questions（只读）→ 同步脚本预计算后落本库；出题直查本库。
-- 本地 SQLite 由 fixture 灌入同结构（scripts/export-content-fixture.mjs）。
CREATE TABLE IF NOT EXISTS questions (
  id              TEXT PRIMARY KEY,                  -- 源 id（bq37/aq44…）
  position_id     TEXT NOT NULL,                     -- 适配：track（frontend/backend/devops/ai）
  track           TEXT NOT NULL,                     -- 源 track（保留追溯）
  subtrack        TEXT,                              -- 源 subtrack（作 subAbility）
  difficulty      TEXT NOT NULL,                     -- 适配：easy/medium/hard → junior/mid/senior
  ability_domain  TEXT NOT NULL,                     -- 预计算：六维（dimension-classifier 输出）
  content         TEXT NOT NULL,                     -- 预计算：题面生成后的问句
  content_raw     TEXT,                              -- 源 q（保留原标题）
  evidence        TEXT,                              -- 源 a（摘要化截断）
  knowledge_point TEXT,
  keywords        TEXT,                              -- 源 keywords（JSON 串，供分类追溯）
  tech_token      TEXT,                              -- 预计算：tech 中文名 → 词表 id（无对照 ''）
  weight          INTEGER NOT NULL DEFAULT 3,
  q_type          TEXT,                              -- 源 type（hot/special）
  license         TEXT,                              -- 源（默认不过滤，保留合规审计）
  synced_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_position_difficulty ON questions(position_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_position_domain ON questions(position_id, ability_domain);
CREATE INDEX IF NOT EXISTS idx_questions_position_subtrack ON questions(position_id, subtrack);

-- 做题记录（2026-10-23 Phase 2.1）：按用户 × 题记录最近一次自评与 SRS 排程
-- 契约：docs/contracts/2026-10-23-practice-sync.freeze.md
CREATE TABLE IF NOT EXISTS practice_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  question_id     TEXT NOT NULL,
  subtrack        TEXT NOT NULL,
  difficulty      TEXT NOT NULL,
  result          TEXT NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 1,
  correct_streak  INTEGER NOT NULL DEFAULT 0,
  interval_days   INTEGER NOT NULL DEFAULT 1,
  due_at          INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_user_question
  ON practice_records(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_practice_user_due ON practice_records(user_id, due_at);