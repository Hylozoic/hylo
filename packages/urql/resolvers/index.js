import makePaginationResolver from './makePaginationResolver'

export default {
  Query: {
    posts: makePaginationResolver(),
    search: makePaginationResolver()
  },
  Comment: {
    childComments: makePaginationResolver()
  },
  Group: {
    viewPosts: makePaginationResolver()
  },
  Me: {
    messageThreads: makePaginationResolver()
  },
  MessageThread: {
    messages: makePaginationResolver()
  },
  Person: {
    posts: makePaginationResolver(),
    comments: makePaginationResolver()
  },
  Post: {
    // This is here mostly as an example of things you can do in a resolver, however
    // the ordering of post.attachments is probably already reliable from the server
    attachments: (parent, args, cache, info) => {
      const attachments = cache.resolve(parent, info.fieldName)
      return attachments.sort((a, b) => {
        return cache.resolve(b, 'position') - cache.resolve(a, 'position')
      })
    }
  }
}
