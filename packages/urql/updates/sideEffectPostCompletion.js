import { gql } from 'urql'

export function handleReactionPostCompletion (_results, args, cache, info) {
  const { entityId, entityType, completionAction } = args.data

  if (entityType !== 'post') return

  cache.writeFragment(postCompletionFragment, {
    id: entityId,
    __typename: 'Post',
    completionAction,
    completedAt: new Date().toISOString()
  })
}

const postCompletionFragment = gql`
  fragment PostCompletion on Post {
    id
    completionAction
    completedAt
  }
`
