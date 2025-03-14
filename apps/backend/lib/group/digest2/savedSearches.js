import { merge, pick } from 'lodash/fp'
import { pluralize } from '../../util/normalize'
import { sendToUser } from '../digest2'

const prepareDigestData = async (searchId) => {
  const search = await SavedSearch.where({ id: searchId }).fetch()
  const context = search.get('context')
  let group, membership
  const user = await User.where({ id: search.get('user_id') }).fetch()
  if (context === 'groups') {
    group = await search.group()
    membership = await GroupMembership.forPair(user, group)
  }
  const lastPostId = parseInt(search.get('last_post_id'))
  const data = {
    context,
    group_name: group && group.get('name'),
    lastPostId,
    membership,
    search,
    user
  }
  const posts = await search.newPosts()
  const promises = posts
    ? posts.models.map(async (p) => {
      const key = pluralize(p.get('type'))
      const presented = p.presentForEmail({ context, group })
      data[key] = data[key] || []
      data[key].push(presented)
      data.lastPostId = Math.max(data.lastPostId, parseInt(p.id))
      return data
    })
    : []
  await Promise.all(promises)
  return data
}

const shouldSendData = (data, membership, type) => {
  const postTypes = ['requests', 'offers', 'events', 'discussions', 'projects', 'resources']
  const hasNewPosts = Object.keys(pick(postTypes, data)).some(s => postTypes.includes(s))
  // TODO: fix non group based saves search digests
  const userSettingMatchesType = membership && membership.getSetting('digestFrequency') === type
  return hasNewPosts && userSettingMatchesType
}

const sendDigest = async (searchId, type) => {
  return await prepareDigestData(searchId).then(async data => {
    const { lastPostId, membership, user } = data
    if (shouldSendData(data, membership, type)) return merge(await sendToUser(user, type, data), { lastPostId })
  })
    .then(async (sent = {}) => {
      const { lastPostId, success } = sent
      if (success) {
        const search = await SavedSearch.where({ id: searchId }).fetch()
        return await search.updateLastPost(searchId, lastPostId)
      }
    })
}

export const sendAllDigests = async (type) => {
  const savedSearches = await SavedSearch.where({ is_active: true }).query()
  const promises = savedSearches.map(s => sendDigest(s.id, type))
  await Promise.all(promises)
}
