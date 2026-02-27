/**
 * Application & Bot GraphQL Mutations
 *
 * Implements Developer Mode, OAuth application management, and bot support.
 */
import { GraphQLError } from 'graphql'

/**
 * Enable or disable developer mode for the current user
 */
export const updateDeveloperMode = async (_, { enabled }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const user = await User.find(currentUserId)
  if (!user) {
    throw new GraphQLError('User not found')
  }

  await user.addSetting({ developerModeEnabled: enabled }, true)

  return { success: true }
}

/**
 * Create a new OAuth application
 */
export const createApplication = async (_, { data }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const user = await User.find(currentUserId)
  if (!user) {
    throw new GraphQLError('User not found')
  }

  // Check if developer mode is enabled
  if (!user.getSetting('developerModeEnabled')) {
    throw new GraphQLError('Developer mode must be enabled to create applications')
  }

  const { name, description, redirectUris, scopes } = data

  if (!name || name.trim().length < 2) {
    throw new GraphQLError('Application name must be at least 2 characters')
  }

  const result = await Application.create({
    name: name.trim(),
    description: description || null,
    ownerId: currentUserId,
    redirectUris: redirectUris || [],
    scopes: scopes || ['openid', 'profile']
  })

  return {
    application: result.application,
    clientSecret: result.clientSecret
  }
}

/**
 * Update an existing application
 */
export const updateApplication = async (_, { id, changes }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const app = await Application.find(id)
  if (!app) {
    throw new GraphQLError('Application not found')
  }

  // Verify ownership
  if (app.get('owner_id') !== currentUserId) {
    throw new GraphQLError('Not authorized to update this application')
  }

  const updates = {}
  if (changes.name !== undefined) updates.name = changes.name.trim()
  if (changes.description !== undefined) updates.description = changes.description
  if (changes.iconUrl !== undefined) updates.icon_url = changes.iconUrl
  if (changes.redirectUris !== undefined) updates.redirect_uris = changes.redirectUris
  if (changes.scopes !== undefined) updates.scopes = changes.scopes

  await app.save(updates, { patch: true })

  return app
}

/**
 * Delete an application
 */
export const deleteApplication = async (_, { id }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const app = await Application.find(id)
  if (!app) {
    throw new GraphQLError('Application not found')
  }

  // Verify ownership
  if (app.get('owner_id') !== currentUserId) {
    throw new GraphQLError('Not authorized to delete this application')
  }

  // If app has a bot, deactivate the bot user
  const botUserId = app.get('bot_user_id')
  if (botUserId) {
    const bot = await User.find(botUserId)
    if (bot) {
      await bot.save({ active: false }, { patch: true })
    }
  }

  await app.destroy()

  return { success: true }
}

/**
 * Regenerate client secret for an application
 */
export const regenerateClientSecret = async (_, { applicationId }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const app = await Application.find(applicationId)
  if (!app) {
    throw new GraphQLError('Application not found')
  }

  // Verify ownership
  if (app.get('owner_id') !== currentUserId) {
    throw new GraphQLError('Not authorized to regenerate secret for this application')
  }

  const newSecret = await Application.regenerateSecret(applicationId)

  return newSecret
}

/**
 * Create a bot user for an application
 */
export const createBotForApplication = (fetchOne) => async (_, { applicationId }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const app = await Application.find(applicationId)
  if (!app) {
    throw new GraphQLError('Application not found')
  }

  // Verify ownership
  if (app.get('owner_id') !== currentUserId) {
    throw new GraphQLError('Not authorized to create bot for this application')
  }

  // Check if bot already exists
  if (app.get('bot_user_id')) {
    throw new GraphQLError('Application already has a bot')
  }

  const botName = `${app.get('name')} Bot`

  const bot = await User.createBot({
    name: botName,
    applicationId: app.id,
    ownerId: currentUserId
  })

  // Link bot to application
  await app.save({
    has_bot: true,
    bot_user_id: bot.id
  }, { patch: true })

  return fetchOne('Person', bot.id)
}

/**
 * Invite a bot to a group
 */
console.log("DEBUG: inviteBotToGroup resolver loaded"); export const inviteBotToGroup = async (_, { data }, { currentUserId }) => {
  console.log("inviteBotToGroup called:", { data, currentUserId })
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const { botUserId, groupId, permissions } = data

  // Verify the bot exists and is actually a bot
  const bot = await User.find(botUserId)
  if (!bot || !bot.get('is_bot')) {
    console.log('ERROR: Bot not found', { botUserId, bot: bot ? { id: bot.id, is_bot: bot.get('is_bot') } : null }); throw new GraphQLError('Bot not found')
  }

  // Verify the group exists
  const group = await Group.find(groupId)
  if (!group) {
    console.log('ERROR: Group not found', { groupId }); throw new GraphQLError('Group not found')
  }

  // Check if current user has admin permissions in the group
  const membership = await GroupMembership.forPair(currentUserId, groupId).fetch()
  if (!membership || membership.get('role') < GroupMembership.Role.MODERATOR) {
    console.log('ERROR: Not moderator', { currentUserId, groupId, membership: membership ? { role: membership.get('role') } : null }); throw new GraphQLError('Must be a group moderator to invite bots')
  }

  // Validate permissions
  const validPermissions = Application.BOT_PERMISSIONS
  const invalidPerms = permissions.filter(p => !validPermissions.includes(p))
  if (invalidPerms.length > 0) {
    throw new GraphQLError(`Invalid permissions: ${invalidPerms.join(', ')}`)
  }

  const bgp = await BotGroupPermission.inviteBot({
    botUserId,
    groupId,
    invitedById: currentUserId,
    permissions
  })

  return bgp
}

/**
 * Remove a bot from a group
 */
export const removeBotFromGroup = async (_, { botGroupPermissionId }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const bgp = await BotGroupPermission.find(botGroupPermissionId)
  if (!bgp) {
    throw new GraphQLError('Bot permission not found')
  }

  const groupId = bgp.get('group_id')

  // Check if current user has admin permissions in the group
  const membership = await GroupMembership.forPair(currentUserId, groupId).fetch()
  if (!membership || membership.get('role') < GroupMembership.Role.MODERATOR) {
    throw new GraphQLError('Must be a group moderator to remove bots')
  }

  await bgp.save({ is_active: false }, { patch: true })

  return { success: true }
}

/**
 * Update bot permissions in a group
 */
export const updateBotPermissions = async (_, { botGroupPermissionId, permissions }, { currentUserId }) => {
  if (!currentUserId) {
    console.log('ERROR: Not authorized - no currentUserId'); throw new GraphQLError('Not authorized')
  }

  const bgp = await BotGroupPermission.find(botGroupPermissionId)
  if (!bgp) {
    throw new GraphQLError('Bot permission not found')
  }

  const groupId = bgp.get('group_id')

  // Check if current user has admin permissions in the group
  const membership = await GroupMembership.forPair(currentUserId, groupId).fetch()
  if (!membership || membership.get('role') < GroupMembership.Role.MODERATOR) {
    throw new GraphQLError('Must be a group moderator to update bot permissions')
  }

  // Validate permissions
  const validPermissions = Application.BOT_PERMISSIONS
  const invalidPerms = permissions.filter(p => !validPermissions.includes(p))
  if (invalidPerms.length > 0) {
    throw new GraphQLError(`Invalid permissions: ${invalidPerms.join(', ')}`)
  }

  await bgp.save({ permissions }, { patch: true })

  return bgp
}

/**
 * Delete a bot for an application
 */
export const deleteBotForApplication = async (_, { applicationId }, { currentUserId }) => {
  if (!currentUserId) {
    throw new GraphQLError('Not authorized')
  }

  const app = await Application.find(applicationId)
  if (!app) {
    throw new GraphQLError('Application not found')
  }

  // Verify ownership
  if (app.get('owner_id') !== currentUserId) {
    throw new GraphQLError('Not authorized to delete bot for this application')
  }

  const botUserId = app.get('bot_user_id')
  if (!botUserId) {
    throw new GraphQLError('Application does not have a bot')
  }

  // Remove all bot group permissions
  await bookshelf.knex('bot_group_permissions')
    .where('bot_user_id', botUserId)
    .del()

  // Delete the bot user
  await bookshelf.knex('users')
    .where('id', botUserId)
    .del()

  // Unlink bot from application
  await app.save({
    has_bot: false,
    bot_user_id: null
  }, { patch: true })

  return { success: true }
}

/**
 * Update a bot's profile (name, avatar)
 */
export const updateBot = (fetchOne) => async (_, { botId, changes }, { currentUserId }) => {
  if (!currentUserId) {
    throw new GraphQLError('Not authorized')
  }

  // Find the bot
  const bot = await User.find(botId)
  if (!bot || !bot.get('is_bot')) {
    throw new GraphQLError('Bot not found')
  }

  // Find the application that owns this bot
  const app = await Application.where({ bot_user_id: botId }).fetch()
  if (!app) {
    throw new GraphQLError('Bot not associated with an application')
  }

  // Verify ownership
  if (app.get('owner_id') !== currentUserId) {
    throw new GraphQLError('Not authorized to update this bot')
  }

  const updates = {}
  if (changes.name !== undefined) {
    const name = changes.name.trim()
    if (name.length < 2) {
      throw new GraphQLError('Bot name must be at least 2 characters')
    }
    updates.name = name
  }
  if (changes.avatarUrl !== undefined) {
    updates.avatar_url = changes.avatarUrl
  }

  await bot.save(updates, { patch: true })

  return fetchOne('Person', botId)
}
