CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  initials varchar(2) NOT NULL CHECK (btrim(initials) <> ''),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE boards (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  task_prefix varchar(12) NOT NULL CHECK (task_prefix ~ '^[A-Z0-9]+$'),
  next_task_number bigint NOT NULL DEFAULT 1 CHECK (next_task_number > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_id),
  UNIQUE (task_prefix)
);

CREATE TABLE board_members (
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

CREATE UNIQUE INDEX board_single_owner
  ON board_members (board_id)
  WHERE role = 'owner';

CREATE TABLE stages (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  color varchar(7) NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind text NOT NULL CHECK (kind IN ('backlog', 'active', 'review', 'done')),
  position integer NOT NULL CHECK (position >= 0),
  wip_limit integer CHECK (wip_limit > 0),
  wip_limit_mode text NOT NULL DEFAULT 'warning'
    CHECK (wip_limit_mode IN ('warning', 'strict')),
  require_completed_todos boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, id),
  CONSTRAINT stages_board_position_unique
    UNIQUE (board_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL,
  task_number bigint NOT NULL CHECK (task_number > 0),
  title text NOT NULL CHECK (btrim(title) <> ''),
  category text NOT NULL DEFAULT 'Allgemein' CHECK (btrim(category) <> ''),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  position integer NOT NULL CHECK (position >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (board_id, stage_id) REFERENCES stages(board_id, id) ON DELETE RESTRICT,
  UNIQUE (board_id, task_number),
  CONSTRAINT tasks_stage_position_unique
    UNIQUE (stage_id, position) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (id, board_id)
);

CREATE INDEX tasks_board_id_idx ON tasks (board_id);
CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);
CREATE INDEX tasks_due_date_idx ON tasks (due_date) WHERE due_date IS NOT NULL;

CREATE TABLE task_todos (
  id uuid PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (btrim(text) <> ''),
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_todos_position_unique
    UNIQUE (task_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE stage_transitions (
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  source_stage_id uuid NOT NULL,
  target_stage_id uuid NOT NULL,
  PRIMARY KEY (source_stage_id, target_stage_id),
  FOREIGN KEY (board_id, source_stage_id)
    REFERENCES stages(board_id, id) ON DELETE CASCADE,
  FOREIGN KEY (board_id, target_stage_id)
    REFERENCES stages(board_id, id) ON DELETE CASCADE,
  CHECK (source_stage_id <> target_stage_id)
);

CREATE INDEX stage_transitions_board_id_idx ON stage_transitions (board_id);
