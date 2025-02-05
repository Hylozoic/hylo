import { GraphQLError } from 'graphql'
import { pick } from 'lodash'
import { uniq } from 'lodash/fp'
import { personFilter } from '../../graphql/filters'

export function findThread (userIds) {
  return Post.havingExactFollowers(userIds)
    .query(q => q.where('posts_users.following', true).where({ type: Post.Type.THREAD }))
    .fetch()
}

export default async function findOrCreateThread (userId, providedParticipantIds, skipValidation = false) {
  const participantIds = uniq(providedParticipantIds)
  const post = await findThread(uniq([userId].concat(participantIds)))
  if (post) return post
  if (skipValidation || await validateThreadData(userId, participantIds)) {
    return createThread(userId, participantIds)
  }
}

export async function createThread (userId, participantIds) {
  const attrs = await setupNewThreadAttrs(userId)
  let post
  await bookshelf.transaction(async trx => {
    post = await Post.create(attrs, { transacting: trx })
    await afterSavingThread(post, { participantIds, transacting: trx })
  })
  return post
}

export async function validateThreadData (userId, participantIds) {
  if (userId === User.AXOLOTL_ID) {
    // Can always send a message from axolotl
    return true
  }

  if (!(participantIds && participantIds.length)) {
    throw new GraphQLError("participantIds can't be empty")
  }
  const validParticipantIds = await personFilter(userId)(User.where('id', 'in', participantIds)).fetchAll()

  if (validParticipantIds.length !== participantIds.length) {
    throw new GraphQLError("Cannot message a participant who doesn't share a group")
  }
  return true
}

function setupNewThreadAttrs (userId) {
  return Promise.resolve({
    type: Post.Type.THREAD,
    visibility: Post.Visibility.DEFAULT,
    user_id: userId,
    link_preview_id: null
  })
}

async function afterSavingThread (post, opts) {
  const userId = post.get('user_id')
  const participantIds = uniq([userId].concat(opts.participantIds))
  const trxOpts = pick(opts, 'transacting')

  const followers = await post.addFollowers(participantIds, {}, trxOpts)
  return followers
}
