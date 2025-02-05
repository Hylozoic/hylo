import makePaginationResolver from './makePaginationResolver'

export default {
  Query: {
    posts: makePaginationResolver(),
    search: makePaginationResolver(),
    notifications: makePaginationResolver()
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
  }
}
