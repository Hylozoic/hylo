import { useQuery, useMutation } from 'urql'
import topicFollowQuery from '@hylo/graphql/queries/topicFollowQuery'
import updateTopicFollowMutation from '@hylo/graphql/mutations/updateTopicFollowMutation'

/**
 * Hook to fetch and manage topic follow data for a specific group and topic
 * @param {Object} params - Query parameters
 * @param {string} params.groupId - Group ID
 * @param {string} params.topicName - Topic name
 * @param {Object} useQueryArgs - Additional urql useQuery arguments
 * @returns {Array} [topicFollow, { fetching, error, updateTopicFollow }]
 */
export default function useTopicFollow ({ groupId, topicName }, useQueryArgs = {}) {
  const [result, reQuery] = useQuery({
    query: topicFollowQuery,
    variables: { groupId, topicName },
    pause: !groupId || !topicName,
    ...useQueryArgs
  })

  const [updateResult, updateTopicFollow] = useMutation(updateTopicFollowMutation)

  const handleUpdateTopicFollow = async (data) => {
    if (!result.data?.topicFollow?.id) return null
    
    const updateResponse = await updateTopicFollow({
      id: result.data.topicFollow.id,
      data
    })
    
    return updateResponse?.data?.updateTopicFollow
  }

  return [
    result.data?.topicFollow,
    {
      fetching: result.fetching,
      error: result.error || updateResult.error,
      updateTopicFollow: handleUpdateTopicFollow,
      updating: updateResult.fetching,
      reQuery
    }
  ]
} 