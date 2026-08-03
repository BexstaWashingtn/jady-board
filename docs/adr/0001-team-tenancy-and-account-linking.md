# ADR 0001: Team tenancy, invitations and account linking

- Status: Accepted
- Date: 2026-08-03
- Scope: Future PostgreSQL-backed multi-user mode

## Context

JaDy Board is evolving from a local-first application into a publicly usable
team product. Authentication will eventually be delegated to an external OIDC
identity provider, while application users, roles, memberships and permissions
remain owned by JaDy Board in PostgreSQL.

The current schema attaches every board to a user through `boards.owner_id` and
stores board-level roles in `board_members`. That is sufficient for the current
development API, but it does not define tenant ownership, invitations,
multi-provider accounts or lifecycle behavior for public teams.

This ADR fixes the product and domain boundaries needed before choosing an OIDC
provider. It does not select a provider or add database tables.

## Decisions

### 1. Team is the tenant boundary

The persisted tenant concept is named `team`. The existing client-side term
`workspace` continues to mean the complete local export container and is not a
synonym for a server tenant.

- A user may belong to multiple teams.
- A board belongs to exactly one team.
- Teams are not nested.
- Team membership does not automatically grant access to every board.
- Tenant-scoped uniqueness and future quotas are keyed by `team_id`.

### 2. Local users remain the application identity

`users.id` remains the only user identifier referenced by application data.
External identities are authentication links, not application users.

- One local user may link multiple external identities.
- An external identity is uniquely identified by `(issuer, subject)`.
- One external identity may belong to only one local user.
- Email is profile and invitation-routing data, never an identity key.
- Provider groups, roles and organization claims do not create JaDy Board
  permissions.

The future relation is conceptually:

```text
external_identities (issuer, subject) -> users.id
```

### 3. Joining teams is invitation-first

The first public onboarding version is invitation-first. A valid OIDC login by
an unknown principal does not silently provision an account or membership.

An explicit invitation acceptance may create a local user and external identity
link as one transaction. Invitations:

- belong to exactly one team;
- are sent to a normalized email address as a routing hint;
- store only a hash of the secret acceptance token;
- expire and are single-use;
- record their creator, intended team role and final recipient;
- can be revoked before acceptance;
- do not grant access until acceptance succeeds.

The verified email supplied by the provider must match the pending invitation
for the initial flow. This comparison proves possession of the invited mailbox,
but the resulting account is still keyed by `(issuer, subject)`.

Open self-registration and automatic personal-team creation are deferred.

### 4. Team roles and board roles are separate

Team roles:

| Role | Capabilities |
| --- | --- |
| `owner` | Team lifecycle, owners, members, invitations and all team boards |
| `admin` | Members, invitations and board creation; cannot manage owners or delete the team |
| `member` | Team membership only; board access requires a board membership |

Board roles remain:

| Role | Capabilities |
| --- | --- |
| `owner` | Board configuration, membership and destructive board operations |
| `member` | Board access governed by the existing task/assignee rules |

Team owners and admins do not implicitly appear as board members. Administrative
access to a board must be an explicit, audited support operation rather than an
implicit query rule.

A board has exactly one board owner in the first version. Ownership may be
transferred to another active team member. The board owner does not need to be a
team owner.

### 5. Board invitations are not part of the first invitation model

Invitations initially create team membership only. Board access is assigned
after acceptance through `board_members`.

Embedding a list of board grants in invitations is deferred because it adds
complexity around revoked boards, role changes and partial acceptance. It can be
added later without changing the team invitation identity flow.

### 6. Owner invariants are enforced transactionally

- Every active team has at least one active team owner.
- The last team owner cannot leave, be removed or be demoted.
- Every active board has exactly one active board owner.
- A board owner must be an active member of the board's team.
- Removing a user from a team requires prior transfer of owned boards.
- Permission checks and invariant enforcement run in the same transaction as
  membership or ownership changes.

### 7. Account linking is explicit and reauthenticated

Linking another external identity requires:

1. an authenticated session for the existing local account;
2. a fresh authentication ceremony with the identity being added;
3. confirmation that `(issuer, subject)` is not linked elsewhere;
4. an auditable, transactional link operation.

Accounts are never merged automatically because email addresses match. Unlinking
is allowed only when another usable authentication method remains. Recovery and
administrative merge procedures are deferred until the provider is selected.

### 8. Lifecycle operations preserve auditability

- Removing a member revokes memberships and active sessions but does not erase
  historical references.
- Account deletion initially disables and pseudonymizes the local user after
  required ownership transfers; it does not cascade-delete team content.
- Team deletion is a two-step archive and delayed purge operation.
- Board deletion follows the same archive-before-purge principle in server mode.
- External identity links are removed when the local account is finalized for
  deletion.

Exact retention periods are an operational and legal decision and are deferred.

## Target relational model

The following is a design contract, not an immediately executable migration:

```sql
CREATE TABLE external_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz,
  UNIQUE (issuer, subject)
);

CREATE TABLE teams (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('active', 'archived')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE team_members (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status text NOT NULL CHECK (status IN ('active', 'suspended')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE team_invitations (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  created_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boards ADD COLUMN team_id uuid REFERENCES teams(id);
```

Additional constraints that depend on concurrent row state, such as retaining
one team owner, must be enforced by transactional repository operations rather
than a simple row-level `CHECK` constraint.

## Migration strategy

The migration is split into independently deployable phases:

1. Add teams, team memberships and nullable `boards.team_id`.
2. Create one migration team for every distinct existing board ownership set,
   or use an explicitly configured import team for controlled environments.
3. Add each existing board owner as team owner and all existing board members as
   team members.
4. Backfill `boards.team_id`, validate every board owner belongs to its team and
   then make the column non-null.
5. Add invitation tables and APIs without changing existing board permissions.
6. Add external identities only after account-linking and provider onboarding
   behavior has been finalized.
7. Consider removing `boards.owner_id` only after all reads and writes derive
   ownership canonically from `board_members`. Until then it remains a
   compatibility invariant and must agree with the single owner membership.

Local-first schema version 5 is unaffected. Its local profiles are demonstration
personas, not server accounts, and must not be automatically linked to OIDC
identities during import.

## Authorization order

Every protected server operation follows this order:

1. Verify the external credential.
2. Resolve `(issuer, subject)` to an active local user.
3. Resolve the active team membership where the route is team-scoped.
4. Resolve explicit board membership and board role.
5. Apply task-assignee and workflow rules.
6. Commit the mutation and audit event atomically.

A successful authentication never implies team or board access.

## Consequences

Positive consequences:

- OIDC providers can be changed without rewriting application authorization.
- Multi-team users and multi-provider accounts are supported by the model.
- Invitations provide an explicit provisioning boundary.
- Existing board permission rules can be migrated incrementally.

Costs and tradeoffs:

- Team membership and board membership require separate administration.
- Invitation acceptance and account linking require careful transactions.
- The current `boards.owner_id` duplication must be maintained during migration.
- Provider login alone is insufficient for an unknown user until onboarding is
  explicitly completed.

## Deferred decisions

- concrete OIDC provider and authorization flow;
- open registration or personal teams;
- invitation delivery provider and retry behavior;
- enterprise domain verification or SSO enforcement;
- organization-level provider connections;
- account recovery, administrative merge and retention periods;
- team billing, quotas and subscription ownership.
