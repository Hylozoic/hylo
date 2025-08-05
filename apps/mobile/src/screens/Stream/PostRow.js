import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useMutation } from 'urql'
import { ALL_GROUPS_CONTEXT_SLUG, MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG } from '@hylo/navigation'
import respondToEventMutation from '@hylo/graphql/mutations/respondToEventMutation'
import PostCard from 'components/PostCard'
import { useNavigation } from '@react-navigation/native'
import { modalScreenName } from 'hooks/useIsModalScreen'
import useGoToTopic from 'hooks/useGoToTopic'

export default function PostRow ({ context, post, forGroupId, showGroups }) {
  const navigation = useNavigation()
  const [, respondToEvent] = useMutation(respondToEventMutation)
  const handleShowTopic = useGoToTopic()

  if (!post) return null

  const handleOnPress = () => navigation.navigate(modalScreenName('Post Details'), { id: post?.id })
  const handleRespondToEvent = response => respondToEvent({ id: post.id, response })
  const groupIds = post.groups.map(group => group.id)
  const isChildPost = (
    forGroupId !== ALL_GROUPS_CONTEXT_SLUG &&
    forGroupId !== PUBLIC_CONTEXT_SLUG &&
    context !== MY_CONTEXT_SLUG &&
    forGroupId !== MY_CONTEXT_SLUG &&
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

const styles = StyleSheet.create({
  postRow: {
    paddingBottom: 12,
    marginRight: 0,
    marginLeft: 0
  }
})
