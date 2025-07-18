import makePaginationResolver from './makePaginationResolver'

export default {
  Query: {
    posts: makePaginationResolver(),
    search: makePaginationResolver(),
    notifications: makePaginationResolver()
  },
  Post: {
    comments: makePaginationResolver()
  },
  Comment: {
    childComments: makePaginationResolver()
  },
  Group: {
    posts: makePaginationResolver(),
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
    comments: makePaginationResolver(),
    reactions: makePaginationResolver()
  }
}
