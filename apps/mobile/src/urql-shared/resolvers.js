import { simplePagination } from '@urql/exchange-graphcache/extras'
import cursorPagination from './cursorPagination'

export default {
  Query: {
    // threadList: cursorPagination(),
    posts: simplePagination({ offsetArgument: 'offset', limitArgument: 'first' })
  },
  Group: {
    posts: simplePagination({ offsetArgument: 'offset', limitArgument: 'first' })
  },
  Post: {
    comments: cursorPagination()
  },
  Comment: {
    childComments: cursorPagination()
  }
}
