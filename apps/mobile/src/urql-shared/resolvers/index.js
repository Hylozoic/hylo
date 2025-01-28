import makeCursorPaginationResolver from './makeCursorPaginationResolver'
import makeOffsetPaginationResolver from './makeOffsetPaginationResolver'

export default {
  Query: {
    post: (parent, args, cache, info) => ({ __typename: 'Post', id: args.id }),
    comment: (parent, args, cache, info) => ({ __typename: 'Comment', id: args.id }),
    posts: makeOffsetPaginationResolver(),
    search: makeOffsetPaginationResolver()
  },
  Group: {
    posts: makeOffsetPaginationResolver(),
    viewPosts: makeOffsetPaginationResolver()
  },
  Post: {
    comments: makeCursorPaginationResolver(),
    attachments: (parent, args, cache, info) => {
      const attachments = cache.resolve(parent, info.fieldName)
      return attachments.sort((a, b) => {
        return cache.resolve(b, 'position') - cache.resolve(a, 'position')
      })
    }
  },
  Me: {
    messageThreads: makeOffsetPaginationResolver()
  },
  MessageThread: {
    messages: makeCursorPaginationResolver()
  },
  Person: {
    posts: makeOffsetPaginationResolver(),
    comments: makeOffsetPaginationResolver()
  },
  Comment: {
    childComments: makeCursorPaginationResolver()
  }
}
