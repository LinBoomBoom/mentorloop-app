-- MentorLoop 服务端 Schema（SQLite，P1.1）
-- 隐私最小化：不落库录音原文/音频文件，仅存用户文本回答；简历文件暂存在磁盘 UPLOAD_DIR。

CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  uid                TEXT    NOT NULL UNIQUE,
  phone              TEXT,
  openid             TEXT    UNIQUE,
  nickname           TEXT,
  channel            TEXT    NOT NULL,                -- 'phone' | 'wechat'
  free_quota_total   INTEGER NOT NULL DEFAULT 3,
  free_quota_used    INTEGER NOT NULL DEFAULT 0,
  single_quota_total INTEGER NOT NULL DEFAULT 0,
  single_quota_used  INTEGER NOT NULL DEFAULT 0,
  member_until       INTEGER,                         -- epoch ms；NULL=非会员
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
  original_url     TEXT,                             -- 本地磁盘暂存相对路径
  parse_payload    TEXT,                             -- JSON ResumeParseResult
  optimize_payload TEXT,                             -- JSON ResumeSuggestion[]
  created_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT    PRIMARY KEY,                -- orderId
  user_id        INTEGER NOT NULL REFERENCES users(id),
  sku_id         TEXT    NOT NULL,
  sku_kind       TEXT    NOT NULL,                   -- 'member' | 'single'
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