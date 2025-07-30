import React, { useCallback, useMemo, useState } from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import { useNavigation } from '@react-navigation/native'
import useRecentActivity, { isPost, isComment, isReaction } from '@hylo/hooks/useRecentActivity'
import respondToEventMutation from '@hylo/graphql/mutations/respondToEventMutation'
import { modalScreenName } from 'hooks/useIsModalScreen'
import PostCard from 'components/PostCard'
import Comment from 'components/Comment'
import Loading from 'components/Loading'
import styles from './MemberStream.styles'

export default function MemberStream ({ id, header }) {
  const navigation = useNavigation()
  const [choice, setChoice] = useState('Posts')

  const [first] = useState(10)
  const [offset, setOffset] = useState(0)

  const [recentActivityItems, { fetching, error, hasMorePosts, hasMoreComments, hasMoreReactions }] = useRecentActivity({
    id,
    first,
    offset,
    order: 'desc'
  })

  const { items, hasMore } = useMemo(() => {
    switch (choice) {
      case 'Posts':
        const posts = recentActivityItems?.filter(isPost) || []
        return {
          items: posts,
          hasMore: hasMorePosts
        }
      case 'Comments':
        const comments = recentActivityItems?.filter(isComment) || []
        return {
          items: comments,
          hasMore: hasMoreComments
        }
      case 'Reactions':
        const reactions = recentActivityItems?.filter(isReaction) || []
        return {
          items: reactions,
          hasMore: hasMoreReactions
        }
      default:
        return { items: [], hasMore: false }
    }
  }, [choice, recentActivityItems, hasMorePosts, hasMoreComments, hasMoreReactions])

  const fetchMoreItems = useCallback(() => {
    if (hasMore && !fetching) {
      setOffset(prev => prev + first)
    }
  }, [hasMore, fetching, first])

  const showMember = id => navigation.navigate('Member', { id })
  const showPost = id => navigation.navigate(modalScreenName('Post Details'), { id })
  const showTopic = topicName => navigation.navigate('Stream', { topicName })

  if (error) {
    return (
      <View style={styles.superContainer}>
        <Text>Error loading data: {error.message}</Text>
      </View>
    )
  }

  return (
    <View style={styles.superContainer}>
      <FlashList
        contentContainerStyle={styles.container}
        data={items}
        estimatedItemSize={100}
        keyExtractor={item => item.id}
        ListFooterComponent={<FooterComponent pending={fetching} />}
        ListHeaderComponent={<HeaderComponent header={header} setChoice={setChoice} choice={choice} />}
        onEndReached={fetchMoreItems}
        renderItem={({ item }) => (
          <ContentRow
            item={item}
            itemType={choice.toLowerCase()}
            showPost={showPost}
            showTopic={showTopic}
            showMember={showMember}
          />
        )}
      />
    </View>
  )
}

export const HeaderComponent = ({
  choice,
  header,
  setChoice
}) => {
  const streamOptions = ['Posts', 'Comments', 'Reactions']
  const { t } = useTranslation()

  return (
    <View>
      {header}
      <View style={styles.streamTabs}>
        {streamOptions.map(option => (
          <StreamTab
            key={option}
            option={option}
            chosen={option === choice}
            onPress={() => setChoice(option)}
          />
        ))}
      </View>
    </View>
  )
}

export function FooterComponent ({ pending }) {
  return (
    <View style={styles.footer}>
      {pending && <Loading />}
    </View>
  )
}

export function ContentRow ({
  item,
  itemType,
  showPost: providedShowPost,
  showTopic,
  showMember
}) {
  const getPostId = () => {
    switch (itemType) {
      case 'posts':
        return item.id
      case 'comments':
        return item.post.id
      case 'reactions':
        return item.post.id
      default:
        return item.id
    }
  }

  const getDisplayItem = () => {
    if (itemType === 'reactions') {
      return item.post
    }
    return item
  }

  const displayItem = getDisplayItem()
  const showPost = () => providedShowPost(getPostId())
  const [, respondToEvent] = useMutation(respondToEventMutation)

  return (
    <TouchableOpacity onPress={showPost}>
      <View style={styles.contentRow}>
        {(itemType === 'posts' || itemType === 'reactions') && (
          <PostCard
            commenters={displayItem.commenters}
            creator={displayItem.creator}
            groups={displayItem.groups}
            onPress={showPost}
            post={displayItem}
            respondToEvent={response => respondToEvent({ id: displayItem?.id, response })}
            showGroups
            showMember={showMember}
            showTopic={showTopic}
            topics={displayItem.topics}
          />
        )}
        {itemType === 'comments' && (
          <Comment
            comment={displayItem}
            onPress={showPost}
            postTitle={displayItem.post.title}
          />
        )}
      </View>
    </TouchableOpacity>
  )
}

export function StreamTab ({ option, chosen, onPress }) {
  const { t } = useTranslation()
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={chosen ? styles.chosenOption : styles.option}>{t(option)}</Text>
    </TouchableOpacity>
  )
}
