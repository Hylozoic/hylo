import { cloneDeep, flatten, merge, pick, uniq, values } from 'lodash'
import { includes, filter, get } from 'lodash/fp'
import { getLocaleStrings } from '../../i18n/locales'
import { aggregateChatRooms, shouldSendData } from './util'
import * as cheerio from 'cheerio'

const generateSubjectLine = (data, type, locale) => {
  const L = getLocaleStrings(locale)
  if (data.search) {
    // Saved search
    return L.newSavedSearchResults(data.search.get('name'))
  }

  if (type === 'daily') {
    return L.emailDigestDailySubject(data.group_name)
  }

  if (type === 'weekly') {
    return L.emailDigestWeeklySubject(data.group_name)
  }
}

const CONTENT_KEYS = [
  'discussions',
  'requests',
  'offers',
  'events',
  'projects',
  'resources',
  'proposals',
  'chats',
  'posts_with_new_comments',
  'upcoming',
  'ending'
]

const getPosts = data =>
  flatten(values(pick(data, 'requests', 'offers', 'resources', 'discussions', 'projects', 'events', 'proposals', 'posts_with_new_comments', 'upcoming', 'ending')))

const addParamsToLinks = (text, params) => {
  if (!text) return
  const doc = cheerio.load(text, { decodeEntities: false }, false)
  const links = doc('a[href]')
  if (links.length === 0) return text
  links.each((i, el) => {
    const a = doc(el)
    const href = a.attr('href')
    if (href && href.startsWith(Frontend.Route.prefix)) {
      a.attr('href', Frontend.appendQueryString(href, params))
    }
  })
  return doc.html()
}

const memberSpaceIdSet = async (userId, items) => {
  const spaceIds = uniq(items.map(item => item?.space_id).filter(Boolean))
  if (spaceIds.length === 0) return new Set()

  const memberships = await GroupMembership.query(q => {
    q.where({ user_id: userId, active: true })
    q.whereIn('group_id', spaceIds)
  }).fetchAll()

  const membershipModels = memberships.models || memberships
  return new Set(membershipModels.map(m => String(m.get('group_id'))))
}

/**
 * Last-read post id per source group chat view. A missing group_views_users
 * row means the user has not read anything yet, so all chats are kept.
 */
const chatReadStateByGroup = async (userId, chats) => {
  const sourceGroupIds = uniq(chats.map(c => c.source_group_id).filter(id => id != null))
  if (sourceGroupIds.length === 0) return {}

  const chatViews = await GroupView.query(q => {
    q.whereIn('group_id', sourceGroupIds)
    q.where('type', GroupView.Type.CHAT)
  }).fetchAll()

  const viewByGroupId = {}
  const viewModels = chatViews.models || chatViews
  viewModels.forEach(view => {
    viewByGroupId[String(view.get('group_id'))] = view
  })

  const viewIds = viewModels.map(view => view.id)
  const viewUsers = viewIds.length === 0
    ? { models: [] }
    : await GroupViewUser.query(q => {
      q.where('user_id', userId)
      q.whereIn('view_id', viewIds)
    }).fetchAll()

  const viewUserByViewId = {}
  viewUsers.models.forEach(viewUser => {
    viewUserByViewId[String(viewUser.get('view_id'))] = viewUser
  })

  const result = {}
  for (const groupId of sourceGroupIds) {
    const view = viewByGroupId[String(groupId)]
    result[String(groupId)] = view ? viewUserByViewId[String(view.id)] || null : null
  }
  return result
}

const filterMyAndBlockedUserData = async (userId, data) => {
  const clonedData = cloneDeep(data)
  const blockedUserIds = (await BlockedUser.blockedFor(userId)).rows.map(r => r.user_id)

  for (const post of clonedData.posts_with_new_comments || []) {
    // Filter out comments by blocked user or the user themselves
    post.comments = filter(comment => !includes(get('user.id', comment), blockedUserIds.concat(userId)), post.comments)
    // TODO: filter out comments that have alraedy been seen? Unfortunatly we arent tracking last read post time very well right now.
  }

  const allItems = CONTENT_KEYS.flatMap(key => clonedData[key] || [])
  const memberSpaceIds = await memberSpaceIdSet(userId, allItems)
  const chatReadState = await chatReadStateByGroup(userId, clonedData.chats || [])

  for (const key of CONTENT_KEYS) {
    if (!clonedData[key]) continue

    const filteredItems = clonedData[key].map((object) => {
      // Filter out all posts by blocked users
      if (includes(get('user.id', object), blockedUserIds)) return null

      // Filter out posts by the user themselves except for posts with new comments, upcoming, and ending reminders
      if (!['posts_with_new_comments', 'upcoming', 'ending'].includes(key) && parseInt(object.user.id) === parseInt(userId)) return null

      // Drop posts/chats from spaces the recipient is not a member of
      if (object.space_id && !memberSpaceIds.has(String(object.space_id))) return null

      // Filter out posts that no longer have any comments
      if (key === 'posts_with_new_comments' && object.comments.length === 0) return null

      // Filter out chats the user has already read on that group's chat view.
      // A missing group_views_users row means nothing has been read yet.
      if (key === 'chats') {
        const viewUser = chatReadState[String(object.source_group_id)]
        if (viewUser && object.id <= viewUser.get('last_read_post_id')) return null
      }
      return object
    })

    clonedData[key] = filteredItems.filter(item => item !== null)
  }

  // Count of new chats in the group chat and each space chat the user is in
  clonedData.chat_rooms = aggregateChatRooms(clonedData.chats)
  delete clonedData.chats
  delete clonedData.topics_with_chats

  return clonedData
}

const personalizeData = async (user, type, data, opts = {}) => {
  // Don't show me content I created or created by blocked users
  const filteredData = await filterMyAndBlockedUserData(user.id, data)

  // Check again after filtering to make sure we're not sending empty digests
  if (!(await shouldSendData(filteredData, user.id))) {
    return null
  }
  filteredData.num_sections = Object.keys(filteredData).filter(k => Array.isArray(filteredData[k]) && filteredData[k].length > 0).length

  const locale = user.getLocale()
  const clickthroughParams = '?' + new URLSearchParams({
    ctt: 'digest_email',
    cti: user.id,
    ctcn: data.group_name
  }).toString()

  getPosts(filteredData).forEach(post => {
    post.url = Frontend.appendQueryString(post.url, clickthroughParams)
    post.reply_url = Email.postReplyAddress(post.id, user.id)
    if (post.details) {
      post.details = addParamsToLinks(post.details, clickthroughParams)
    }
  })

  ;(filteredData.chat_rooms || []).forEach(room => {
    if (room.url) {
      room.url = Frontend.appendQueryString(room.url, clickthroughParams)
    }
  })

  return Promise.props(merge(filteredData, {
    subject: generateSubjectLine(data, type, locale),
    group_url: Frontend.appendQueryString(filteredData.group_url, clickthroughParams),
    recipient: {
      avatar_url: user.get('avatar_url'),
      name: user.get('name')
    },
    email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
    tracking_pixel_url: Analytics.pixelUrl('Digest', {
      userId: user.id,
      group: data.group_name
    }),
    // TODO: these not being used right now, bring them back?
    post_creation_action_url: Frontend.Route.emailPostForm(),
    reply_action_url: Frontend.Route.emailBatchCommentForm(),
    form_token: Email.formToken(data.group_id, user.id)
  }))
}

export default personalizeData
