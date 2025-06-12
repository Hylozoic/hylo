import { gql } from 'urql'

const postCompletionReadFragment = gql`
  fragment PostCompletionRead on Post {
    id
    completionAction
  }
`

export function handleReactionPostCompletion (_results, args, cache, info) {
  const { entityId, entityType, completionAction } = args.data
  if (entityType !== 'post') return

  // Read the current post data from cache
  const postData = cache.readFragment(postCompletionReadFragment, { id: entityId })
  if (!postData || postData.completionAction !== 'reaction') return

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
