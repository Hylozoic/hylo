import { GraphQLError } from 'graphql'
import validator from 'validator'

export function formatUrl (url = '') {
  const prefixRegex = /https?:\/\//gi
  if (!prefixRegex.test(url)) {
    url = 'https://' + url
  }
  return url
}

async function findOwnedProfileLink (userId, profileLinkId) {
  const profileLink = await UserProfileLink.find(profileLinkId)
  if (!profileLink || String(profileLink.get('user_id')) !== String(userId)) return null
  return profileLink
}

export async function createUserProfileLink (userId, { url, title }) {
  if (!url) throw new GraphQLError('URL is required')
  if (!validator.isURL(formatUrl(url))) throw new GraphQLError('Please enter a valid URL.')

  return UserProfileLink.create({
    userId,
    url: formatUrl(url),
    title: title || null
  })
}

export async function updateUserProfileLink (userId, id, { url, title }) {
  const profileLink = await findOwnedProfileLink(userId, id)
  if (!profileLink) throw new GraphQLError('Profile link not found')
  if (!url) throw new GraphQLError('URL is required')
  if (!validator.isURL(formatUrl(url))) throw new GraphQLError('Please enter a valid URL.')

  await profileLink.save({
    url: formatUrl(url),
    title: title || null,
    updated_at: new Date()
  }, { patch: true })

  return profileLink
}

export async function deleteUserProfileLink (userId, id) {
  const profileLink = await findOwnedProfileLink(userId, id)
  if (!profileLink) throw new GraphQLError('Profile link not found')
  return UserProfileLink.delete(id)
}

// Rewrite sort_order for every profile link the user owns, in the given order.
export async function reorderUserProfileLinks (userId, ids) {
  if (!Array.isArray(ids)) throw new GraphQLError('Profile link ids are required')

  const requestedIds = ids.map(id => String(id))
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new GraphQLError('Profile link ids do not match your links')
  }

  const owned = await UserProfileLink.where({ user_id: userId }).fetchAll()
  const ownedIds = new Set(owned.models.map(link => String(link.id)))
  if (requestedIds.some(id => !ownedIds.has(id))) {
    throw new GraphQLError('Profile link not found')
  }
  if (requestedIds.length !== owned.models.length) {
    throw new GraphQLError('Profile link ids do not match your links')
  }

  await bookshelf.transaction(async transacting => {
    for (let index = 0; index < requestedIds.length; index++) {
      await bookshelf.knex('user_profile_links')
        .transacting(transacting)
        .where({ id: requestedIds[index], user_id: userId })
        .update({ sort_order: index, updated_at: new Date() })
    }
  })

  const reordered = await UserProfileLink.findByUser(userId)
  return reordered.models
}
