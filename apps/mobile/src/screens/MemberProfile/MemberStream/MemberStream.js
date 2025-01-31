import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View, TouchableOpacity, FlatList } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, gql } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { personPostsQuerySetFragment } from '@hylo/graphql/fragments/postsQuerySetFragment'
import respondToEventMutation from '@hylo/graphql/mutations/respondToEventMutation'
import PostCard from 'components/PostCard'
import Comment from 'components/Comment'
import Loading from 'components/Loading'
import styles from './MemberStream.styles'
import useChangeToGroup from 'hooks/useChangeToGroup'
import { modalScreenName } from 'hooks/useIsModalScreen'

export const personPostsQuery = gql`
  query PersonPostsQuery (
    $activePostsOnly: Boolean,
    $afterTime: Date,
    $announcementsOnly: Boolean,
    $beforeTime: Date,
    $boundingBox: [PointInput],
    $collectionToFilterOut: ID,
    $context: String,
    $createdBy: [ID],
    $filter: String,
    $first: Int,
    $forCollection: ID,
    $groupSlugs: [String],
    $id: ID,
    $interactedWithBy: [ID],
    $isFulfilled: Boolean,
    $mentionsOf: [ID],
    $offset: Int,
    $order: String,
    $search: String,
    $sortBy: String,
    $topic: ID,
    $topics: [ID],
    $types: [String]
  ) {
    person (id: $id) {
      id
      ...PersonPostsQuerySetFragment
    }
  }
  ${personPostsQuerySetFragment}
`

export const personCommentsQuery = gql`
  query PersonCommentsQuery ($id: ID, $first: Int, $offset: Int) {
    person (id: $id) {
      id
      comments (first: $first, offset: $offset, order: "desc") {
        hasMore
        items {
          id
          text
          creator {
            id
          }
          post {
            id
            title
          }
          createdAt
        }
      }
    }
  }
`

export const personUpvotesQuery = gql`
  query PersonVotesQuery ($id: ID, $first: Int, $offset: Int) {
    person (id: $id) {
      id
      votes (first: $first, offset: $offset, order: "desc") {
        hasMore
        items {
          id
          post {
            id
            title
            details
            type
            creator {
              id
              name
              avatarUrl
            }
            commenters {
              id,
              name,
              avatarUrl
            }
            commentersTotal
            groups {
              id
              name
            }
            createdAt
          }
          voter {
            id
          }
          createdAt
        }
      }
    }
  }
`

export default function MemberStream ({ id, header }) {
  const navigation = useNavigation()
  const [choice, setChoice] = useState('Posts')

  const [itemType, query] = useMemo(() => {
    switch (choice) {
      case 'Posts':
        return ['posts', personPostsQuery]
      case 'Comments':
        return ['comments', personCommentsQuery]
      case 'Upvotes':
        return ['upvotes', personUpvotesQuery]
    }
  }, [choice])

  const [offset, setOffset] = useState(0)
  const [{ data, fetching }] = useQuery({ query, variables: { id, offset, first: 5 } })
  const { items, hasMore } = useMemo(() => {
    if (!data?.person[itemType]) return { items: [], hasMore: false }
    return {
      items: data?.person[itemType]?.items || [],
      hasMore: data?.person[itemType]?.hasMore || false
    }
  }, [itemType, data, fetching])

  const fetchMoreItems = useCallback(() => {
    if (hasMore && !fetching) {
      setOffset(items?.length)
    }
  }, [hasMore, fetching])

  const changeToGroup = useChangeToGroup()
  const showMember = id => navigation.navigate('Member', { id })
  const showPost = id => navigation.navigate(modalScreenName('Post Details'), { id })
  const showTopic = topicName => navigation.navigate('Stream', { topicName })

  return (
    <View style={styles.superContainer}>
      <FlatList
        contentContainerStyle={styles.container}
        data={items}
        keyExtractor={item => item.id}
        ListFooterComponent={<FooterComponent pending={fetching} />}
        ListHeaderComponent={<HeaderComponent header={header} setChoice={setChoice} choice={choice} />}
        onEndReached={fetchMoreItems}
        renderItem={({ item }) => (
          <ContentRow
            item={item}
            itemType={itemType}
            showPost={showPost}
            showTopic={showTopic}
            showMember={showMember}
            goToGroup={changeToGroup}
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
  const streamOptions = ['Posts', 'Comments', 'Upvotes']
  const { t } = useTranslation()
  // explicit invocation of dynamic content
  t('Posts')
  t('Comments')
  t('Upvotes')

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
  showMember,
  goToGroup
}) {
  const showPost = () => providedShowPost(itemType === 'posts' ? item.id : item.post.id)
  // respondToEventMutation params: id, response
  const [, respondToEvent] = useMutation(respondToEventMutation)

  return (
    <TouchableOpacity onPress={showPost}>
      <View style={styles.contentRow}>
        {itemType === 'posts' && (
          <PostCard
            commenters={item.commenters}
            creator={item.creator}
            goToGroup={goToGroup}
            groups={item.groups}
            onPress={showPost}
            post={item}
            respondToEvent={response => respondToEvent({ id: item?.id, response })}
            showGroups
            showMember={showMember}
            showTopic={showTopic}
            topics={item.topics}
          />
        )}
        {itemType !== 'posts' && (
          <Comment
            comment={item}
            onPress={showPost}
            postTitle={item.post.title}
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
