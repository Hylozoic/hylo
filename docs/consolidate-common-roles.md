# Consolidate Common Roles into Group Roles

Standalone project to eliminate `common_roles` and use only `groups_roles` for all role assignments.

## Goal

System roles (Coordinator, Moderator, Host) are stamped out per group as `groups_roles` rows with `type = 'system'`. All member role assignments use `group_memberships_group_roles` only.

## Tables removed

- `common_roles`
- `common_roles_responsibilities`
- `group_memberships_common_roles`

## Columns removed

- `group_memberships.role` (legacy moderator flag; replaced by Coordinator system role assignment)
- `group_invites.role` (replaced by `group_role_id`)

## Schema change

```sql
ALTER TABLE groups_roles ADD COLUMN type varchar NOT NULL DEFAULT 'custom';
```

System roles: `type = 'system'`. Custom steward-created roles: `type = 'custom'`.

## System role definitions

Hardcoded by name. Responsibilities looked up by `name AND type = 'system'` (never by id).

| Name | Emoji | Responsibilities |
|------|-------|------------------|
| Coordinator | 🪄 | Administration, Add Members, Remove Members, Manage Content, Manage Tracks, Manage Rounds |
| Moderator | ⚖️ | Manage Content, Remove Members |
| Host | 👋 | Add Members |

## Migration steps

1. Add `type` column to `groups_roles`
2. For each group: create 3 system `groups_roles` rows + `group_roles_responsibilities` links
3. Migrate `group_memberships_common_roles` → `group_memberships_group_roles` (map by common role name → per-group system role id)
4. Migrate `content_access.common_role_id` → `group_role_id` (per granting group)
5. Migrate `group_invites.common_role_id` → `group_role_id`
6. Migrate `tracks` where `completion_role_type = 'common'` → `type = 'group'` with mapped id
7. Migrate `funding_rounds.submitter_roles` / `voter_roles` JSON entries with `type: 'common'`
8. Migrate `user_scopes` from `common_role:<groupId>:<id>` → `group_role:<groupId>:<id>`
9. Update DB trigger functions to remove `common_role_id` branches
10. Drop `common_role_id` from `content_access`, `group_invites`
11. Drop legacy `role` from `group_memberships`, `group_invites` (no data migration — column may be stale)
12. Drop `tracks.completion_role_type` (`completion_role_id` always references `groups_roles` after step 6)
13. Drop `group_memberships_common_roles`, `common_roles_responsibilities`, `common_roles`

## Group creation

`Group.create` calls `GroupRole.setupSystemRoles(groupId)` before adding the creator as a member. Steward assignment uses the per-group Coordinator system role via `assignCoordinator: true`.

## Coordinator assignment API

- `GroupMembership.assignCoordinatorRole(userId, groupId)` — assigns per-group Coordinator system role
- `User.joinGroup(group, { assignCoordinator: true })` — join + assign Coordinator
- `Group.addMembers(ids, { assignCoordinator: true })` — bulk join + assign Coordinator
- GraphQL `addMember(assignCoordinator: Boolean)` — replaces legacy role flag

## GraphQL

- Add `type: String` to `GroupRole`
- Remove `CommonRole`, `MembershipCommonRole`, `commonRoles` query, `Membership.role`
- Remove `isCommonRole` from `addRoleToMember` / `removeRoleFromMember`

## Frontend

- Roles settings: system roles from `group.groupRoles` where `type = 'system'` (not separate `commonRoles` query)
- Track/Funding round editors: all roles from `group.groupRoles`
- Paid content / access grants: use `groupRoleIds` only

## Follow-up

- Remove remaining `common_role` scope strings from production `user_scopes` if any legacy rows remain (`parseScope` still reads them for backwards compatibility)
