/* eslint-disable camelcase */
import { isEmpty } from 'lodash'
import { flow, filter, map, includes } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import createComment from '../models/comment/createComment'
import Busboy from 'busboy'

module.exports = {
  createFromEmail: function (req, res) {
    // Now parsing with Sendgrid which uses multipart/form-data
    if (!req.is('multipart/form-data')) {
      return res.status(422).send({ error: 'Invalid Content-Type' })
    }

    let busboy
    const params = {}

    try {
      // this can throw errors due to invalid Content-Type
      busboy = new Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: 10 * 1048576 }
      })
    } catch (err) {
      res.status(422).send({ error: err.message })
    }

    busboy.on('field', (name, value) => {
      params[name] = value
    })

    busboy.on('error', err => res.serverError(err))
    busboy.on('finish', () => {
      let replyData
      try {
        replyData = Email.decodePostReplyAddress(params.to)
      } catch (e) {
        return res.status(422).send('Invalid reply address: ' + params.to)
      }

      return Promise.join(
        Post.find(replyData.postId, { withRelated: 'groups' }),
        User.find(replyData.userId),
        (post, user) => {
          if (!post) return res.status(422).send('valid token, but post not found')
          if (!user) return res.status(422).send('valid token, but user not found')
          const group = post.relations.groups.first()

          Analytics.track({
            userId: replyData.userId,
            event: 'Post: Comment: Add by Email',
            properties: {
              post_id: post.id,
              group: group && group.get('name')
            }
          })

          const text = Comment.cleanEmailText(user, params.text || params.html, {
            useMarkdown: !post.isThread()
          })
          return createComment(replyData.userId, { text, post, created_from: 'email' })
            .then(() => res.ok({}), res.serverError)
        })
    })

    req.pipe(busboy)
  },

  createBatchFromEmailForm: function (req, res) {
    // TODO: fix
    const { groupId, userId } = res.locals.tokenData

    const replyText = postId => TextHelpers.markdown(req.param(`post-${postId}`, { disableAutolinking: true }))

    const postIds = flow(
      Object.keys,
      filter(k => k.match(/^post-(\d)+$/)),
      map(k => k.replace(/^post-/, ''))
    )(req.allParams())

    let failures = false

    return Group.find(groupId)
      .then(group => Promise.map(postIds, id => {
        if (isEmpty(replyText(id))) return
        return Post.find(id, { withRelated: ['groups'] })
          .then(post => {
            if (!post || !includes(groupId, post.relations.groups.pluck('id'))) {
              failures = true
              return Promise.resolve()
            }

            if (post && (new Date() - post.get('created_at') < 5 * 60000)) return

            return Comment.where({
              user_id: userId,
              post_id: post.id,
              text: replyText(post.id)
            }).fetch()
              .then(comment => {
                // comment with this text already exists
                if (comment) return

                return createComment(userId, {
                  text: replyText(post.id),
                  post,
                  created_from: 'email batch form'
                })
                  .then((newComment) => {
                    Analytics.track({
                      userId,
                      event: 'Post: Comment: Add by Email Form',
                      properties: {
                        post_id: post.id,
                        group: group && group.get('name'),
                        comment_id: newComment.id
                      }
                    })

                    // TODO: then this function is getting called twice, that ok?
                    return Post.updateFromNewComment({
                      postId: post.id,
                      commentId: comment.id
                    })
                  })
              })
          })
      })
        .then(() => {
          let notification
          if (failures) {
            notification = 'Some of your comments could not be added.'
          } else {
            notification = 'Your comments have been added.'
          }
          return res.redirect(Frontend.Route.group(group) +
            `?notification=${notification}${failures ? '&error=true' : ''}`)
        }, res.serverError))
  }
}
