import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import { localSpaceSlug, storedSpaceSlug } from '@hylo/navigation'
import InvitationService from '../../services/InvitationService'
import { notifyGroupUpdated } from './notifyGroupUpdated'

// Space mutations — see docs/spaces-and-views-engineering-spec.md section 4.4 / 10

function slugify (name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'space'
}

/** First unused groups.slug. Stored space slugs include the parent prefix, so do not cap at 40. */
async function uniqueSlug (baseSlug) {
  let slug = baseSlug
  let suffix = 2
  while (await Group.where({ slug }).fetch()) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }
  return slug
}

/** Local URL slug, then globally unique `{parentSlug}-{localSlug}` for storage. */
async function uniqueStoredSpaceSlug (parentSlug, requestedSlug, name) {
  const requestedLocal = requestedSlug ? localSpaceSlug(parentSlug, requestedSlug) : ''
  const localSlug = requestedLocal && Group.isSlugValid(requestedLocal)
    ? requestedLocal
    : slugify(name)
  return uniqueSlug(storedSpaceSlug(parentSlug, localSlug))
}

/**
 * Require Administration on the parent group to manage a space.
 * Does not require space membership (stewards are not auto-added to every space).
 * @param {object} [opts]
 * @param {boolean} [opts.includeInactive] - allow inactive (archived) spaces; used by delete
 */
async function requireSpaceManager (userId, spaceId, action, { includeInactive = false } = {}) {
  const space = includeInactive
    ? await Group.find(spaceId)
    : await Group.findActive(spaceId)
  if (!space || space.get('type') !== 'space') throw new GraphQLError('Space not found')

  const parentId = space.get('parent_id')
  if (!parentId) throw new GraphQLError('Space has no parent group')

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError(`You don't have permission to ${action}`)
  }
  return space
}

export async function createSpace (userId, { parentGroupId, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles, purpose, location, locationId, viewTypes, bannerUrl, avatarUrl, paywall, addToMenu = true, status }, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!parentGroupId) throw new GraphQLError('No parentGroupId passed into function')
  if (!name || !name.trim()) throw new GraphQLError('Name cannot be blank')

  const parentGroup = await Group.findActive(parentGroupId)
  if (!parentGroup) throw new GraphQLError('Parent group not found')

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentGroupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to create spaces in this group")
  }

  const finalSlug = await uniqueStoredSpaceSlug(parentGroup.get('slug'), slug, name)
  const isPaywalled = Boolean(paywall)
  const spaceVisibility = isPaywalled
    ? Group.Visibility.PROTECTED
    : (visibility != null ? visibility : Group.Visibility.PROTECTED)
  const spaceAccessibility = isPaywalled
    ? Group.Accessibility.RESTRICTED
    : (accessibility != null ? accessibility : Group.Accessibility.RESTRICTED)

  const spaceStatus = status || Group.Status.PUBLISHED
  if (spaceStatus !== Group.Status.DRAFT && spaceStatus !== Group.Status.PUBLISHED) {
    throw new GraphQLError('New spaces can only be draft or published')
  }
  const addToParentMenu = spaceStatus === Group.Status.DRAFT ? false : addToMenu

  const space = new Group({
    type: 'space',
    // Start the cached count at zero — left unset it is NULL, and the join-path
    // increment (NULL + 1) can never bring it back
    num_members: 0,
    num_open_join_requests: 0,
    parent_id: parentGroupId,
    name: name.trim(),
    slug: finalSlug,
    description,
    icon: icon || null,
    accepted_post_types: acceptedPostTypes,
    required_roles: isPaywalled ? null : requiredRoles,
    purpose,
    location,
    location_id: locationId,
    banner_url: bannerUrl,
    avatar_url: avatarUrl,
    visibility: spaceVisibility,
    accessibility: spaceAccessibility,
    paywall: isPaywalled,
    status: spaceStatus,
    settings: {},
    access_code: await Group.getNewAccessCode(),
    calendar_token: uuidv4(),
    created_at: new Date(),
    created_by_id: userId
  })

  await bookshelf.transaction(async trx => {
    await space.save(null, { transacting: trx })
    // No setupSystemRoles / assignCoordinator — spaces inherit roles from the parent
    await space.addMembers([userId], { lastReadAt: new Date() }, { transacting: trx })
    await Group.setupSpaceViews(space.id, acceptedPostTypes, viewTypes, { transacting: trx })

    // Add a `type = 'space'` menu entry to the parent group's view list (spec section 2.5).
    // When addToMenu is false (Add Space from More Spaces), create off-menu (order = null).
    const spaceViewAttrs = {
      group_id: parentGroupId,
      type: GroupView.Type.SPACE,
      linked_group_id: space.id,
      name: name.trim()
    }
    if (addToParentMenu === false) {
      await GroupView.createOffMenu(spaceViewAttrs, { transacting: trx })
    } else {
      await GroupView.appendToMenu(spaceViewAttrs, { transacting: trx })
    }
  }).catch(err => {
    throw new GraphQLError(`Creation of space failed: ${err.message}`)
  })

  notifyGroupUpdated(context, parentGroup, parentGroupId)

  // Refresh so home_route (set by setupSpaceViews) is included in the response
  return space.refresh()
}

export async function updateSpace (userId, { id, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles, location, locationId, purpose, bannerUrl, avatarUrl, paywall, status }, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  const space = await requireSpaceManager(userId, id, 'update this space')

  const changes = {}
  if (name !== undefined && name.trim()) changes.name = name.trim()
  if (slug !== undefined) {
    const parent = await Group.find(space.get('parent_id'))
    const parentSlug = parent?.get('slug')
    const localSlug = localSpaceSlug(parentSlug, slug)
    if (!Group.isSlugValid(localSlug)) throw new GraphQLError('Slug is invalid')
    const prefixed = storedSpaceSlug(parentSlug, localSlug)
    if (prefixed !== space.get('slug')) {
      changes.slug = await uniqueSlug(prefixed)
    }
  }
  if (acceptedPostTypes !== undefined) changes.accepted_post_types = acceptedPostTypes
  if (visibility !== undefined) changes.visibility = visibility
  if (accessibility !== undefined) changes.accessibility = accessibility
  if (description !== undefined) changes.description = description
  if (purpose !== undefined) changes.purpose = purpose
  if (requiredRoles !== undefined) changes.required_roles = requiredRoles
  if (location !== undefined) changes.location = location
  if (locationId !== undefined) changes.location_id = locationId
  if (icon !== undefined) changes.icon = icon || null
  if (bannerUrl !== undefined) changes.banner_url = bannerUrl
  if (avatarUrl !== undefined) changes.avatar_url = avatarUrl
  if (paywall !== undefined) {
    changes.paywall = Boolean(paywall)
    if (changes.paywall) {
      changes.visibility = Group.Visibility.PROTECTED
      changes.accessibility = Group.Accessibility.RESTRICTED
      changes.required_roles = null
    }
  }
  if (status !== undefined) {
    const allowed = space.get('funding_round_id')
      ? Object.values(Group.Status)
      : [Group.Status.DRAFT, Group.Status.PUBLISHED, Group.Status.ARCHIVED]
    if (!allowed.includes(status)) {
      throw new GraphQLError('Invalid status for this space')
    }
    changes.status = status
  }

  if (Object.keys(changes).length > 0) {
    await space.save(changes, { patch: true })
  }

  if (changes.name) {
    await syncSpaceMenuViewName(id, changes.name)
  }

  if (status === Group.Status.DRAFT || status === Group.Status.ARCHIVED) {
    await removeSpaceFromParentMenu(id)
  }

  const parentId = space.get('parent_id')
  if (parentId) {
    const parentGroup = await Group.find(parentId)
    notifyGroupUpdated(context, parentGroup, parentId)
  }

  return space.refresh()
}

/** Keep the parent menu's type=space row name in sync with the space Group. */
async function syncSpaceMenuViewName (spaceId, name, { transacting } = {}) {
  if (!name) return
  const query = bookshelf.knex('group_views')
    .where({ type: GroupView.Type.SPACE, linked_group_id: spaceId })
    .update({ name, updated_at: new Date() })
  if (transacting) query.transacting(transacting)
  await query
}

/** Destroy the parent group's type=space menu row for this space. */
async function removeSpaceFromParentMenu (spaceId, { transacting } = {}) {
  const menuEntry = await GroupView.where({ type: GroupView.Type.SPACE, linked_group_id: spaceId }).fetch({ transacting })
  if (!menuEntry) return
  const parentGroupId = menuEntry.get('group_id')
  await menuEntry.destroy({ transacting })
  await GroupView.syncMenuViewCount(parentGroupId, { transacting })
}

export async function archiveSpace (userId, id, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  const space = await requireSpaceManager(userId, id, 'archive this space')
  const parentId = space.get('parent_id')

  await bookshelf.transaction(async trx => {
    await space.save({ status: Group.Status.ARCHIVED }, { patch: true, transacting: trx })
    await removeSpaceFromParentMenu(id, { transacting: trx })
  })

  if (parentId) {
    const parentGroup = await Group.find(parentId)
    notifyGroupUpdated(context, parentGroup, parentId)
  }

  return space.refresh()
}

export async function deleteSpace (userId, id, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  // Include inactive so already-deleted leftovers can be re-saved as inactive.
  const space = await requireSpaceManager(userId, id, 'delete this space', { includeInactive: true })
  const parentId = space.get('parent_id')

  await bookshelf.transaction(async trx => {
    await space.save({ active: false }, { patch: true, transacting: trx })
    await removeSpaceFromParentMenu(id, { transacting: trx })
  })

  if (parentId) {
    const parentGroup = await Group.find(parentId)
    notifyGroupUpdated(context, parentGroup, parentId)
  }

  return { success: true }
}

/** Turn the parent's type=space menu row into a group item, or delete it if off-menu. */
async function convertSpaceViewToChildGroupView (spaceId, groupName, { transacting } = {}) {
  const menuEntry = await GroupView.where({ type: GroupView.Type.SPACE, linked_group_id: spaceId }).fetch({ transacting })
  if (!menuEntry) return
  if (menuEntry.get('order') != null) {
    await menuEntry.save({
      type: GroupView.Type.GROUP,
      name: menuEntry.get('name') || groupName || null
    }, { patch: true, transacting })
    return
  }
  const parentGroupId = menuEntry.get('group_id')
  await menuEntry.destroy({ transacting })
  await GroupView.syncMenuViewCount(parentGroupId, { transacting })
}

/** Remove a former space from the parent's space-collection settings.spaceIds lists. */
async function removeFromParentSpaceCollections (spaceId, parentId, { transacting } = {}) {
  const collections = await GroupView.query(q => {
    q.where({ group_id: parentId, type: GroupView.Type.SPACE_COLLECTION })
  }).fetchAll({ transacting })
  for (const view of collections.models) {
    const settings = view.get('settings') || {}
    const spaceIds = settings.spaceIds
    if (!Array.isArray(spaceIds)) continue
    const next = spaceIds.filter(id => String(id) !== String(spaceId))
    if (next.length === spaceIds.length) continue
    await view.save({ settings: { ...settings, spaceIds: next } }, { patch: true, transacting })
  }
}

/**
 * Add parent-group stewards to the new child group and copy their system
 * steward roles (Coordinator, Moderator, Host) by name.
 */
async function copyParentStewardsToChild (parentGroup, child, { transacting } = {}) {
  await GroupRole.setupSystemRoles(child.id, { transacting })

  const parentSystemRoles = await GroupRole.query(q => {
    q.where({ group_id: parentGroup.id, type: GroupRole.TYPE_SYSTEM, active: true })
  }).fetchAll({ transacting })
  if (parentSystemRoles.length === 0) return

  const assignments = await MemberGroupRole.query(q => {
    q.where({ group_id: parentGroup.id, active: true })
    q.whereIn('group_role_id', parentSystemRoles.map(role => role.id))
  }).fetchAll({ transacting })
  const stewardIds = [...new Set(assignments.models.map(assignment => assignment.get('user_id')))]
  if (stewardIds.length === 0) return

  // addMembers → updateMembers resets showJoinForm for existing members, which
  // would pop Jump In for the converter. Only add people who are not members yet,
  // and skip the join form — they are being made stewards, not joining as newcomers.
  const existingMemberships = await child.memberships(true)
    .query(q => q.whereIn('user_id', stewardIds))
    .fetch({ transacting })
  const existingUserIds = new Set(existingMemberships.map(membership => String(membership.get('user_id'))))
  const newStewardIds = stewardIds.filter(id => !existingUserIds.has(String(id)))
  if (newStewardIds.length > 0) {
    await child.addMembers(newStewardIds, {
      lastReadAt: new Date(),
      settings: {
        showJoinForm: false,
        agreementsAcceptedAt: new Date(),
        joinQuestionsAnsweredAt: new Date()
      }
    }, { transacting })
  }

  const childRoleByName = {}
  for (const roleDef of GroupRole.SYSTEM_ROLES) {
    const role = await GroupRole.findSystemRole(child.id, roleDef.name, { transacting })
    if (role) childRoleByName[roleDef.name] = role
  }

  const parentRoleIdToName = {}
  parentSystemRoles.forEach(role => {
    parentRoleIdToName[String(role.id)] = role.get('name')
  })

  for (const assignment of assignments.models) {
    const roleName = parentRoleIdToName[String(assignment.get('group_role_id'))]
    const childRole = roleName && childRoleByName[roleName]
    if (!childRole) continue

    const exists = await MemberGroupRole.where({
      user_id: assignment.get('user_id'),
      group_id: child.id,
      group_role_id: childRole.id
    }).fetch({ transacting })
    if (exists) continue

    await MemberGroupRole.forge({
      user_id: assignment.get('user_id'),
      group_id: child.id,
      group_role_id: childRole.id,
      active: true
    }).save(null, { transacting })
  }
}

/**
 * Convert a regular space into a child group of its parent.
 * Clears type/parent_id, creates a parent-child relationship, and
 * turns an on-menu space view into a group view (or deletes an off-menu one).
 */
export async function convertSpaceToChildGroup (userId, id, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  const space = await requireSpaceManager(userId, id, 'convert this space')
  if (space.get('track_id') || space.get('funding_round_id')) {
    throw new GraphQLError('Track and funding round spaces cannot be converted to child groups')
  }

  const parentId = space.get('parent_id')
  const parentGroup = await Group.find(parentId)
  if (!parentGroup) throw new GraphQLError('Parent group not found')

  const requiredRoles = space.get('required_roles')
  const isRoleGated = Array.isArray(requiredRoles) && requiredRoles.length > 0
  const visibilityAndAccess = isRoleGated
    ? { visibility: Group.Visibility.HIDDEN, accessibility: Group.Accessibility.CLOSED, required_roles: null }
    : { visibility: Group.Visibility.PROTECTED }

  await bookshelf.transaction(async trx => {
    // Clear type/parent_id before assigning roles — spaces inherit roles via parent_id.
    // Use knex so nulls are written (Bookshelf patch can skip them).
    await bookshelf.knex('groups')
      .where({ id: space.id })
      .update({
        type: null,
        parent_id: null,
        ...visibilityAndAccess,
        updated_at: new Date()
      })
      .transacting(trx)
    await space.refresh({ transacting: trx })
    await parentGroup.addChild(space, { transacting: trx })
    await copyParentStewardsToChild(parentGroup, space, { transacting: trx })
    await convertSpaceViewToChildGroupView(id, space.get('name'), { transacting: trx })
    await removeFromParentSpaceCollections(id, parentId, { transacting: trx })
  })

  notifyGroupUpdated(context, parentGroup, parentId)
  notifyGroupUpdated(context, space, space.id)
  return space.refresh()
}

/** Turn the parent's type=group menu row into a space item, or create an off-menu space view. */
async function convertChildGroupViewToSpaceView (parentId, childId, groupName, { transacting } = {}) {
  const groupViews = await GroupView.where({
    group_id: parentId,
    linked_group_id: childId,
    type: GroupView.Type.GROUP
  }).fetchAll({ transacting })

  if (groupViews.length > 0) {
    for (const view of groupViews.models) {
      await view.save({
        type: GroupView.Type.SPACE,
        name: view.get('name') || groupName || null
      }, { patch: true, transacting })
    }
    return
  }

  const existingSpace = await GroupView.where({
    type: GroupView.Type.SPACE,
    linked_group_id: childId
  }).fetch({ transacting })
  if (existingSpace) return

  await GroupView.createOffMenu({
    group_id: parentId,
    type: GroupView.Type.SPACE,
    linked_group_id: childId,
    name: groupName || null
  }, { transacting })
}

/**
 * Convert a child group with exactly one parent into a space of that parent.
 * Sets type/parent_id, deactivates the relationship, and turns a parent menu
 * group view into a space view (or creates an off-menu space view).
 */
export async function convertGroupToSpace (userId, { id, parentGroupId }, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')
  if (!parentGroupId) throw new GraphQLError('No parentGroupId passed into function')

  const group = await Group.findActive(id)
  if (!group) throw new GraphQLError('Group not found')
  if (group.get('type') === 'space' || group.get('parent_id')) {
    throw new GraphQLError('This group is already a space')
  }
  if (group.get('type')) {
    throw new GraphQLError('Only default groups can be converted to spaces')
  }
  if (group.get('track_id') || group.get('funding_round_id')) {
    throw new GraphQLError('Track and funding round groups cannot be converted to spaces')
  }

  const parentResponsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentGroupId)
  if (!parentResponsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to create spaces in this group")
  }
  const childResponsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, id)
  if (!childResponsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to convert this group")
  }

  const parentRels = await GroupRelationship.where({
    child_group_id: id,
    active: true,
    relationship_type: Group.RelationshipType.PARENT_CHILD
  }).fetchAll()

  if (parentRels.length !== 1) {
    throw new GraphQLError('Group must have exactly one parent to convert to a space')
  }
  const relationship = parentRels.models[0]
  if (String(relationship.get('parent_group_id')) !== String(parentGroupId)) {
    throw new GraphQLError('parentGroupId does not match the group\'s parent')
  }

  const childCount = await GroupRelationship.where({
    parent_group_id: id,
    active: true,
    relationship_type: Group.RelationshipType.PARENT_CHILD
  }).count()
  const peerCount = await GroupRelationship.query(q => {
    q.where({ active: true, relationship_type: Group.RelationshipType.PEER_TO_PEER })
      .where(function () {
        this.where('parent_group_id', id).orWhere('child_group_id', id)
      })
  }).count()
  if (Number(childCount) > 0 || Number(peerCount) > 0) {
    throw new GraphQLError('Cannot convert a group that has child or peer groups to a space')
  }

  const parentGroup = await Group.findActive(parentGroupId)
  if (!parentGroup) throw new GraphQLError('Parent group not found')
  if (parentGroup.get('type') === 'space') {
    throw new GraphQLError('Cannot convert a group into a space of another space')
  }

  await bookshelf.transaction(async trx => {
    await group.save({ type: 'space', parent_id: parentGroupId }, { patch: true, transacting: trx })
    await relationship.save({ active: false }, { transacting: trx })
    await convertChildGroupViewToSpaceView(parentGroupId, id, group.get('name'), { transacting: trx })
  })

  notifyGroupUpdated(context, parentGroup, parentGroupId)
  notifyGroupUpdated(context, group, group.id)
  return group.refresh()
}

/**
 * Join a space. Parent-group Administration can join any space. A valid
 * accessCode or invitationToken pre-approves Closed, Restricted, and role-gated
 * spaces. Paywalled spaces still require purchase unless the user administers
 * the parent.
 * @param userId {string}
 * @param spaceId {string}
 * @param accessCode {string} optional join-link access code
 * @param invitationToken {string} optional email-invite token
 */
export async function joinSpace (userId, spaceId, accessCode, invitationToken) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!spaceId) throw new GraphQLError('No spaceId passed into function')

  const user = await User.find(userId)
  if (!user) throw new GraphQLError('User not found')

  const space = await Group.findActive(spaceId)
  if (!space || space.get('type') !== 'space') throw new GraphQLError('Space not found')

  const existingMembership = await GroupMembership.forPair(userId, spaceId).fetch()
  let membership = existingMembership
  let hasValidInvitation = false

  if (!existingMembership) {
    const parentId = space.get('parent_id')
    const parentMembership = parentId && await GroupMembership.forPair(userId, parentId).fetch()
    if (!parentMembership) {
      throw new GraphQLError('You must be a member of the parent group to join this space')
    }

    // Administration on the parent can join any space (closed, restricted, role-gated, paywalled)
    // without requesting or holding a required role
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentId)
    const canAdministerParent = responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)

    const spaceStatus = space.get('status')
    if (spaceStatus === Group.Status.ARCHIVED) {
      throw new GraphQLError('This space is archived')
    }
    if (spaceStatus === Group.Status.DRAFT && !canAdministerParent) {
      throw new GraphQLError('This space is not published')
    }

    // Join/invite links pre-approve Closed, Restricted, and role-gated spaces (same as joinGroup)
    let inviteCheck = null
    if (accessCode || invitationToken) {
      inviteCheck = await InvitationService.check(invitationToken, accessCode)
    }
    hasValidInvitation = !!(inviteCheck?.valid && inviteCheck.groupSlug === space.get('slug'))

    if (!canAdministerParent) {
      if (space.get('paywall')) {
        throw new GraphQLError('This space requires purchased access to join')
      }

      if (!hasValidInvitation) {
        const requiredRoles = space.get('required_roles')
        const isRoleGated = Array.isArray(requiredRoles) && requiredRoles.length > 0

        if (isRoleGated) {
          const memberRoleIds = await bookshelf.knex('group_memberships_group_roles')
            .where({ user_id: userId, group_id: parentId, active: true })
            .pluck('group_role_id')
          const memberRoleIdSet = new Set(memberRoleIds.map(id => String(id)))
          if (!requiredRoles.some(roleId => memberRoleIdSet.has(String(roleId)))) {
            throw new GraphQLError('You do not have the required role to join this space')
          }
        } else if (space.get('accessibility') !== Group.Accessibility.OPEN) {
          throw new GraphQLError('This space requires a request to join')
        }
      }
    }

    membership = await user.joinGroup(space, { fromInvitation: hasValidInvitation })
  }

  if (invitationToken) {
    const invitation = await Invitation.find(invitationToken)
    if (invitation && String(invitation.get('group_id')) === String(spaceId)) {
      await invitation.use(userId)
    }
  }

  // Create per-view unread rows for every existing view in the space (spec section 2.6).
  // Chat starts at the latest chat post so joining does not dump people at the oldest message.
  const views = await GroupView.findForGroup(spaceId)
  for (const view of views.models) {
    if (view.get('type') === 'chat') {
      await GroupViewUser.markRead(view.id, userId)
    } else {
      await GroupViewUser.findOrCreate(view.id, userId)
    }
  }

  return membership
}
