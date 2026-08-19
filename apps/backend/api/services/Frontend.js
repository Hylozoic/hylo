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

/**
 * Appends query params to an existing URL without producing a second `?`
 * @param {string} baseUrl
 * @param {string} queryFragment `?ctt=...&cti=...` or `ctt=...&cti=...`
 */
const appendQueryString = function (baseUrl, queryFragment) {
  if (baseUrl == null || baseUrl === '') return baseUrl
  if (queryFragment == null || queryFragment === '') return baseUrl
  const q = String(queryFragment).replace(/^\?+/, '').replace(/^&+/, '') // Remove any leading ? or & from the queryFragment
  if (!q) return baseUrl
  return baseUrl + (baseUrl.includes('?') ? '&' : '?') + q
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

/** Local space slug portion from a stored space slug (`{parentSlug}-{localName}`). */
const localSpaceSlug = function (parentSlug, spaceFullSlug) {
  if (!parentSlug || !spaceFullSlug) return spaceFullSlug || ''
  const prefix = `${parentSlug}-`
  return spaceFullSlug.startsWith(prefix) ? spaceFullSlug.slice(prefix.length) : spaceFullSlug
}

/** Normalize an optional view path (`chat` → `/chat`). Empty/null → ''. */
const normalizeViewPath = function (viewPath) {
  if (viewPath == null || viewPath === '') return ''
  return viewPath.startsWith('/') ? viewPath : `/${viewPath}`
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
  appendQueryString,
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
      const isGroupObject = group && typeof group.get === 'function'
      const isSpace = isGroupObject && group.get('type') === 'space'
      const topicName = topic ? getTopicName(topic) : null
      const path = topicName ? `/chat/${topicName}` : '/chat'
      if (isSpace) {
        return module.exports.Route.space(group, path)
      }
      return url(`/groups/${getSlug(group)}${path}`)
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
      return appendQueryString(
        url('/notifications'),
        clickthroughParams
      ) + '&expand=account&token=' + loginToken + '&name=' + encodeURIComponent(user.get('name')) + '&u=' + user.id
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
     * 2. Space posts (group.type === 'space') go through Route.space so they
     *    land at /groups/{parentSlug}/spaces/{localSlug}/...
     * 3. Chat-type posts link to the group's chat view with postId as a query
     *    param so the UI can open the message inline.
     * 4. All other posts use the group's configured home view (home_route):
     *    - If the home is a chat view (e.g. /chat/general), the post is
     *      surfaced there via the same ?postId= query param pattern.
     *    - Otherwise (e.g. /all, /map) the post URL is appended as a path
     *      segment so the UI renders the post detail modal at that route.
     * 5. Posts with no group fall back to the public or all-groups feed.
     *
     * Note: `group` may be a Bookshelf model (has .get()) or a plain slug
     * string. When only a slug is available home_route is unknown so we
     * default to /all. Space groups should have parentGroup loaded.
     */
    post: function (post, group, extraParams = '', fundingRound = null) {
      // Remove any leading ? or & from the extraParams
      const querySuffix = String(extraParams ?? '').replace(/^\?+/, '').replace(/^&+/, '')
      const groupSlug = getSlug(group)
      const isGroupObject = group && typeof group.get === 'function'
      const isSpace = isGroupObject && group.get('type') === 'space'

      const groupViewUrl = (viewPath) => {
        if (isSpace) {
          return module.exports.Route.space(group, viewPath)
        }
        return url(`/groups/${groupSlug}${normalizeViewPath(viewPath)}`)
      }

      if (!group) {
        return url(`/public/post/${getModelId(post)}${querySuffix ? '?' + querySuffix : ''}`)
      }

      if (isEmpty(groupSlug)) {
        return url(`/all/post/${getModelId(post)}${querySuffix ? '?' + querySuffix : ''}`)
      }

      if (fundingRound) {
        // `group` is the funding-round space
        return appendQueryString(
          module.exports.Route.space(group, `/funding-round-submissions/post/${getModelId(post)}`),
          querySuffix
        )
      }

      const tags = post.relations?.tags
      const firstTopic = tags && tags.first()?.get('name')

      if (post.get && post.get('type') === Post.Type.CHAT) {
        return appendQueryString(
          groupViewUrl('/chat'),
          `postId=${post.id}${querySuffix ? '&' + querySuffix : ''}`
        )
      }

      const homeRoute = isGroupObject ? (group.get('home_route') || '/all') : '/all'
      if (homeRoute.startsWith('/chat/') && firstTopic) {
        // Non-chat post shown in a chat home: open as a modal above the chat
        // using /post/:id so you can see the full post and comments.
        return appendQueryString(
          groupViewUrl(`${homeRoute}/post/${getModelId(post)}`),
          querySuffix
        )
      }
      if (!homeRoute.startsWith('/chat/')) {
        return appendQueryString(
          groupViewUrl(`${homeRoute}/post/${getModelId(post)}`),
          querySuffix
        )
      }
      // Chat home but post has no topics (e.g. Zapier-created): fall back to
      // standalone post URL so the UI can still open it.
      return appendQueryString(
        groupViewUrl(`/post/${getModelId(post)}`),
        querySuffix
      )
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

    /**
     * URL for a space under its parent group.
     * `spaceGroup` should have `parentGroup` loaded (relations.parentGroup).
     * @param {Group|string} spaceGroup - space Group (or slug)
     * @param {string} [viewPath] - optional view path, e.g. 'funding-round-submissions' or '/chat'
     *   When omitted, uses the space's home_route (or '' if unset).
     */
    space: function (spaceGroup, viewPath) {
      const spaceSlug = getSlug(spaceGroup)
      if (!spaceSlug) return url('/')

      const parent = spaceGroup?.relations?.parentGroup
      const parentSlug = parent ? getSlug(parent) : null

      let path
      if (viewPath !== undefined && viewPath !== null) {
        path = normalizeViewPath(viewPath)
      } else {
        const homeRoute = spaceGroup?.get ? spaceGroup.get('home_route') : null
        path = normalizeViewPath(homeRoute || '')
      }

      if (parentSlug) {
        const local = localSpaceSlug(parentSlug, spaceSlug)
        return url(`/groups/${parentSlug}/spaces/${local}${path}`)
      }
      // Parent not loaded (or not a nested space): fall back to treating slug as a group path
      return url(`/groups/${spaceSlug}${path}`)
    },

    /**
     * Funding-round space URL. `group` is the FR space.
     * Optional `view` is a space view path (e.g. 'funding-round-submissions').
     * Legacy notification tab names `submissions` / `voting` map to that view.
     */
    fundingRound: function (fundingRound, group, view) {
      let viewPath = view
      if (view === 'submissions' || view === 'voting') {
        viewPath = 'funding-round-submissions'
      } else if (view == null) {
        viewPath = (group?.get && group.get('home_route')) || 'funding-round-submissions'
      }
      return module.exports.Route.space(group, viewPath)
    },

    unfollow: function (post, group) {
      return appendQueryString(this.post(post, group), 'action=unfollow')
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
