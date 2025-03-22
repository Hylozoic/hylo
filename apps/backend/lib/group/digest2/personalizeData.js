import { cloneDeep, flatten, merge, pick, values } from 'lodash'
import { includes, filter, get } from 'lodash/fp'
import { es } from '../../i18n/es'
import { en } from '../../i18n/en'
import { shouldSendData } from './util'
import * as cheerio from 'cheerio'
const locales = { en, es }

const generateSubjectLine = (data, type, locale) => {
  if (data.search) {
    // Saved search
    return locales[locale].newSavedSearchResults(data.search.get('name'))
  }

  if (type === 'daily') {
    return locales[locale].emailDigestDailySubject(data.group_name)
  }

  if (type === 'weekly') {
    return locales[locale].emailDigestWeeklySubject(data.group_name)
  }
}

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
      let newHref = href + params
      // if the original href has query params, fix the new value
      if (newHref.match(/\?/g).length > 1) {
        const i = newHref.lastIndexOf('?')
        newHref = newHref.slice(0, i) + '&' + newHref.slice(i + 1)
      }
      a.attr('href', newHref)
    }
  })
  return doc.html()
}

const filterMyAndBlockedUserData = async (userId, data) => {
  const clonedData = cloneDeep(data)
  const blockedUserIds = (await BlockedUser.blockedFor(userId)).rows.map(r => r.user_id)

  for (const post of clonedData.posts_with_new_comments) {
    // Filter out comments by blocked user or the user themselves
    post.comments = filter(comment => !includes(get('user.id', comment), blockedUserIds.concat(userId)), post.comments)
    // TODO: filter out comments that have alraedy been seen? Unfortunatly we arent tracking last read post time very well right now.
  }

  const chatRooms = {}

  const keys = ['discussions', 'requests', 'offers', 'events', 'projects', 'resources', 'chats', 'posts_with_new_comments', 'upcoming', 'ending']
  for (const key of keys) {
    if (!clonedData[key]) continue

    const filteredItems = await Promise.all(clonedData[key].map(async (object) => {
      // Filter out all posts by blocked users
      if (includes(get('user.id', object), blockedUserIds)) return null

      // Filter out posts by the user themselves except for posts with new comments, upcoming, and ending reminders
      if (!['posts_with_new_comments', 'upcoming', 'ending'].includes(key) && parseInt(object.user.id) === parseInt(userId)) return null

      // Filter out posts that no longer have any comments
      if (key === 'posts_with_new_comments' && object.comments.length === 0) return null

      // Filter out chats that are older than the most recently read chat in that room by this user
      if (key === 'chats') {
        if (!chatRooms[object.topic_name]) {
          const tag = await Tag.where({ name: object.topic_name }).fetch()
          chatRooms[object.topic_name] = await TagFollow.where({ tag_id: tag.id, group_id: data.group_id, user_id: userId }).fetch()
        }
        if (object.id <= chatRooms[object.topic_name].get('last_read_post_id')) return null
      }
      return object
    }))

    // Filter out null values (items that didn't pass our conditions)
    clonedData[key] = filteredItems.filter(item => item !== null)
  }

  // We don't need to show every chat, only the count of new chats in each room
  clonedData.topics_with_chats = Object.values(clonedData.chats.reduce((topics, chat) => {
    if (chat.topic_name) {
      if (topics[chat.topic_name]) {
        topics[chat.topic_name].num_new_chats++
      } else {
        topics[chat.topic_name] = {
          name: chat.topic_name,
          num_new_chats: 1,
          url: Frontend.Route.topic(data.group_slug, chat.topic_name)
        }
      }
    }
    return topics
  }, []))
  delete clonedData.chats

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

  const locale = user.get('settings').locale || 'en'
  const clickthroughParams = '?' + new URLSearchParams({
    ctt: 'digest_email',
    cti: user.id,
    ctcn: data.group_name
  }).toString()

  getPosts(filteredData).forEach(post => {
    post.url = post.url + clickthroughParams
    post.reply_url = Email.postReplyAddress(post.id, user.id)
    if (post.details) {
      post.details = addParamsToLinks(post.details, clickthroughParams)
    }
  })

  return Promise.props(merge(filteredData, {
    subject: generateSubjectLine(data, type, locale),
    group_url: filteredData.group_url + clickthroughParams,
    recipient: {
      avatar_url: user.get('avatar_url'),
      name: user.get('name')
    },
    email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, user),
    tracking_pixel_url: Analytics.pixelUrl('Digest', {
      userId: user.id,
      group: data.group_name,
      'Email Version': opts.versionName
    }),
    // TODO: these not being used right now, bring them back?
    post_creation_action_url: Frontend.Route.emailPostForm(),
    reply_action_url: Frontend.Route.emailBatchCommentForm(),
    form_token: Email.formToken(data.group_id, user.id)
  }))
}

export default personalizeData
