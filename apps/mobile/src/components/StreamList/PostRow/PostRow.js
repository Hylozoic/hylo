import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useDispatch } from 'react-redux'
import respondToEvent from 'store/actions/respondToEvent'
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
  const dispatch = useDispatch()

  if (!post) return null

  const handleRespondToEvent = response => dispatch(respondToEvent(post, response))
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
          childPost={forGroupId !== 'all' && forGroupId !== 'public' && context !== 'my' && !groupIds.includes(forGroupId)}
        />
      </TouchableOpacity>
    </View>
  )
}
