ALTER TABLE tasks
  ADD COLUMN comments_count integer NOT NULL DEFAULT 0
    CHECK (comments_count >= 0);

CREATE TABLE workspace_imports (
  id uuid PRIMARY KEY,
  fingerprint char(64) NOT NULL UNIQUE,
  source_exported_at timestamptz NOT NULL,
  user_count integer NOT NULL CHECK (user_count > 0),
  board_count integer NOT NULL CHECK (board_count > 0),
  task_count integer NOT NULL CHECK (task_count >= 0),
  imported_at timestamptz NOT NULL DEFAULT now()
);
