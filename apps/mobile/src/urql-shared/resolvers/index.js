import { hyloSimplePagination } from './hyloSimplePagination'
import cursorPagination from './cursorPagination'

export default {
  Query: {
    threadList: cursorPagination(),
    posts: hyloSimplePagination({ offsetArgument: 'offset', limitArgument: 'first' })
  },
  Group: {
    posts: hyloSimplePagination({ offsetArgument: 'offset', limitArgument: 'first' }),
    viewPosts: hyloSimplePagination({ offsetArgument: 'offset', limitArgument: 'first' })
  },
  Post: {
    comments: cursorPagination(),
    attachments: (parent, args, cache, info) => {
      const attachments = cache.resolve(parent, info.fieldName)
      return attachments.sort((a, b) => {
        return cache.resolve(b, 'position') - cache.resolve(a, 'position')
      })
    }
  },
  Comment: {
    childComments: cursorPagination()
  }
}
