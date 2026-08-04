CREATE TABLE external_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer text NOT NULL CHECK (btrim(issuer) <> ''),
  subject text NOT NULL CHECK (btrim(subject) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz,
  UNIQUE (issuer, subject)
);

CREATE INDEX external_identities_user_id_idx ON external_identities (user_id);
