-- MentorLoop 小程序配套后端 MySQL 基线（云托管 TDSQL-C，对应 server/src/schema.sql）
-- 对应契约冻结 2026-10-08-mp-cloud-alignment.freeze.md §2.3：
-- - JSON 列仍用 TEXT/MEDIUMTEXT 存字符串（不用 JSON 类型），读写语义与 SQLite TEXT 零差
-- - tracking 去重唯一索引：SQLite 的 IFNULL 表达式索引 → MySQL 生成列 + 唯一索引（写入语句不变）
-- - 主键/索引列用 VARCHAR；时间戳/额度用 BIGINT/INT（epoch ms）
-- 建库（控制台或 CLI 执行一次）：CREATE DATABASE mentorloop_mp DEFAULT CHARSET utf8mb4;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id                 BIGINT       NOT NULL AUTO_INCREMENT,
  uid                VARCHAR(64)  NOT NULL,
  phone              VARCHAR(32)  NULL,
  openid             VARCHAR(128) NULL,
  nickname           VARCHAR(128) NULL,
  channel            VARCHAR(16)  NOT NULL COMMENT 'phone | wechat',
  free_quota_total   INT          NOT NULL DEFAULT 3,
  free_quota_used    INT          NOT NULL DEFAULT 0,
  single_quota_total INT          NOT NULL DEFAULT 0,
  single_quota_used  INT          NOT NULL DEFAULT 0,
  member_until       BIGINT       NULL COMMENT 'epoch ms；NULL=非会员',
  created_at         BIGINT       NOT NULL,
  updated_at         BIGINT       NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_uid (uid),
  UNIQUE KEY uk_users_openid (openid),
  KEY idx_users_phone (phone)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sms_codes (
  phone      VARCHAR(32) NOT NULL,
  code       VARCHAR(16) NOT NULL,
  expires_at BIGINT      NOT NULL,
  consumed   INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (phone)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id                  VARCHAR(64)  NOT NULL COMMENT 'uuid',
  user_id             BIGINT       NOT NULL,
  position_id         VARCHAR(64)  NOT NULL,
  position_name       VARCHAR(128) NULL,
  experience_level    VARCHAR(32)  NOT NULL,
  experience_range    VARCHAR(32)  NULL,
  mode                VARCHAR(16)  NOT NULL COMMENT 'quick/standard/deep',
  status              VARCHAR(16)  NOT NULL DEFAULT 'CREATED',
  current_question_id VARCHAR(64)  NULL,
  question_seq        INT          NOT NULL DEFAULT 0,
  created_at          BIGINT       NOT NULL,
  ended_at            BIGINT       NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS answers (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  session_id        VARCHAR(64)  NOT NULL,
  question_id       VARCHAR(64)  NOT NULL,
  user_answer_index INT          NOT NULL COMMENT '0=首答,1/2..=追问',
  is_followup       INT          NOT NULL DEFAULT 0,
  speaker           VARCHAR(16)  NOT NULL DEFAULT 'user',
  text              TEXT         NOT NULL,
  idempotency_key   VARCHAR(128) NULL,
  created_at        BIGINT       NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_answers_idx (session_id, question_id, user_answer_index),
  KEY idx_answers_session (session_id, question_id),
  CONSTRAINT fk_answers_session FOREIGN KEY (session_id) REFERENCES sessions (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_asked (
  session_id  VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  seq         INT         NOT NULL,
  PRIMARY KEY (session_id, question_id),
  CONSTRAINT fk_asked_session FOREIGN KEY (session_id) REFERENCES sessions (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  session_id   VARCHAR(64)  NOT NULL,
  user_id      BIGINT       NOT NULL,
  payload      MEDIUMTEXT   NOT NULL COMMENT 'JSON InterviewReport',
  generated_at BIGINT       NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_reports_session (session_id),
  KEY idx_reports_user (user_id),
  CONSTRAINT fk_reports_session FOREIGN KEY (session_id) REFERENCES sessions (id),
  CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resumes (
  id               BIGINT      NOT NULL AUTO_INCREMENT,
  user_id          BIGINT      NOT NULL,
  original_url     TEXT        NULL COMMENT '本地磁盘暂存相对路径',
  parse_payload    MEDIUMTEXT  NULL COMMENT 'JSON ResumeParseResult',
  optimize_payload MEDIUMTEXT  NULL COMMENT 'JSON ResumeSuggestion[]',
  created_at       BIGINT      NOT NULL,
  PRIMARY KEY (id),
  KEY idx_resumes_user (user_id),
  CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id             VARCHAR(64) NOT NULL COMMENT 'orderId',
  user_id        BIGINT      NOT NULL,
  sku_id         VARCHAR(64) NOT NULL,
  sku_kind       VARCHAR(16) NOT NULL COMMENT 'member | single',
  amount         INT         NOT NULL COMMENT '分',
  status         VARCHAR(16) NOT NULL DEFAULT 'CREATED' COMMENT 'CREATED/PAID/CLOSED',
  transaction_id VARCHAR(64) NULL COMMENT '微信支付单号（回调写入）',
  paid_at        BIGINT      NULL COMMENT '支付完成时间戳',
  created_at     BIGINT      NOT NULL,
  PRIMARY KEY (id),
  KEY idx_orders_user (user_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tracking_events (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  user_id      BIGINT      NULL,
  session_id   VARCHAR(64) NULL,
  event        VARCHAR(64) NOT NULL,
  payload      MEDIUMTEXT  NULL COMMENT '合并 props 后的 JSON',
  platform     VARCHAR(32) NULL,
  client_ts    BIGINT      NULL,
  server_ts    BIGINT      NOT NULL,
  -- 幂等防重生成列（对应 SQLite 索引表达式 IFNULL(...)；写入语句不变）
  user_id_n    BIGINT      GENERATED ALWAYS AS (IFNULL(user_id, 0)) STORED,
  session_id_n VARCHAR(64) GENERATED ALWAYS AS (IFNULL(session_id, '')) STORED,
  client_ts_n  BIGINT      GENERATED ALWAYS AS (IFNULL(client_ts, 0)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tracking_dedupe (event, user_id_n, session_id_n, client_ts_n)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
