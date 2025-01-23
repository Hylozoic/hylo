export default function makeSubscriptions ({ resolvers, expressContext, userId, isAdmin, fetchOne, fetchMany }) {
  return {
    countdown: {
      subscribe: async function * (_, { from }) {
        for (let i = from; i >= 0; i--) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait for 1 second
          yield { countdown: i } // Send the value to the subscriber
        }
      }
    },

    commentAdded: {
      subscribe: (_, args, context) => {
        return context.pubSub.subscribe(`createComment-forPostId-${args.postId}`)
      },
      resolve: (payload, args, context, info) => {
        console.log('!!! payload in commentAdded subscription resolver:', payload, args, context, info)
      }
      //   return payload
      // }
        // console.log("!!!! info.schema.getType('Comment').resolve", info.schema.getType('Comment'))
        // console.log('!!!! commentAdded - comment:')
        // console.dir(payload)
        // console.log('!!! commentAdded - info :', info)
        // console.dir(info)
        // console.log('!!! commentAdded - context :')
        // console.dir(context)
        // Let GraphQL handle the rest of the field resolution dynamically
      //   return payload?.commentAdded
      // }
    },

    messageAdded: {
      subscribe: (_, { threadId }, context) => {
        const channel = `MESSAGE_ADDED_${threadId}`
        return context.pubSub.subscribe(channel)
      }
    }
  }
}
