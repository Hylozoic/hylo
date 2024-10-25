import { simplePagination } from '@urql/exchange-graphcache/extras'
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
    comments: cursorPagination()
  },
  Comment: {
    childComments: cursorPagination()
  }
}
