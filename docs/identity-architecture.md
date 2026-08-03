# Identity architecture

JaDy Board separates authentication from its local user and authorization
model. This boundary is intentionally provider-neutral so an OpenID Connect
(OIDC) provider can be selected after registration, invitations, teams and
account-linking semantics have been decided.

## Runtime boundary

```text
HTTP request
  -> RequestPrincipalResolver     verifies the external credential
  -> AuthenticatedPrincipal       stable { issuer, subject }
  -> LocalUserResolver            maps the principal to PostgreSQL
  -> local users.id               used by memberships and permissions
```

`RequestPrincipalResolver` is the only provider-specific boundary. It must not
create users, assign roles, infer board membership or trust an unverified token
payload. Its successful result contains only the stable external identity:

```js
{ issuer: "https://identity.example.com", subject: "provider-user-id" }
```

`LocalUserResolver` owns account lookup and eventually account linking. Its
result is a local `users.id` UUID or `null`. All board roles, memberships,
ownership and task permissions continue to use that local UUID in PostgreSQL.

## Future OIDC adapter contract

Before returning a principal, an OIDC adapter must at least verify:

- the token signature against trusted provider keys;
- the exact issuer and intended audience;
- expiry and not-before timestamps;
- the provider's stable `sub` claim;
- the permitted token type and authorization flow.

Provider claims such as email, groups or organization membership must not
directly become JaDy Board permissions. They may inform a later, explicit
provisioning or account-linking workflow, but authorization remains local.

The provider adapter must never use an email address as the external identity
key. The stable key is the tuple `(issuer, subject)`.

## Current controlled bearer adapter

`API_BEARER_IDENTITIES` remains a development and controlled-test mechanism.
Its verifier exposes the synthetic issuer
`urn:jady-board:controlled-bearer`; its subject is mapped to the configured
local user UUID through the same composition boundary used by a future OIDC
adapter. It is not an OIDC implementation and is not a registration system.

## Deliberately deferred decisions

No external-identity database table or automatic user provisioning is added
until these product decisions are made:

- self-registration versus invitation-only access;
- personal workspaces versus organizations or teams;
- who may invite, remove and promote members;
- whether one local account may link multiple providers;
- how verified email changes and account recovery are handled;
- collision, unlinking, deletion and organization-transfer semantics.

Once decided, a migration can introduce an external identity relation keyed by
`(issuer, subject)` and referencing `users.id`. Existing board tables and
permission checks do not need to change.

## Security invariants

- Authentication failure yields no local user identity.
- Unknown but valid external principals are not provisioned implicitly.
- Tokens and authorization headers are never stored in PostgreSQL or logs.
- Provider adapters do not assign application roles.
- Local authorization always runs after identity mapping.
