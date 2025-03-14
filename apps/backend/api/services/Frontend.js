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
        return url('/settings/account')
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

    post: function (post, group, extraParams = '') {
      const groupSlug = getSlug(group)
      let groupUrl = '/all'

      if (!group) {
        groupUrl = '/public'
      } else if (!isEmpty(groupSlug)) {
        const tags = post.relations.tags
        const firstTopic = tags && tags.first()?.get('name')
        if (firstTopic && (post.get('type') === Post.Type.CHAT || group.hasChatFor(tags.first()))) {
          return url(`/groups/${groupSlug}/chat/${firstTopic}?postId=${post.id}&${extraParams}`)
        } else {
          groupUrl = `/groups/${groupSlug}` + (firstTopic ? `/topics/${firstTopic}` : '')
        }
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
