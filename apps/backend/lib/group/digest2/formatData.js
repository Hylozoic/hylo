/* eslint-disable camelcase */
import {
  curry, find, sortBy
} from 'lodash/fp'

// const presentComment = curry((slug, comment) => ({
//   id: comment.id,
//   text: RichText.qualifyLinks(comment.text(), slug),
//   user: comment.relations.user.pick('id', 'name', 'avatar_url')
// }))

const formatData = curry((group, data) => {
  const posts = data.posts.map(post => post.presentForEmail({ group, type: 'digest' }))
  const ret = {}
  for (const type of ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource', 'chat']) {
    ret[type + 's'] = sortBy(p => -p.id, posts.filter(p => p.type === type))
  }
  ret.upcoming = data.upcomingPostReminders?.startingSoon?.map(p => p.presentForEmail({ type: 'oneline', group }))
  ret.ending = data.upcomingPostReminders?.endingSoon?.map(p => p.presentForEmail({ type: 'oneline', group }))
  const findFormattedPost = id => find(p => p.id === id, posts)

  const postsWithNewComments = []
  data.comments.forEach(comment => {
    let post = findFormattedPost(comment.get('post_id'))
    if (!post) {
      post = comment.relations.post.presentForEmail({ type: 'digest', group })
      postsWithNewComments.push(post)
    }
    post.comment_count = post.comment_count ? post.comment_count + 1 : 1
    // TODO: for now now showing the actual comments, but maybe we want to?
    // post.comments.push(presentComment(slug, comment))
  })

  ret.posts_with_new_comments = sortBy(p => -p.id, postsWithNewComments)
  ret.num_sections = Object.keys(ret).filter(k => ret[k] && ret[k].length > 0).length
  return ret.num_sections > 0 ? ret : null
})

export default formatData
