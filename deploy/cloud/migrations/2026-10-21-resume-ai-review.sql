-- 2026-10-21 简历 AI 深度评审：云端 MySQL 增量迁移
-- 对应契约：docs/contracts/2026-10-21-resume-ai-review.freeze.md
-- 执行时机：部署新服务端版本前；执行后回读 information_schema 确认列已存在
-- 注意：只执行一次；重复执行会因列/索引已存在而报错

ALTER TABLE users
  ADD COLUMN resume_single_total INT NOT NULL DEFAULT 0 COMMENT '简历评审单次包总次数',
  ADD COLUMN resume_single_used INT NOT NULL DEFAULT 0 COMMENT '简历评审单次包已用次数';

ALTER TABLE resumes
  ADD COLUMN file_name VARCHAR(255) NULL COMMENT '原始文件名',
  ADD COLUMN file_type VARCHAR(16) NULL COMMENT 'pdf | docx',
  ADD COLUMN content_hash VARCHAR(64) NULL COMMENT 'SHA-256（缓存/幂等）',
  ADD COLUMN target_position VARCHAR(64) NULL COMMENT '目标岗位',
  ADD COLUMN mode VARCHAR(16) NULL COMMENT 'full | preview',
  ADD INDEX idx_resumes_cache (user_id, content_hash);

CREATE TABLE IF NOT EXISTS resume_usages (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  user_id    BIGINT      NOT NULL,
  mode       VARCHAR(16) NOT NULL COMMENT 'member | preview',
  created_at BIGINT      NOT NULL,
  PRIMARY KEY (id),
  KEY idx_resume_usages_user (user_id, mode, created_at),
  CONSTRAINT fk_resume_usages_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
