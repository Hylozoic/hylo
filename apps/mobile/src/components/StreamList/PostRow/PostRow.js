import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useMutation } from 'urql'
import respondToEventMutation from 'frontend-shared/graphql/mutations/respondToEventMutation'
import PostCard from 'components/PostCard'
import styles from './PostRow.styles'

export default function PostRow ({
  context,
  post,
  goToGroup,
  forGroupId,
  showGroups,
  showMember,
  showPost,
  showTopic
}) {
  const [, respondToEvent] = useMutation(respondToEventMutation)

  if (!post) return null

  const handleRespondToEvent = response => respondToEvent({ id: post.id, response })
  const groupIds = post.groups.map(group => group.id)

  return (
    <View style={styles.postRow}>
      <TouchableOpacity
        activeOpacity={0.6}
        delayPressIn={50}
        onPress={() => showPost(post.id)}
      >
        <PostCard
          goToGroup={goToGroup}
          post={post}
          onPress={() => showPost(post.id)}
          respondToEvent={handleRespondToEvent}
          showGroups={showGroups}
          showMember={showMember}
          showTopic={showTopic}
          groupId={forGroupId}
          childPost={forGroupId !== 'all' && forGroupId !== 'public' && context !== 'my' && forGroupId !== 'my' && !groupIds.includes(forGroupId)}
        />
      </TouchableOpacity>
    </View>
  )
}
