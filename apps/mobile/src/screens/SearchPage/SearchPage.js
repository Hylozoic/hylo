import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Pressable } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { gql, useQuery } from 'urql'
import { debounce } from 'lodash/fp'
import postFieldsFragment from '@hylo/graphql/fragments/postFieldsFragment'
import Loading from 'components/Loading'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import UnwrappedPostCard from 'components/PostCard'
import PostHeader from 'components/PostCard/PostHeader'
import { PostTitle } from 'components/PostCard/PostBody/PostBody'
import UnwrappedCommentCard from 'components/Comment'
import styles from './SearchPage.styles'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { useNavigation } from '@react-navigation/native'

const searchQuery = gql`
  query SearchQuery ($search: String, $type: String, $offset: Int, $first: Int = 2) {
    search(term: $search, first: $first, type: $type, offset: $offset) {
      total
      hasMore
      items {
        id
        content {
          contentTypeName: __typename
          ... on Person {
            id
            name
            location
            avatarUrl
            skills {
              items {
                id
                name
              }
            }
          }
          ... on Post {
            ...PostFieldsFragment
          }
          ... on Comment {
            id
            text
            createdAt
            creator {
              id
              name
              avatarUrl
            }
            post {
              id
              title
              type
              creator {
                id
                name
                avatarUrl
              }
            }
            attachments {
              id
              url
              type
            }
          }
        }
      }
    }
  }
  ${postFieldsFragment}
`

const SEARCH_TABS = [
  { id: 'all', label: 'All' },
  { id: 'post', label: 'Discussions' },
  { id: 'person', label: 'People' },
  { id: 'comment', label: 'Comments' }
]

export const DEFAULT_SEARCH_TYPE = 'all'

export default function SearchPage () {
  const navigation = useNavigation()
  const [searchString, providedSetSearchString] = useState(null)
  const [offset, setOffset] = useState(0)

  const [searchType, setSearchType] = useState(DEFAULT_SEARCH_TYPE)
  const setSearchString = debounce(300, newSearchString => providedSetSearchString(newSearchString))

  useEffect(() => {
    setOffset(0)
  }, [searchType])

  const [{ data, fetching }] = useQuery({
    query: searchQuery,
    variables: {
      search: searchString,
      type: searchType,
      offset,
      first: searchType === 'person' ? 10 : 2
    },
    pause: !searchString
  })

  const { items: searchResults, hasMore } = useMemo(() => ({
    items: data?.search?.items || [],
    hasMore: data?.search?.hasMore || false
  }), [data?.search])

  const fetchMore = useCallback(() => {
    if (hasMore && !fetching) {
      setOffset(searchResults?.length)
    }
  }, [hasMore, fetching])

  const handleRefresh = async () => {
    setOffset(0)
  }

  // TODO: Fix back links on Home Tab when navigating this way,
  // currently causes a crash if trying to go back from Post Details or Member
  const goToPost = useCallback(id => navigation.navigate(modalScreenName('Post Details'), { id }), [navigation])
  const goToPerson = useCallback(id => navigation.navigate(modalScreenName('Member'), { id }), [navigation])

  const renderItem = useCallback(
    ({ item }) => (
      <SearchResult
        searchResult={item}
        goToPost={goToPost}
        goToPerson={goToPerson}
      />
    ),
    [goToPost, goToPerson]
  )

  const listFooterComponent = useMemo(
    () => (offset > 0 && fetching) && (
      <Loading style={styles.loading} />
    ),
    [fetching]
  )

  return (
    <View style={styles.flatListContainer}>
      <SearchHeader
        searchType={searchType}
        setSearchType={setSearchType}
        searchString={searchString}
        setSearchString={setSearchString}
      />
      {(offset === 0 && fetching) && (
        <Loading style={styles.loading} />
      )}
      <FlashList
        data={searchResults}
        estimatedItemSize={100}
        renderItem={renderItem}
        onRefresh={handleRefresh}
        refreshing={offset > 0 && fetching}
        keyExtractor={(item) => item.id}
        onEndReached={() => fetchMore()}
        ListFooterComponent={listFooterComponent}
      />
    </View>
  )
}

const SearchHeader = React.memo(
  ({
    searchType,
    setSearchType,
    searchString: providedSearchString,
    setSearchString: providedSetSearchString
  }) => {
    const [searchString, setSearchString] = useState(providedSearchString)
    const handleSearchString = useCallback(newSearchString => {
      setSearchString(newSearchString)
      providedSetSearchString(newSearchString)
    })

    return (
      <View>
        <View style={styles.searchBar}>
          <View style={styles.searchBox}>
            <Icon name='Search' style={styles.searchIcon} />
            <TextInput
              value={searchString}
              onChangeText={handleSearchString}
              style={styles.textInput}
              autoCapitalize='none'
              autoCorrect={false}
              underlineColorAndroid='transparent'
            />
          </View>
        </View>
        <TabBar selectedId={searchType} onTabPressIn={setSearchType} />
      </View>
    )
  }
)

export const TabBar = React.memo(
  ({ selectedId, onTabPressIn }) => {
    const { t } = useTranslation()
    // Explicit invocations of dynamic values
    t('All')
    t('Discussions')
    t('People')
    t('Comments')

    return (
      <View style={styles.tabBar}>
        {SEARCH_TABS.map(({ id, label }) => (
          <Pressable
            onPress={() => onTabPressIn(id)}
            hitSlop={{ top: 10, bottom: 15, left: 15, right: 15 }}
            key={id}
          >
            {({ pressed }) => (
              <Text style={[styles.tab, (pressed || (id === selectedId)) && styles.active]}>{label}</Text>
            )}
          </Pressable>
        ))}
      </View>
    )
  }
)

const SearchResult = React.memo(
  ({ searchResult, goToPost, goToPerson }) => {
    const { content } = searchResult

    const resultComponent = (type) => {
      switch (type) {
        case 'Person':
          return <PersonCard person={content} goToPerson={goToPerson} />
        case 'Post':
          return <PostCard post={content} goToPost={goToPost} />
        case 'Comment':
          return <CommentCard comment={content} goToPost={goToPost} />
      }
    }

    return resultComponent(content?.contentTypeName)
  }
)

export function PersonCard ({ person, goToPerson }) {
  const { id, avatarUrl, name, location } = person
  return (
    <TouchableOpacity onPress={() => goToPerson(id)} style={styles.personResult}>
      <Avatar avatarUrl={avatarUrl} style={styles.avatar} />
      <View style={styles.nameAndLocation}>
        <Text style={styles.name}>{name}</Text>
        {location?.length > 0 && <Text style={styles.location}>{location}</Text>}
      </View>
    </TouchableOpacity>
  )
}

export function PostCard ({ post, goToPost }) {
  const goToThisPost = () => goToPost(post.id)
  const { creator, groups } = post
  return (
    <TouchableOpacity onPress={goToThisPost} style={styles.postResult}>
      <UnwrappedPostCard
        creator={creator}
        showDetails={goToThisPost}
        showMember={goToThisPost}
        goToGroup={goToThisPost}
        onPress={goToThisPost}
        post={post}
        groups={groups}
        hideMenu
        hideDetails
        showGroups
      />
    </TouchableOpacity>
  )
}

export function CommentCard ({ comment, goToPost }) {
  const { post } = comment
  const goToThisPost = () => goToPost(post.id)

  return (
    <TouchableOpacity onPress={goToThisPost} style={styles.commentResult}>
      <View style={styles.commentPostHeader}>
        <PostHeader
          postId={post.id}
          creator={post.creator}
          date={post.createdAt}
          type={post.type}
          pinned={post.pinned}
          showMember={goToThisPost}
          showTopic={goToThisPost}
          goToGroup={goToThisPost}
          announcement={post.announcement}
          hideMenu
          smallAvatar
        />
        <PostTitle title={post.title} style={styles.postTitle} />
      </View>
      <View style={styles.commentDivider} />
      <UnwrappedCommentCard
        comment={comment}
        showMember={goToThisPost}
        showTopic={goToThisPost}
      />
    </TouchableOpacity>
  )
}
