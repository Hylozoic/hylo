import { GraphQLError } from 'graphql'
import { values } from 'lodash'
import * as types from './types'

export function validate ({ type, id, userId, url, stream }) {
  if (!values(types).includes(type)) {
    return Promise.reject(new GraphQLError('Validation error: Invalid type'))
  }

  if (!url && !stream) {
    return Promise.reject(new GraphQLError('Validation error: No url and no stream'))
  }

  if (!id) {
    return Promise.reject(new GraphQLError('Validation error: No id'))
  }

  return hasPermission(userId, type, id)
}

async function hasPermission (userId, type, id) {
  if (type.startsWith('user')) {
    if (id === userId) return Promise.resolve()
    return Promise.reject(new GraphQLError('Validation error: Not allowed to change settings for another person'))
  }

  if (type.startsWith('group')) {
    const group = await Group.find(id)
    if (!group ||
      !(await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION))) {
      throw new GraphQLError('Validation error: Not an administrator of this group')
    }
  }

  if (type.startsWith('post')) {
    if (id === 'new') return Promise.resolve()
    return Post.find(id)
      .then(post => {
        // Allow uploads by post followers for action posts
        if (!post || (post.get('user_id') !== userId && post.get('type') !== 'action')) throw new GraphQLError('Validation error: Not allowed to edit this post')
      })
  }
}
