# Identity architecture

JaDy Board delegates authentication completely to Clerk. Application users,
roles, boards, memberships and permissions remain exclusively in PostgreSQL.
The provider is isolated behind the existing identity-resolver boundary so it
can be replaced without changing domain authorization.

## Runtime boundary

```text
Browser -> ClerkJS session token
        -> ClerkPrincipalResolver       verifies the session with Clerk
        -> { issuer, subject }          provider-neutral principal
        -> LocalUserResolver            reads external_identities
        -> users.id                     local authorization identity
        -> board_members + permissions  application authorization
```

Only `server/src/http/clerk-principal.js` depends on the Clerk backend SDK. It
must not create users, assign roles, infer membership or trust unverified JWT
payloads. The rest of the server receives only the stable external identity:

```js
{ issuer: "https://example.clerk.accounts.dev", subject: "user_..." }
```

The local resolver maps this tuple to an active `users.id` through
`external_identities`. A valid Clerk identity without such a link receives
`403 IDENTITY_NOT_LINKED`; it is never provisioned implicitly. An invalid or
missing Clerk session receives `401 AUTHENTICATION_REQUIRED`.

## Configuration

Production-like environments use:

```dotenv
AUTH_MODE=clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_AUTHORIZED_PARTIES=https://board.example.com
CORS_ORIGIN=https://board.example.com
```

`CLERK_AUTHORIZED_PARTIES` is mandatory and contains comma-separated, explicit
browser origins. The secret key is server-only. `GET /api/auth/config` exposes
only the selected mode and Clerk publishable key.

The browser loads ClerkJS and Clerk UI from the Frontend API encoded in the
publishable key. Every API request obtains a short-lived token from the active
Clerk session and sends it as `Authorization: Bearer ...`. JaDy Board never
stores Clerk passwords or session tokens.

## Linking an existing local user

After migrations have run, an administrator can explicitly link a Clerk user
to an existing local user. Use the JWT issuer (`iss`) produced by the configured
Clerk instance and the stable Clerk user ID as `subject`:

```sql
INSERT INTO external_identities (id, user_id, issuer, subject)
VALUES (
  'GENERATED-UUID',
  'LOCAL-USERS-ID',
  'https://example.clerk.accounts.dev',
  'user_...'
);
```

The unique `(issuer, subject)` constraint prevents one Clerk identity from
belonging to multiple local users. Email is profile and invitation-routing
data, never an identity key. Clerk organization metadata, roles and claims do
not grant JaDy Board permissions.

Invitation acceptance and user-facing account linking remain separate product
flows described in [ADR 0001](adr/0001-team-tenancy-and-account-linking.md).
Until those flows exist, linking is an explicit administrative operation.

## Non-production modes

`AUTH_MODE=development` with `DEV_USER_ID` and
`AUTH_MODE=controlled-bearer` with `API_BEARER_IDENTITIES` remain isolated
development/test adapters. They cannot be configured together with Clerk and
are not production authentication mechanisms.

## Security invariants

- Authentication failure yields no local user identity.
- Unknown but valid external principals are not provisioned implicitly.
- Tokens, authorization headers and Clerk secrets are never stored in
  PostgreSQL or logs.
- Provider adapters do not assign application roles.
- Local authorization always runs after identity mapping.
- Provider email, organization and role claims never bypass PostgreSQL.
