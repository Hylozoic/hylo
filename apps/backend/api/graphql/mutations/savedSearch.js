import { GraphQLError } from 'graphql'

/**
 * Creates a saved search owned by the authenticated user.
 * Ignores any client-supplied userId to prevent attribution spoofing.
 */
export function createSavedSearch (userId, attributes) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  return SavedSearch.create({ ...attributes, userId })
}

/**
 * Soft-deletes a saved search after verifying the caller owns it.
 */
export async function deleteSavedSearch (userId, id) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No id passed into function')

  const savedSearch = await SavedSearch.where({ id }).fetch({ require: false })
  if (!savedSearch) throw new GraphQLError('Saved search not found')

  if (String(savedSearch.get('user_id')) !== String(userId)) {
    throw new GraphQLError("You don't have permission to delete this saved search")
  }

  return SavedSearch.delete(id)
}
