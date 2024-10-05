import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import respondToEvent from 'store/actions/respondToEvent'
import { getPresentedPost } from 'store/selectors/getPost'
import PostCard from 'components/PostCard'
import styles from './PostRow.styles'

export default function PostRow ({
  context,
  goToGroup,
  postId,
  forGroupId,
  showGroups,
  showMember,
  showPost,
  showTopic
}) {
  const dispatch = useDispatch()
  const post = useSelector(state => getPresentedPost(state, { postId, forGroupId }))
  const groupIds = post.groups.map(group => group.id)
  const handleRespondToEvent = response => dispatch(respondToEvent(post, response))

  if (!post) return null

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
