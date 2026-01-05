import { GraphQLError } from 'graphql'
import { includes, isEmpty } from 'lodash'

export default function validatePostData (userId, data) {
  const allowedTypes = [Post.Type.ACTION, Post.Type.CHAT, Post.Type.REQUEST, Post.Type.OFFER, Post.Type.DISCUSSION, Post.Type.PROJECT, Post.Type.EVENT, Post.Type.RESOURCE, Post.Type.PROPOSAL, Post.Type.SUBMISSION]
  if (data.type && !includes(allowedTypes, data.type)) {
    throw new GraphQLError('not a valid type')
  }

  if (data.type === Post.Type.PROPOSAL && data.proposalOptions && data.proposalOptions.length === 0) {
    throw new GraphQLError('Proposals need at a least one option')
  }

  if (isEmpty(data.group_ids)) {
    throw new GraphQLError('no groups specified')
  }

  if (data.topicNames && data.topicNames.length > 3) {
    throw new GraphQLError('too many topics in post, maximum 3')
  }

  return Group.allHaveMember(data.group_ids, userId)
    .then(ok => ok ? Promise.resolve() : Promise.reject(new GraphQLError('unable to post to all those groups')))
}
