import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import {
  publishGroupUpdate
} from '../../../lib/groupSubscriptionPublisher'
import { publishAsync } from '../../../lib/subscriptionUtils'
import { groupRoom, pushToSockets } from '../../services/Websockets'

// Space mutations — see docs/spaces-and-views-engineering-spec.md section 4.4 / 10

function notifyGroupUpdated (context, group, groupId) {
  pushToSockets(groupRoom(groupId), 'groupUpdated', { groupId })
  publishAsync(publishGroupUpdate, context, group, group)
}

function slugify (name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'space'
}

async function uniqueSlug (baseSlug) {
  let slug = baseSlug
  let suffix = 2
  while (await Group.where({ slug }).fetch()) {
    slug = `${baseSlug}-${suffix}`.slice(0, 40)
    suffix += 1
  }
  return slug
}

async function requireStewardOfGroup (userId, groupId, action) {
  const group = await Group.findActive(groupId)
  if (!group) throw new GraphQLError('Space not found')

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError(`You don't have permission to ${action}`)
  }
  return group
}

export async function createSpace (userId, { parentGroupId, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles }, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!parentGroupId) throw new GraphQLError('No parentGroupId passed into function')
  if (!name || !name.trim()) throw new GraphQLError('Name cannot be blank')

  const parentGroup = await Group.findActive(parentGroupId)
  if (!parentGroup) throw new GraphQLError('Parent group not found')

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentGroupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_MANAGE_SPACES)) {
    throw new GraphQLError("You don't have permission to create spaces in this group")
  }

  const finalSlug = await uniqueSlug(slug && Group.isSlugValid(slug) ? slug : slugify(name))

  const space = new Group({
    type: 'space',
    parent_id: parentGroupId,
    name: name.trim(),
    slug: finalSlug,
    description,
    accepted_post_types: acceptedPostTypes,
    required_roles: requiredRoles,
    visibility: visibility != null ? visibility : Group.Visibility.PROTECTED,
    accessibility: accessibility != null ? accessibility : Group.Accessibility.RESTRICTED,
    settings: icon ? { icon } : {},
    access_code: await Group.getNewAccessCode(),
    calendar_token: uuidv4(),
    created_at: new Date(),
    created_by_id: userId
  })

  await bookshelf.transaction(async trx => {
    await space.save(null, { transacting: trx })
    await GroupRole.setupSystemRoles(space.id, { transacting: trx })
    await space.addMembers([userId], { assignCoordinator: true, lastReadAt: new Date() }, { transacting: trx })
    await Group.setupSpaceViews(space.id, acceptedPostTypes, { transacting: trx })

    // Add a `type = 'space'` menu entry to the parent group's view list (spec section 2.5)
    await GroupView.appendToMenu({
      group_id: parentGroupId,
      type: GroupView.Type.SPACE,
      linked_group_id: space.id
    }, { transacting: trx })
  }).catch(err => {
    throw new GraphQLError(`Creation of space failed: ${err.message}`)
  })

  notifyGroupUpdated(context, parentGroup, parentGroupId)

  return space
}

export async function updateSpace (userId, { id, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles, location, locationId }, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  const space = await requireStewardOfGroup(userId, id, 'update this space')

  const changes = {}
  if (name !== undefined && name.trim()) changes.name = name.trim()
  if (slug !== undefined && slug !== space.get('slug')) {
    if (!Group.isSlugValid(slug)) throw new GraphQLError('Slug is invalid')
    changes.slug = await uniqueSlug(slug)
  }
  if (acceptedPostTypes !== undefined) changes.accepted_post_types = acceptedPostTypes
  if (visibility !== undefined) changes.visibility = visibility
  if (accessibility !== undefined) changes.accessibility = accessibility
  if (description !== undefined) changes.description = description
  if (requiredRoles !== undefined) changes.required_roles = requiredRoles
  if (location !== undefined) changes.location = location
  if (locationId !== undefined) changes.location_id = locationId

  await space.save(changes, { patch: true })
  if (icon !== undefined) {
    await space.addSetting({ icon }, true)
  }

  const parentId = space.get('parent_id')
  if (parentId) {
    const parentGroup = await Group.find(parentId)
    notifyGroupUpdated(context, parentGroup, parentId)
  }

  return space.refresh()
}

export async function archiveSpace (userId, id, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  const space = await requireStewardOfGroup(userId, id, 'archive this space')
  const parentId = space.get('parent_id')

  await bookshelf.transaction(async trx => {
    await space.save({ active: false }, { patch: true, transacting: trx })

    if (parentId) {
      const menuEntry = await GroupView.where({ type: GroupView.Type.SPACE, linked_group_id: id }).fetch({ transacting: trx })
      if (menuEntry) await menuEntry.destroy({ transacting: trx })
    }
  })

  if (parentId) {
    const parentGroup = await Group.find(parentId)
    notifyGroupUpdated(context, parentGroup, parentId)
  }

  return space
}

export async function deleteSpace (userId, id, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  const space = await requireStewardOfGroup(userId, id, 'delete this space')
  const parentId = space.get('parent_id')

  await bookshelf.transaction(async trx => {
    await space.save({ active: false }, { patch: true, transacting: trx })
    await space.removeMembers(await space.members().fetch({ transacting: trx }), { transacting: trx })

    if (parentId) {
      const menuEntry = await GroupView.where({ type: GroupView.Type.SPACE, linked_group_id: id }).fetch({ transacting: trx })
      if (menuEntry) await menuEntry.destroy({ transacting: trx })
    }
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

  if (space.get('accessibility') !== Group.Accessibility.OPEN) {
    throw new GraphQLError('This space requires a request to join')
  }

  const requiredRoles = space.get('required_roles')
  if (requiredRoles && requiredRoles.length > 0) {
    const memberRoleIds = await bookshelf.knex('group_memberships_group_roles')
      .where({ user_id: userId, group_id: parentId, active: true })
      .pluck('group_role_id')
    if (!requiredRoles.some(roleId => memberRoleIds.includes(roleId))) {
      throw new GraphQLError('You do not have the required role to join this space')
    }
  }

  const membership = await user.joinGroup(space, {})

  // Create per-view unread rows for every existing view in the space (spec section 2.6)
  const views = await GroupView.findForGroup(spaceId)
  for (const view of views.models) {
    await GroupViewUser.findOrCreate(view.id, userId)
  }

  return membership
}

export async function leaveSpace (userId, spaceId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!spaceId) throw new GraphQLError('No spaceId passed into function')

  const space = await Group.find(spaceId)
  if (!space) throw new GraphQLError('Space not found')

  const user = await User.find(userId)
  if (!user) throw new GraphQLError('User not found')

  await user.leaveGroup(space)

  return { success: true }
}
