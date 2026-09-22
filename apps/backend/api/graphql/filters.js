import DataLoader from 'dataloader'

export const commentFilter = userId => relation => relation.query(q => {
  q.distinct()
  q.where({ 'comments.active': true })

  if (userId) {
    q.leftJoin('groups_posts', 'comments.post_id', 'groups_posts.post_id')
    // Only join posts if not already joined (e.g. by the User.comments relation)
    if (!q.queryContext()?.alreadyJoinedPosts) {
      q.join('posts', 'groups_posts.post_id', 'posts.id')
    }
    q.whereNotIn('comments.user_id', BlockedUser.blockedFor(userId))

    q.where(q2 => {
      const followedPostIds = PostUser.followedPostIds(userId)
      q2.whereIn('comments.post_id', followedPostIds)
        .orWhereIn('groups_posts.group_id', Group.selectIdsForMember(userId))
        .orWhere('posts.is_public', true)
    })
    q.groupBy('comments.id')
  }
})

// Which groups are visible to the user?
export const groupFilter = userId => relation => {
  return relation.query(q => {
    q.where('groups.active', true)

    // non authenticated queries can only see public groups
    if (!userId) {
      q.where('groups.visibility', Group.Visibility.PUBLIC)
    } else {
      // the effect of using `where` like this is to wrap everything within its
      // callback in parentheses -- this is necessary to keep `or` from "leaking"
      // out to the rest of the query
      q.where(q2 => {
        const selectIdsForMember = Group.selectIdsForMember(userId)
        const parentGroupIds = GroupRelationship.parentIdsFor(selectIdsForMember)
        const childGroupIds = GroupRelationship.childIdsFor(selectIdsForMember)
        const peerGroupIds = GroupRelationship.peerIdsFor(selectIdsForMember)
        // You can see all related groups, even hidden ones, if you are a group Administrator
        const selectStewardedGroupIds = Group.selectIdsByResponsibilities(userId, [Responsibility.constants.RESP_ADMINISTRATION])
        const childrenOfStewardedGroupIds = GroupRelationship.childIdsFor(selectStewardedGroupIds)
        const peerGroupsOfStewardedGroupIds = GroupRelationship.peerIdsFor(selectStewardedGroupIds)
        // Spaces use parent_id, not group_relationships — parent stewards must still fetch them
        const selectJoinManagerGroupIds = Group.selectIdsByResponsibilities(userId, [
          Responsibility.constants.RESP_ADMINISTRATION,
          Responsibility.constants.RESP_ADD_MEMBERS
        ])

        // Can see groups you are a member of...
        q2.whereIn('groups.id', selectIdsForMember)
        // + their parent groups
        q2.orWhereIn('groups.id', parentGroupIds)
        // + child groups that are not hidden, except Admininstrators of a group can see its hidden children
        q2.orWhere(q3 => {
          q3.where(q4 => {
            q4.whereIn('groups.id', childGroupIds)
            q4.andWhere('groups.visibility', '!=', Group.Visibility.HIDDEN)
          })
          q3.orWhereIn('groups.id', childrenOfStewardedGroupIds)
        })
        // + peer groups that are not hidden, except Administrators of a group can see its hidden peer groups
        q2.orWhere(q6 => {
          q6.where(q7 => {
            q7.whereIn('groups.id', peerGroupIds)
            q7.andWhere('groups.visibility', '!=', Group.Visibility.HIDDEN)
          })
          q6.orWhereIn('groups.id', peerGroupsOfStewardedGroupIds)
        })
        // + spaces of groups you can add members to / administer (including hidden)
        q2.orWhere(qSpace => {
          qSpace.where('groups.type', 'space')
          qSpace.whereIn('groups.parent_id', selectJoinManagerGroupIds)
        })
        // + non-hidden child spaces of groups you belong to (join interstitial, More Spaces,
        // paywalled tracks). Spaces use parent_id, not group_relationships, so the child-group
        // clause above never includes them.
        q2.orWhere(qSpaceMember => {
          qSpaceMember.where('groups.type', 'space')
          qSpaceMember.whereIn('groups.parent_id', selectIdsForMember)
          qSpaceMember.andWhere('groups.visibility', '!=', Group.Visibility.HIDDEN)
        })
        // + all public groups
        q2.orWhere(q5 => {
          q5.where('groups.visibility', Group.Visibility.PUBLIC)
        })
      })
    }
  })
}

/**
 * One-shot ID sets matching groupFilter, for filtering an already-loaded
 * group list (e.g. a post's groups) without re-running that SQL per row.
 */
export async function loadGroupVisibilityContext (userId) {
  if (!userId) return null

  // Explicit knex + active memberships. Bookshelf .query().pluck() has dropped
  // where / whereIn, which treated leftover (inactive) parent memberships as current.
  const [memberIds, stewardIdList, joinManagerIdList] = await Promise.all([
    activeMemberGroupIds(userId),
    groupIdsByResponsibilities(userId, [Responsibility.constants.RESP_ADMINISTRATION]),
    groupIdsByResponsibilities(userId, [
      Responsibility.constants.RESP_ADMINISTRATION,
      Responsibility.constants.RESP_ADD_MEMBERS
    ])
  ])

  const [parentIds, childIds, peerIds, stewardChildIds, stewardPeerIds] = await Promise.all([
    relatedGroupIds(memberIds, 'parent'),
    relatedGroupIds(memberIds, 'child'),
    relatedGroupIds(memberIds, 'peer'),
    relatedGroupIds(stewardIdList, 'child'),
    relatedGroupIds(stewardIdList, 'peer')
  ])

  return {
    memberIds: new Set(memberIds),
    parentIds: new Set(parentIds),
    childIds: new Set(childIds),
    peerIds: new Set(peerIds),
    stewardChildIds: new Set(stewardChildIds),
    stewardPeerIds: new Set(stewardPeerIds),
    joinManagerIds: new Set(joinManagerIdList)
  }
}

/**
 * Fresh DataLoader for Yoga context. Schema-cached loaders in makeModels
 * outlive a request and would keep stale memberships after leave.
 */
export function createGroupVisibilityLoader () {
  return new DataLoader(
    userIds => Promise.all(userIds.map(id => loadGroupVisibilityContext(id))),
    { cacheKeyFn: id => String(id) }
  )
}

/**
 * Group ids the user currently belongs to (active membership, active group).
 */
async function activeMemberGroupIds (userId) {
  const rows = await bookshelf.knex('group_memberships')
    .join('groups', 'groups.id', 'group_memberships.group_id')
    .where('group_memberships.user_id', userId)
    .andWhere('group_memberships.active', true)
    .andWhere('groups.active', true)
    .select('groups.id')
  return rows.map(row => String(row.id))
}

/**
 * Groups the user stewards, requiring an active membership (spaces inherit
 * roles from parent_id). Same rules as Group.selectIdsByResponsibilities.
 */
async function groupIdsByResponsibilities (userId, responsibilityTitles) {
  const knex = bookshelf.knex
  const roleGroupIds = knex('group_memberships_group_roles as mgr')
    .join('group_roles_responsibilities as grr', 'grr.group_role_id', 'mgr.group_role_id')
    .join('responsibilities as r', 'r.id', 'grr.responsibility_id')
    .where('mgr.user_id', userId)
    .whereIn('r.title', responsibilityTitles)
    .where(function () {
      this.where('mgr.active', true).orWhereNull('mgr.active')
    })
    .select('mgr.group_id')

  const rows = await knex('group_memberships')
    .join('groups', 'groups.id', 'group_memberships.group_id')
    .where('group_memberships.user_id', userId)
    .andWhere('group_memberships.active', true)
    .andWhere('groups.active', true)
    .where(function () {
      this.whereIn('groups.id', roleGroupIds)
        .orWhereIn('groups.parent_id', roleGroupIds)
    })
    .select('groups.id')
  return rows.map(row => String(row.id))
}

/**
 * IDs related to `fromIds` via group_relationships. Uses knex so the whereIn
 * cannot be dropped (Bookshelf `.query().pluck()` was returning every row).
 */
async function relatedGroupIds (fromIds, direction) {
  if (!fromIds || fromIds.length === 0) return []
  const knex = bookshelf.knex
  const parentChild = Group.RelationshipType.PARENT_CHILD
  const peer = Group.RelationshipType.PEER_TO_PEER

  if (direction === 'parent') {
    const rows = await knex('group_relationships')
      .select('parent_group_id')
      .where({ active: true, relationship_type: parentChild })
      .whereIn('child_group_id', fromIds)
    return rows.map(row => String(row.parent_group_id))
  }

  if (direction === 'child') {
    const rows = await knex('group_relationships')
      .select('child_group_id')
      .where({ active: true, relationship_type: parentChild })
      .whereIn('parent_group_id', fromIds)
    return rows.map(row => String(row.child_group_id))
  }

  const [asParent, asChild] = await Promise.all([
    knex('group_relationships')
      .select('child_group_id as group_id')
      .where({ active: true, relationship_type: peer })
      .whereIn('parent_group_id', fromIds),
    knex('group_relationships')
      .select('parent_group_id as group_id')
      .where({ active: true, relationship_type: peer })
      .whereIn('child_group_id', fromIds)
  ])
  return [...asParent, ...asChild].map(row => String(row.group_id))
}

function groupVisibilityValue (group) {
  const raw = group.get ? group.get('visibility') : group.visibility
  if (raw === null || raw === undefined || raw === '') return null
  return Number(raw)
}

/**
 * Whether a group should appear on a post the viewer can already see.
 * Same rules as groupFilter: public, member, parent, protected child/peer
 * of a membership, hidden child/peer of a stewarded group, and spaces via parent_id.
 */
export function isGroupVisibleToViewer (group, ctx, userId) {
  const visibility = groupVisibilityValue(group)
  if (visibility === Group.Visibility.PUBLIC) return true
  if (!userId || !ctx) return false

  const id = String(group.id)
  if (ctx.memberIds.has(id)) return true
  // Parents of groups you belong to (including hidden)
  if (ctx.parentIds.has(id)) return true
  // Protected children / peers of your groups (not every non-hidden group)
  if (visibility === Group.Visibility.PROTECTED && ctx.childIds.has(id)) return true
  if (visibility === Group.Visibility.PROTECTED && ctx.peerIds.has(id)) return true
  // Hidden children / peers if you steward the related group
  if (ctx.stewardChildIds.has(id)) return true
  if (ctx.stewardPeerIds.has(id)) return true

  const type = group.get ? group.get('type') : group.type
  if (type === 'space') {
    const parentId = String((group.get ? group.get('parent_id') : group.parentId) || '')
    if (ctx.joinManagerIds.has(parentId)) return true
    if (ctx.memberIds.has(parentId) && visibility === Group.Visibility.PROTECTED) return true
  }
  return false
}

export function groupTopicFilter (userId, {
  autocomplete,
  groupId,
  groupIds,
  isDefault,
  subscribed,
  visibility
}) {
  return q => {
    q.distinct('groups_tags.tag_id')
    if (groupId) {
      q.where('groups_tags.group_id', groupId)
    }
    if (groupIds) {
      q.whereIn('groups_tags.group_id', groupIds)
    }

    if (autocomplete) {
      q.join('tags', 'tags.id', 'groups_tags.tag_id')
      q.whereRaw('tags.name ilike ?', autocomplete + '%')
    }

    if (isDefault) {
      q.where('groups_tags.is_default', true)
    }

    if (subscribed && userId) {
      q.join('tag_follows', 'tag_follows.tag_id', 'groups_tags.tag_id')
      q.where('tag_follows.user_id', userId)
      q.whereRaw('tag_follows.group_id = groups_tags.group_id')
    }

    if (visibility) {
      q.whereIn('groups_tags.visibility', visibility)
    }
  }
}

export function makeFilterToggle (enabled) {
  return filterFn => relation =>
    enabled ? filterFn(relation) : relation
}

export const membershipFilter = userId => relation => {
  if (userId) {
    return relation.query(q => {
      // XXX: why are we passing in AXOLOTL_ID? wouldnt that return all memberships the AXOLOTL has too?
      const subq = GroupMembership.forMember([userId, User.AXOLOTL_ID]).query().select('group_id')
      q.whereIn('group_memberships.group_id', subq)
    })
  }
  return relation
}

export const messageFilter = userId => relation => relation.query(q => {
  q.whereNotIn('comments.user_id', BlockedUser.blockedFor(userId))
})

export const personFilter = userId => relation => relation.query(q => {
  if (userId) {
    q.whereNotIn('users.id', BlockedUser.blockedFor(userId))

    // limit to users that are in those other memberships or are connected some other way

    // find all other memberships of users that are in shared groups
    const sharedMemberships = GroupMembership.query(q3 => {
      q3.select('group_memberships.user_id')
      q3.whereIn('group_memberships.group_id', Group.selectIdsForMember(userId))
    })
    const sharedConnections = UserConnection.query(ucq => {
      ucq.select('other_user_id')
      ucq.where('user_connections.user_id', userId)
    })
    q.where(inner =>
      inner.where('users.id', User.AXOLOTL_ID)
        .orWhereIn('users.id', sharedMemberships.query())
        .orWhereIn('users.id', sharedConnections.query()))
  }
})

export const postFilter = (userId, isAdmin) => relation => {
  return relation.query(q => {
    // Always only show active posts
    q.where('posts.active', true)

    // If we are loading posts through a group then groups_posts already joined, otherwise we need it
    // Also check if we already loaded groups_posts in the forPosts search code
    if ((!relation.relatedData || relation.relatedData.parentTableName !== 'groups') && !q.queryContext()?.alreadyJoinedGroupPosts) {
      q.join('groups_posts', 'groups_posts.post_id', '=', 'posts.id')
    }

    if (!userId) {
      // non authenticated queries can only see public posts
      q.where('posts.is_public', true)
    } else if (!isAdmin) {
      // Only show posts that are public or posted to a group the user is a member of
      q.where(q3 => {
        const selectIdsForMember = Group.selectIdsForMember(userId)
        q3.whereIn('groups_posts.group_id', selectIdsForMember).orWhere('posts.is_public', true)
      })

      // Don't show posts from blocked users
      q.whereNotIn('posts.user_id', BlockedUser.blockedFor(userId))
    }
  })
}

// Only can see reactions from active posts that are public or are in a group that the person is a member of
export const reactionFilter = userId => relation => {
  return relation.query(q => {
    q.join('groups_posts', 'reactions.entity_id', 'groups_posts.post_id')
    q.join('posts', 'posts.id', 'groups_posts.post_id')
    q.where('posts.active', true)
    q.andWhere('reactions.entity_type', 'post')
    q.andWhere(q2 => {
      const selectIdsForMember = Group.selectIdsForMember(userId)
      q.whereIn('groups_posts.group_id', selectIdsForMember)
      q.orWhere('posts.is_public', true)
    })
  })
}
