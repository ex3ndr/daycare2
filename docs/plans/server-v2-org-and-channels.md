# Server V2: Organization Management, Invites & Channel Enhancements

## Overview

Extend the Daycare server with full organization lifecycle management:

- **Org invites**: email-targeted invitations with expiry, revocation, and acceptance by whitelisted email
- **Domain allowlist**: allow any user with a matching email domain to self-join an org
- **Member lifecycle**: kick (deactivate) members so they can't rejoin, reactivate them later; user records are preserved
- **Channel enhancements**: add private-channel invite mechanism so members can actually join private channels

### What exists today
- `organizationCreate` — creates org + first user (OWNER concept missing)
- `organizationJoin` — joins public orgs (no invite/domain checks)
- `organizationAvailableResolve` — lists public orgs + orgs user belongs to
- Channel CRUD, join/leave, archive, kick, role set, notification set — all functional
- Private channels exist but nobody can join them (join throws "requires an invitation" with no invite system)

### What's new
- `OrgRole` enum (OWNER / MEMBER) on User — controls who can manage invites, domains, members
- `deactivatedAt` on User — soft-deactivation for kicked org members
- `OrgInvite` model — email-targeted org invitations with expiry/revocation
- `OrgDomain` model — org domain allowlist for self-join
- Auth middleware blocks deactivated users
- `organizationJoin` extended to accept invites and domain matches
- `organizationAvailableResolve` extended to surface invited/domain-matched orgs
- Private channel invite mechanism via `channelInviteAdd`

## Context (from discovery)

**Files/components involved:**
- `prisma/schema.prisma` — new models, enums, fields
- `sources/apps/organizations/` — new service functions
- `sources/apps/channels/` — channel invite enhancement
- `sources/apps/api/lib/authContextResolve.ts` — deactivation guard
- `sources/apps/api/lib/organizationRecipientIdsResolve.ts` — exclude deactivated
- `sources/apps/api/routes/org/orgRoutesRegister.ts` — new routes
- `sources/apps/api/routes/channels/channelRoutesRegister.ts` — invite route

**Patterns followed:**
- One function per file, prefix naming (`orgInviteCreate`, not `createOrgInvite`)
- Zod validation at route layer, typed input objects at service layer
- `databaseTransactionRun` for multi-step writes
- `ApiError` for domain errors
- SSE via `context.updates.publishToUsers`
- Idempotency guard on all write endpoints

## Development Approach
- **Testing approach**: Regular (code first) + end-to-end verification with agent-browser skill
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run `yarn typecheck && yarn test` after each change

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

---

## Implementation Steps

### Task 1: Prisma schema — add OrgRole, OrgInvite, OrgDomain, User fields

Add new models and fields to support org management.

**New enum `OrgRole`:**
```
OWNER
MEMBER
```

**New fields on `User`:**
```prisma
orgRole        OrgRole   @default(MEMBER)
deactivatedAt  DateTime?
```

**New model `OrgInvite`:**
```prisma
model OrgInvite {
  id              String    @id
  organizationId  String
  invitedByUserId String
  email           String
  expiresAt       DateTime
  acceptedAt      DateTime?
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())

  organization Organization @relation(...)
  invitedByUser User        @relation(...)

  @@unique([organizationId, email])   // one active invite per email per org
  @@index([organizationId, expiresAt])
  @@index([email])
}
```

**New model `OrgDomain`:**
```prisma
model OrgDomain {
  id              String   @id
  organizationId  String
  domain          String
  createdByUserId String
  createdAt       DateTime @default(now())

  organization Organization @relation(...)
  createdByUser User        @relation(...)

  @@unique([organizationId, domain])
  @@index([domain])
}
```

**Checklist:**
- [x] Add `OrgRole` enum to schema
- [x] Add `orgRole` and `deactivatedAt` fields to `User` model
- [x] Add `OrgInvite` model with relations
- [x] Add `OrgDomain` model with relations
- [x] Add reverse relations on `Organization` and `User` models
- [x] Update `organizationCreate` to set first user's `orgRole: OWNER`
- [x] Run `npx prisma migrate dev` to generate migration
- [x] Run `yarn typecheck` — must pass

### Task 2: Update auth middleware — block deactivated users

Deactivated org members must be rejected at the auth layer.

**Changes:**
- `authContextResolve.ts`: after finding User, check `deactivatedAt !== null` → throw 403
- `organizationRecipientIdsResolve.ts`: exclude deactivated users from SSE broadcast recipients
- `GET /org/:orgid/members`: include `deactivatedAt` and `orgRole` in response; optionally filter by `?active=true`

**Checklist:**
- [x] Update `authContextResolve` to check `user.deactivatedAt` and throw `ApiError(403, "FORBIDDEN", "Account has been deactivated")`
- [x] Update `organizationRecipientIdsResolve` to filter `deactivatedAt: null`
- [x] Update `GET /org/:orgid/members` response to include `orgRole` and `deactivatedAt` fields
- [x] Add `?active=true/false` query filter to `GET /org/:orgid/members`
- [x] Write tests for `authContextResolve` deactivation check
- [x] Write tests for `organizationRecipientIdsResolve` exclusion
- [x] Run `yarn typecheck && yarn test` — must pass

### Task 3: Org member deactivation and reactivation

Implement kick (deactivate) and reactivate at the org level. Deactivated members keep their User record but can't access the org.

**New files:**
- `sources/apps/organizations/orgMemberDeactivate.ts`
- `sources/apps/organizations/orgMemberReactivate.ts`

**Logic — `orgMemberDeactivate`:**
1. Verify actor has `orgRole: OWNER`
2. Prevent deactivating yourself
3. Prevent deactivating another OWNER (must demote first)
4. Set `deactivatedAt = now()` on target User
5. Set `leftAt = now()` on all target's active ChatMember records in this org
6. Publish `organization.member.deactivated` SSE event

**Logic — `orgMemberReactivate`:**
1. Verify actor has `orgRole: OWNER`
2. Find target user with `deactivatedAt !== null`
3. Set `deactivatedAt = null`
4. Publish `organization.member.reactivated` SSE event
5. Note: reactivation does NOT auto-rejoin channels — user must rejoin manually

**Routes:**
- `POST /api/org/:orgid/members/:userId/deactivate`
- `POST /api/org/:orgid/members/:userId/reactivate`

**Checklist:**
- [x] Create `orgMemberDeactivate.ts` with input types and function
- [x] Create `orgMemberReactivate.ts` with input types and function
- [x] Wire routes in `orgRoutesRegister.ts`
- [x] Write tests for deactivate (success, self-deactivate blocked, non-owner blocked, owner-target blocked)
- [x] Write tests for reactivate (success, non-owner blocked, already-active blocked)
- [x] Run `yarn typecheck && yarn test` — must pass

### Task 4: Org invite system

Email-targeted invites with expiry and revocation.

**New files:**
- `sources/apps/organizations/orgInviteCreate.ts`
- `sources/apps/organizations/orgInviteList.ts`
- `sources/apps/organizations/orgInviteRevoke.ts`

**Logic — `orgInviteCreate`:**
1. Verify actor has `orgRole: OWNER`
2. Check email isn't already an active member of this org (lookup Account by email → User by accountId+orgId)
3. Check no pending non-expired invite exists for this email+org (upsert or conflict)
4. Create `OrgInvite` with `expiresAt` = now + configurable duration (default: 7 days)
5. Publish `organization.invite.created` SSE event
6. Return the invite record

**Logic — `orgInviteList`:**
1. Verify actor is org member
2. Return all invites for org, marking expired ones in response (check `expiresAt < now && acceptedAt == null && revokedAt == null`)

**Logic — `orgInviteRevoke`:**
1. Verify actor has `orgRole: OWNER`
2. Find invite by id, verify it belongs to this org
3. Check invite is still pending (not accepted, not already revoked)
4. Set `revokedAt = now()`
5. Publish `organization.invite.revoked` SSE event

**Routes:**
- `POST /api/org/:orgid/invites` — body: `{ email: string }`
- `GET /api/org/:orgid/invites` — list all invites
- `POST /api/org/:orgid/invites/:inviteId/revoke` — revoke invite

**Checklist:**
- [ ] Create `orgInviteCreate.ts`
- [ ] Create `orgInviteList.ts`
- [ ] Create `orgInviteRevoke.ts`
- [ ] Wire routes in `orgRoutesRegister.ts`
- [ ] Write tests for invite create (success, duplicate email, already-member, non-owner blocked)
- [ ] Write tests for invite list (includes expired status, filters correctly)
- [ ] Write tests for invite revoke (success, already-accepted, already-revoked, non-owner blocked)
- [ ] Run `yarn typecheck && yarn test` — must pass

### Task 5: Org domain allowlist

Simple domain allowlist — any authenticated user with a matching email domain can self-join.

**New files:**
- `sources/apps/organizations/orgDomainAdd.ts`
- `sources/apps/organizations/orgDomainList.ts`
- `sources/apps/organizations/orgDomainRemove.ts`

**Logic — `orgDomainAdd`:**
1. Verify actor has `orgRole: OWNER`
2. Validate domain format (lowercase, trimmed, no leading `@`)
3. Create `OrgDomain` record (unique constraint handles duplicates)
4. Publish `organization.domain.added` SSE event

**Logic — `orgDomainList`:**
1. Verify actor is org member
2. Return all domains for org

**Logic — `orgDomainRemove`:**
1. Verify actor has `orgRole: OWNER`
2. Find domain by id, verify it belongs to this org
3. Delete record
4. Publish `organization.domain.removed` SSE event

**Routes:**
- `POST /api/org/:orgid/domains` — body: `{ domain: string }`
- `GET /api/org/:orgid/domains` — list domains
- `DELETE /api/org/:orgid/domains/:domainId` — remove domain

**Checklist:**
- [ ] Create `orgDomainAdd.ts`
- [ ] Create `orgDomainList.ts`
- [ ] Create `orgDomainRemove.ts`
- [ ] Wire routes in `orgRoutesRegister.ts`
- [ ] Write tests for domain add (success, duplicate, invalid format, non-owner blocked)
- [ ] Write tests for domain list
- [ ] Write tests for domain remove (success, not-found, non-owner blocked)
- [ ] Run `yarn typecheck && yarn test` — must pass

### Task 6: Update org join flow — invites and domain matching

Extend `organizationJoin` and `organizationAvailableResolve` to respect invites and domains.

**Changes to `organizationAvailableResolve`:**
Add to the `OR` conditions:
- Orgs where user's account email has a pending, non-expired, non-revoked `OrgInvite`
- Orgs where user's account email domain matches an `OrgDomain`

**Changes to `organizationJoin`:**
Before creating the User record:
1. If org is public → allow (existing behavior)
2. If user's email has a valid (pending, non-expired, non-revoked) `OrgInvite` → allow, mark invite `acceptedAt = now()`
3. If user's email domain matches an `OrgDomain` → allow
4. If none of the above → throw 403

Also check: if user was previously deactivated (`deactivatedAt !== null`), block rejoin with 403 "Account has been deactivated, contact an admin"

**Checklist:**
- [ ] Update `organizationAvailableResolve` to include invite-matched and domain-matched orgs
- [ ] Update `organizationJoin` to check invites, domains, and deactivation status
- [ ] Mark accepted invites during join
- [ ] Write tests for join via invite (success, expired invite blocked, revoked invite blocked)
- [ ] Write tests for join via domain (success, domain not listed blocked)
- [ ] Write tests for join blocked by deactivation
- [ ] Write tests for `organizationAvailableResolve` with invites and domains
- [ ] Run `yarn typecheck && yarn test` — must pass

### Task 7: Channel enhancements — private channel invites

Add the missing invite mechanism for private channels.

**New files:**
- `sources/apps/channels/channelInviteAdd.ts`

**Logic — `channelInviteAdd`:**
1. Verify channel exists and is PRIVATE
2. Verify actor is a member of the channel with role OWNER
3. Verify target user is an active member of the org
4. Create ChatMember for target user (or reactivate if historical membership exists)
5. Publish `member.joined` SSE event

**Changes to `channelJoin`:**
- For private channels: check if user already has an active ChatMember record (meaning they were invited). If yes, allow. If no, throw 403.
- This replaces the blanket "Private channels require an invitation" error.

Actually, the simpler approach: `channelInviteAdd` directly creates the membership (the invite IS the join). No separate accept step needed for channels — the owner adds them.

**Route:**
- `POST /api/org/:orgid/channels/:channelId/members` — body: `{ userId: string }` (add member to private channel)

**Checklist:**
- [ ] Create `channelInviteAdd.ts`
- [ ] Wire route `POST /api/org/:orgid/channels/:channelId/members` in `channelRoutesRegister.ts`
- [ ] Write tests for channel invite (success, not-owner blocked, public-channel blocked, non-org-member blocked, deactivated-user blocked)
- [ ] Run `yarn typecheck && yarn test` — must pass

### Task 8: Update SSE event types and member serialization

Ensure all new operations emit proper SSE events and member data is consistent.

**New SSE events to support:**
- `organization.member.deactivated` — `{ orgId, userId }`
- `organization.member.reactivated` — `{ orgId, userId }`
- `organization.invite.created` — `{ orgId, inviteId, email }`
- `organization.invite.revoked` — `{ orgId, inviteId }`
- `organization.domain.added` — `{ orgId, domainId, domain }`
- `organization.domain.removed` — `{ orgId, domainId }`

**Member serialization updates:**
- `GET /org/:orgid/members` response now includes `orgRole` and `deactivatedAt`
- `GET /org/:orgid/profile` response now includes `orgRole` and `deactivatedAt`

**Checklist:**
- [ ] Verify all new service functions publish appropriate SSE events (should already be done in tasks 3-7)
- [ ] Update `GET /org/:orgid/profile` to include `orgRole` and `deactivatedAt`
- [ ] Document all new SSE event types in CLAUDE.md
- [ ] Run `yarn typecheck && yarn test` — must pass

### Task 9: Org role management

Allow owners to promote/demote members.

**New file:**
- `sources/apps/organizations/orgMemberRoleSet.ts`

**Logic:**
1. Verify actor has `orgRole: OWNER`
2. Prevent demoting yourself (org must always have at least one OWNER)
3. Update target user's `orgRole`
4. Publish `organization.member.updated` SSE event

**Route:**
- `PATCH /api/org/:orgid/members/:userId/role` — body: `{ role: "OWNER" | "MEMBER" }`

**Checklist:**
- [ ] Create `orgMemberRoleSet.ts`
- [ ] Wire route in `orgRoutesRegister.ts`
- [ ] Write tests (success, self-demote blocked, non-owner blocked)
- [ ] Run `yarn typecheck && yarn test` — must pass

### Task 10: Verify acceptance criteria
- [ ] Verify all org management requirements are implemented (create, invite, accept, domain, revoke, expire, kick, reactivate)
- [ ] Verify channel enhancements work (private channel invite/add member)
- [ ] Run full test suite: `yarn typecheck && yarn test`
- [ ] Verify all new routes are registered
- [ ] Verify deactivated users are blocked from all org API calls
- [ ] Verify SSE events fire for all state changes

### Task 11: Update CLAUDE.md with new routes and events
- [ ] Add new org management routes to CLAUDE.md
- [ ] Add new SSE event types to CLAUDE.md
- [ ] Add new domain management routes

## Technical Details

### Data Flow: Invite → Join

```
1. OWNER calls POST /api/org/:orgid/invites { email: "user@company.com" }
   → OrgInvite created with expiresAt = now + 7d
   → SSE: organization.invite.created

2. User logs in with user@company.com
   → GET /api/org/available now includes the invited org

3. User calls POST /api/org/:orgid/join { firstName, username }
   → organizationJoin finds matching OrgInvite
   → Creates User record in org
   → Marks invite acceptedAt = now()
   → SSE: organization.member.joined
```

### Data Flow: Domain → Join

```
1. OWNER calls POST /api/org/:orgid/domains { domain: "company.com" }
   → OrgDomain created
   → SSE: organization.domain.added

2. Any user with @company.com email logs in
   → GET /api/org/available now includes the org

3. User calls POST /api/org/:orgid/join { firstName, username }
   → organizationJoin finds matching OrgDomain
   → Creates User record in org
   → SSE: organization.member.joined
```

### Data Flow: Kick → Reactivate

```
1. OWNER calls POST /api/org/:orgid/members/:userId/deactivate
   → User.deactivatedAt = now()
   → All ChatMember.leftAt = now() for this user's channels
   → SSE: organization.member.deactivated

2. Deactivated user tries any org API call
   → authContextResolve throws 403 "Account has been deactivated"

3. OWNER calls POST /api/org/:orgid/members/:userId/reactivate
   → User.deactivatedAt = null
   → SSE: organization.member.reactivated
   → User must manually rejoin channels
```

### Permission Matrix

| Action                  | OWNER | MEMBER |
|------------------------|-------|--------|
| Create invite          | ✅    | ❌     |
| Revoke invite          | ✅    | ❌     |
| List invites           | ✅    | ✅     |
| Add domain             | ✅    | ❌     |
| Remove domain          | ✅    | ❌     |
| List domains           | ✅    | ✅     |
| Deactivate member      | ✅    | ❌     |
| Reactivate member      | ✅    | ❌     |
| Set member role        | ✅    | ❌     |
| Add member to channel  | Channel OWNER | ❌ |

## Post-Completion

**Manual verification:**
- Test invite flow end-to-end using agent-browser with two accounts
- Test domain-based join with matching email
- Test deactivation blocks all API access
- Test reactivation restores access
- Test private channel member addition

**Future considerations (out of scope):**
- Email delivery for invite notifications (currently invites are API-only; no email sent)
- Invite link/URL generation
- Org deletion
- Transfer org ownership
