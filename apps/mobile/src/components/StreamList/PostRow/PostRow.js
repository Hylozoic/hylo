import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useMutation } from 'urql'
import respondToEventMutation from '@hylo/graphql/mutations/respondToEventMutation'
import PostCard from 'components/PostCard'
import styles from './PostRow.styles'
import { useNavigation } from '@react-navigation/native'
import useGoToTopic from 'hooks/useGoToTopic'
import useChangeToGroup from 'hooks/useChangeToGroup'

export default function PostRow ({ context, post, forGroupId, showGroups }) {
  const navigation = useNavigation()
  const [, respondToEvent] = useMutation(respondToEventMutation)
  const handleGoToGroup = useChangeToGroup()
  const handleShowTopic = useGoToTopic()

  if (!post) return null

  const handleOnPress = () => navigation.navigate('Post Details', { id: post?.id })
  const handleRespondToEvent = response => respondToEvent({ id: post.id, response })
  const groupIds = post.groups.map(group => group.id)
  const isChildPost = (
    forGroupId !== 'all' &&
    forGroupId !== 'public' &&
    context !== 'my' &&
    forGroupId !== 'my' &&
    !groupIds.includes(forGroupId)
  )

  return (
    <View style={styles.postRow}>
      <TouchableOpacity
        activeOpacity={0.6}
        delayPressIn={50}
        onPress={handleOnPress}
      >
        <PostCard
          goToGroup={handleGoToGroup}
          post={post}
          onPress={handleOnPress}
          respondToEvent={handleRespondToEvent}
          showGroups={showGroups}
          showTopic={handleShowTopic}
          groupId={forGroupId}
          childPost={isChildPost}
        />
      </TouchableOpacity>
    </View>
  )
}
