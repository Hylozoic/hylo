import { isString, isNumber, isEmpty } from 'lodash'
import { format } from 'util'

/*

This file exists because we sometimes need to refer to URL's that live in the
Angular app. Better to contain all that kind of coupling here than to spread it
throughout the code.

*/

let prefix = `${process.env.PROTOCOL}://${process.env.DOMAIN}`
const isTesting = process.env.NODE_ENV === 'test'

const url = function () {
  // allow these values to be changed in individual tests
  if (isTesting) {
    prefix = `${process.env.PROTOCOL}://${process.env.DOMAIN}`
  }
  const args = Array.prototype.slice.call(arguments)
  args[0] = prefix + args[0]
  return format.apply(null, args)
}

const getModelId = function (model) {
  let id
  // If it's a number, than we just passed the ID in straight
  if (isString(model) || isNumber(model)) {
    id = model
  } else if (model) {
    id = model.id
  }

  return id
}

const getSlug = function (group) {
  let slug
  if (isString(group)) { // In case we passed just the slug in instead of group object
    slug = group
  } else if (group) {
    slug = group.slug || group.get('slug')
  }

  return slug
}

const getTopicName = function (topic) {
  let name
  if (isString(topic)) { // In case we passed just the name in instead of group object
    name = topic
  } else if (topic) {
    name = topic.name || topic.get('name')
  }

  return name
}

module.exports = {
  getSlug,
  Route: {
    evo: {
      passwordSetting: function () {
        return url('/my/account')
      },

      paymentSettings: function (opts = {}) {
        switch (opts.registered) {
          case 'success':
            return url('/settings/payment?registered=success')
          case 'error':
            return url('/settings/payment?registered=error')
          default:
            return url('/settings/payment')
        }
      }
    },

    prefix,

    root: () => url('/app'),

    chat: function (group, topic) {
      return url(`/groups/${getSlug(group)}/chat/${getTopicName(topic)}`)
    },

    comment: function ({ comment, group, post }) {
      const usePost = comment?.relations?.post || post
      return this.post(usePost, group, `commentId=${comment.id}`)
    },

    group: function (group) {
      return url('/groups/%s', getSlug(group))
    },

    groupRelationships: function (group) {
      return this.group(group) + '/groups'
    },

    groupSettings: function (group) {
      return this.group(group) + '/settings'
    },

    groupJoinRequests: function (group) {
      return this.groupSettings(group) + '/requests'
    },

    groupRelationshipInvites: function (group) {
      return this.groupSettings(group) + '/relationships#invites'
    },

    groupRelationshipJoinRequests: function (group) {
      return this.groupSettings(group) + '/relationships#join_requests'
    },

    invitePath: function (group) {
      return `/groups/${getSlug(group)}/join/${group.get('access_code')}`
    },

    mapPost: function (post, context, slug) {
      let contextUrl = '/all'

      if (context === 'public') {
        contextUrl = '/public'
      } else if (context === 'groups') {
        contextUrl = `/groups/${slug}`
      }

      return url(`${contextUrl}/map/post/${getModelId(post)}`)
    },

    notificationsSettings: function (clickthroughParams, user) {
      const loginToken = user.generateJWT({
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30), // 1 month expiration
        action: 'notification_settings' // To track that this token can only be used for changing notification settings
      })
      return url('/notifications' + clickthroughParams + '&expand=account&token=' + loginToken + '&name=' + encodeURIComponent(user.get('name')) + '&u=' + user.id)
    },

    profile: function (user, group) {
      if (group) {
        return url(`/groups/${getSlug(group)}/members/${getModelId(user)}`)
      }
      return url(`/members/${getModelId(user)}`)
    },

    /**
     * Generates the frontend URL for viewing a post in context.
     *
     * Routing rules:
     * 1. Funding-round submissions get their own dedicated URL.
     * 2. Chat-type posts (direct messages in a chat room) link to that chat
     *    room using the post's first topic tag, with postId as a query param
     *    so the UI can open the message inline.
     * 3. All other posts use the group's configured home view (home_route):
     *    - If the home is a chat view (e.g. /chat/general), the post is
     *      surfaced there via the same ?postId= query param pattern.
     *    - Otherwise (e.g. /stream, /map) the post URL is appended as a path
     *      segment so the UI renders the post detail modal at that route.
     *    - Note: In theory it would be better to see if a post was created in a
     *      chat room and post there if so, but it adds complexity and will change
     *      soon with Spaces.
     * 4. Posts with no group fall back to the public or all-groups feed.
     *
     * Note: `group` may be a Bookshelf model (has .get()) or a plain slug
     * string. When only a slug is available home_route is unknown so we
     * default to /stream.
     */
    post: function (post, group, extraParams = '', fundingRound = null) {
      const groupSlug = getSlug(group)
      let groupUrl = '/all'

      if (!group) {
        groupUrl = '/public'
      } else if (!isEmpty(groupSlug)) {
        if (fundingRound) {
          return url(`/groups/${groupSlug}/funding-rounds/${getModelId(fundingRound)}/submissions/post/${getModelId(post)}?${extraParams}`)
        }

        const tags = post.relations?.tags
        const firstTopic = tags && tags.first()?.get('name')

        if (post.get && post.get('type') === Post.Type.CHAT && firstTopic) {
          return url(`/groups/${groupSlug}/chat/${firstTopic}?postId=${post.id}&${extraParams}`)
        }

        const isGroupObject = group && typeof group.get === 'function'
        const homeRoute = isGroupObject ? (group.get('home_route') || '/stream') : '/stream'
        if (homeRoute.startsWith('/chat/') && firstTopic) {
          // Non-chat post shown in a chat home: open as a modal above the chat
          // using /post/:id so you can see the full post and comments.
          return url(`/groups/${groupSlug}${homeRoute}/post/${getModelId(post)}?${extraParams}`)
        }
        if (!homeRoute.startsWith('/chat/')) {
          return url(`/groups/${groupSlug}${homeRoute}/post/${getModelId(post)}?${extraParams}`)
        }
        // Chat home but post has no topics (e.g. Zapier-created): fall back to
        // standalone post URL so the UI can still open it.
        return url(`/groups/${groupSlug}/post/${getModelId(post)}?${extraParams}`)
      }
      return url(`${groupUrl}/post/${getModelId(post)}?${extraParams}`)
    },

    signup: (error) => {
      return url('/signup?error=%s', error)
    },

    signupFinish: () => {
      return url('/signup/finish')
    },

    thread: function (post) {
      return url(`/messages/${getModelId(post)}`)
    },

    topic: function (group, topic) {
      return url(`/groups/${getSlug(group)}/topics/${getTopicName(topic)}`)
    },

    track: function (track) {
      return url(`/tracks/${getModelId(track)}`)
    },

    fundingRound: function (fundingRound, group, tab = null) {
      return url(`/groups/${getSlug(group)}/funding-rounds/${getModelId(fundingRound)}${tab ? `/${tab}` : ''}`)
    },

    unfollow: function (post, group) {
      return this.post(post, group) + '?action=unfollow'
    },

    userSettings: function () {
      return url('/settings')
    },

    jwtLogin: function (user, token, nextUrl) {
      return url('/noo/login/jwt?u=%s&token=%s&n=%s',
        user.id, token, encodeURIComponent(nextUrl || ''))
    },

    tokenLogin: function (user, token, nextUrl) {
      return url('/noo/login/token?u=%s&t=%s&n=%s',
        user.id, token, encodeURIComponent(nextUrl || ''))
    },

    error: function (key) {
      return url('/error?key=' + encodeURIComponent(key))
    },

    useInvitation: function (token, email) {
      return url('/h/use-invitation?token=%s&email=%s', token, encodeURIComponent(email))
    },

    verifyEmail: function (email, token) {
      return url('/signup/verify-email?email=%s&token=%s', encodeURIComponent(email), token)
    },

    emailPostForm: function () {
      return url('/noo/hook/postForm')
    },

    emailBatchCommentForm: function () {
      return url('/noo/hook/batchCommentForm')
    }
  }
}
