import reactOn from './reactOn'

export default {
  Mutation: {
    reactOn,
    deleteComment: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'Comment', id: args.id })
      }
    }
  }
}
