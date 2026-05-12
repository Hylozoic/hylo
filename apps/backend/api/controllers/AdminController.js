import { DateTime } from 'luxon'
import { merge, transform, sortBy } from 'lodash'

const rawMetricsQuery = startTime => Promise.props({
  group: Group.query(q => {
    q.select(['id', 'name', 'created_at', 'avatar_url'])
  }).query(),

  user: User.query(q => {
    q.where('users.created_at', '>', startTime)
    q.leftJoin('group_memberships', 'users.id', 'group_memberships.user_id')
    q.where('group_memberships.active', true)
    q.select(['users.id', 'users.created_at', 'group_memberships.group_id'])
  }).query(),

  post: Post.query(q => {
    q.where('posts.created_at', '>', startTime)
    q.where('posts.type', '!=', 'welcome')
    q.where('posts.user_id', '!=', User.AXOLOTL_ID)
    q.join('groups_posts', 'posts.id', 'groups_posts.post_id')
    q.select(['posts.id', 'posts.created_at', 'groups_posts.group_id', 'posts.user_id'])
  }).query(),

  comment: Comment.query(q => {
    q.where('comments.created_at', '>', startTime)
    q.join('groups_posts', 'comments.post_id', 'groups_posts.post_id')
    q.select(['comments.id', 'comments.created_at', 'groups_posts.group_id', 'comments.user_id'])
  }).query()
})

module.exports = {
  loginAsUser: function (req, res) {
    return User.find(req.param('userId'))
      .then(user => UserSession.login(req, user, 'admin'))
      .then(() => res.redirect('/app'))
  },

  rawMetrics: function (req, res) {
    const start = DateTime.now().minus({ months: 3 }).toJSDate()
    return rawMetricsQuery(start)
      .then(props => {
        let result = props.group.reduce((acc, g) => {
          acc[g.id] = merge(g, { events: [] })
          return acc
        }, {})

        result.none = { id: 'none', name: 'No group', events: [] }

        ;['user', 'post', 'comment'].forEach(name => {
          props[name].forEach(item => {
            const key = item.group_id || 'none'
            if (!result[key]) return
            result[key].events.push({
              time: Date.parse(item.created_at),
              user_id: item.user_id || item.id,
              name
            })
          })
        })

        result = transform(result, (acc, g, k) => {
          if (g.events.length === 0) return
          g.events = sortBy(g.events, 'time')
          acc[k] = g
        }, {})

        res.ok(result)
      })
  }
}
