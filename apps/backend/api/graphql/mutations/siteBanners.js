import { GraphQLError } from 'graphql'

const VALID_TYPES = ['info', 'warning', 'alert']

// Adds a scheme to bare hosts (e.g. "hylo.com/x" -> "https://hylo.com/x") and
// rejects anything that isn't a safe http(s) or root-relative destination, so
// a stored value like "javascript:" can never reach the client's action button.
function normalizeAndValidateActionUrl (url) {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/')) return trimmed

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed
  try {
    parsed = new URL(withScheme)
  } catch (e) {
    throw new GraphQLError('Action Button URL is not valid')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new GraphQLError('Action Button URL must be a web address')
  }

  return parsed.toString()
}

function whitelistData (data = {}) {
  const whitelist = {}
  if ('title' in data) whitelist.title = data.title || null
  if ('text' in data) whitelist.text = data.text
  if ('type' in data) whitelist.type = VALID_TYPES.includes(data.type) ? data.type : 'info'
  if ('actionText' in data) whitelist.action_text = data.actionText || null
  if ('actionUrl' in data) whitelist.action_url = normalizeAndValidateActionUrl(data.actionUrl)

  if (!!whitelist.action_text !== !!whitelist.action_url) {
    throw new GraphQLError('Action Button Text and Action Button URL must be set together')
  }

  return whitelist
}

export async function createSiteBanner (adminUserId, data) {
  if (!(await Admin.isSuperAdmin(adminUserId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  const attrs = { ...whitelistData(data), created_by_id: adminUserId }
  return SiteBanner.forge(attrs).save()
}

export async function updateSiteBanner (adminUserId, id, data) {
  if (!(await Admin.isSuperAdmin(adminUserId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  const banner = await SiteBanner.find(id)
  if (!banner) throw new GraphQLError('Site banner not found')

  return banner.save(whitelistData(data))
}

export async function publishSiteBanner (adminUserId, id) {
  if (!(await Admin.isSuperAdmin(adminUserId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  const banner = await SiteBanner.find(id)
  if (!banner) throw new GraphQLError('Site banner not found')

  return banner.save({ published_at: new Date(), unpublished_at: null })
}

export async function unpublishSiteBanner (adminUserId, id) {
  if (!(await Admin.isSuperAdmin(adminUserId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  const banner = await SiteBanner.find(id)
  if (!banner) throw new GraphQLError('Site banner not found')

  return banner.save({ unpublished_at: new Date() })
}

export async function deleteSiteBanner (adminUserId, id) {
  if (!(await Admin.isSuperAdmin(adminUserId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  const banner = await SiteBanner.find(id)
  if (!banner) throw new GraphQLError('Site banner not found')
  if (banner.get('published_at')) {
    throw new GraphQLError('Cannot delete a banner that has already been published; take it down instead')
  }

  await banner.destroy()
  return true
}

export async function dismissSiteBanner (userId, id) {
  if (!userId) throw new GraphQLError('You must be logged in to dismiss a banner')

  await SiteBanner.dismiss(id, userId)
  return true
}
