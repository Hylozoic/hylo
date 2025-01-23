const useMutationSubscriptionResponder = () => {
  return {
    onExecute({ args, setResultAndStopExecution }) {
      const { contextValue } = args
      // console.log("!!!! args.document.definitions.filter(def => def.kind === 'OperationDefinition').map(def => def.operations)",
      //   args.document.definitions.filter(def => def.kind === 'OperationDefinition').map(def => def.operation)
      // )
      // console.log('!!!!! args?.document.definitions[0]', args?.document.definitions[0])

      const isSubscription = args?.document.definitions.some(
        (definition) =>
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
      )

      const isMutation = args?.document.definitions.some(
        (definition) =>
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'mutation'
      )
      // console.log('!!! isSubscription:', isSubscription, ' isMutation', isMutation)

      return {
        onExecuteDone(payload) {
          if (isSubscription) {
            // console.log("!!! Stop execution if it's a subscription so it doesn't try and resolve the results again", payload.result)
            // // Stop execution if it's a subscription so it doesn't try and resolve the results again
            // setResultAndStopExecution(payload.result);
          } else if (isMutation) {
            return handleStreamOrSingleExecutionResult(payload, ({ result }) => {
              const { operationName } = args

              if (!operationName) {
                console.log('No operation name provided. Skipping subscription responder.')
                return
              }

              switch (operationName) {
                case 'CreateCommentMutation': {
                  const resolvedComment = result.data?.createComment

                  if (resolvedComment) {
                    // TODO: Will need to switch on post vs parentComment
                    const postId = args?.contextValue?.variables?.postId
                    const channel = `createComment-forPostId-${postId}`

                    contextValue.pubSub.publish(channel, { commentAdded: resolvedComment })

                    console.log(`Published comment to channel ${channel}:`, resolvedComment)
                  } else {
                    console.warn('No resolved comment found for createComment mutation.')
                  }
                  break
                }

                default:
                  console.log(`No subscription handling for operation: ${operationName}`)
                  break
              }
            })
          }
        }
      }
    },
    // onSubscribe({ args }) {
    //   console.log('!!! onSubscribe', args)
    //   return {
    //     before({ setResultAndStopExecution }) {
    //       console.log('!!! onSubscribe - before', args)

    //       // setResultAndStopExecution({ test: 'test' })
    //     }
    //   }
    // }

    // onSubscribe({ args, context, extendContext }) {
    //   const { schema, document } = args;
  
    //   return {
    //     onExecute({ setResultAndStopExecution }) {
    //       return {
    //         onExecuteDone(payload) {
    //           return handleStreamOrSingleExecutionResult(payload, ({ result }) => {
    //             const isSubscription = document.definitions.some(
    //               (definition) =>
    //                 definition.kind === 'OperationDefinition' &&
    //                 definition.operation === 'subscription'
    //             );
  
    //             if (isSubscription) {
    //               // Stop further execution by directly returning the payload
    //               setResultAndStopExecution(result);
    //             }
    //           });
    //         },
    //       };
    //     },
    //   };
    // },
    // onSubscribe(params) {
    //   console.log('!!!! onSubscribe - args?.document?.definitions[0]?.selectionSet:', params)

    //   const { operationName, document } = args
    //   // const isSubscription = document.definitions.some(
    //   //   (def) => def.kind === 'OperationDefinition' && def.operation === 'subscription'
    //   // )

    //   switch (operationName) {
    //     case 'CreateCommentMutation': {
    //       setResult({
    //         onNext: (payload) => {
    //           const resolvedPayload = payload.commentAdded
    //           console.log('Publishing pre-resolved subscription payload:', resolvedPayload)
    //           return resolvedPayload
    //         }
    //       })
    //       break
    //     }

    //     default:
    //       console.log(No onSubscribe handling for operation: ${operationName})
    //       break
    //   }
    // }
  }
}

export default useMutationSubscriptionResponder
