/* eslint-disable camelcase */
import {
  curry, find, sortBy
} from 'lodash/fp'

const presentComment = curry((slug, comment) => ({
  id: comment.id,
  text: RichText.qualifyLinks(comment.text(), slug),
  user: comment.relations.user.pick('id', 'name', 'avatar_url')
}))

const formatData = curry((group, data) => {
  const posts = data.posts.map(post => post.presentForEmail({ group, type: 'digest' }))
  const ret = {}
  for (const type of ['discussion', 'event', 'offer', 'project', 'proposal', 'request', 'resource', 'chat']) {
    ret[type + 's'] = sortBy(p => -p.id, posts.filter(p => p.type === type))
  }
  if (data.upcomingPostReminders?.startingSoon) {
    ret.upcoming = data.upcomingPostReminders?.startingSoon?.map(p => p.presentForEmail({ type: 'oneline', group }))
  }
  if (data.upcomingPostReminders?.endingSoon) {
    ret.ending = data.upcomingPostReminders?.endingSoon?.map(p => p.presentForEmail({ type: 'oneline', group }))
  }

  const postsWithNewComments = []
  data.comments.forEach(comment => {
    let post = find(p => p.id === parseInt(comment.get('post_id')), postsWithNewComments)
    if (!post) {
      post = comment.relations.post.presentForEmail({ type: 'digest', group })
      postsWithNewComments.push(post)
    }
    post.comment_count = post.comment_count ? post.comment_count + 1 : 1
    post.comments.push(presentComment(group.slug, comment))
  })

  ret.posts_with_new_comments = sortBy(p => -p.id, postsWithNewComments)

  // Add funding round submissions
  if (data.fundingRoundSubmissions && data.fundingRoundSubmissions.length > 0) {
    ret.funding_rounds = data.fundingRoundSubmissions.map(fr => ({
      id: fr.fundingRoundId,
      title: fr.fundingRoundTitle,
      submission_count: fr.submissionCount,
      url: Frontend.Route.fundingRound({ id: fr.fundingRoundId }, group)
    }))
  }

  ret.num_sections = Object.keys(ret).filter(k => Array.isArray(ret[k]) && ret[k].length > 0).length
  return ret.num_sections > 0 ? ret : null
})

export default formatData
