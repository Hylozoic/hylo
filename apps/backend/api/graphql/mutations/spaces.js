import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import { localSpaceSlug, storedSpaceSlug } from '@hylo/navigation'
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
      linked_group_id: space.id
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

export async function joinSpace (userId, spaceId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!spaceId) throw new GraphQLError('No spaceId passed into function')

  const user = await User.find(userId)
  if (!user) throw new GraphQLError('User not found')

  const space = await Group.findActive(spaceId)
  if (!space || space.get('type') !== 'space') throw new GraphQLError('Space not found')

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

  if (!canAdministerParent) {
    if (space.get('paywall')) {
      throw new GraphQLError('This space requires purchased access to join')
    }

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

  const membership = await user.joinGroup(space, {})

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
