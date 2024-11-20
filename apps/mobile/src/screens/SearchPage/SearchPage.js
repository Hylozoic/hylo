import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { gql, useQuery } from 'urql'
import postFieldsFragment from 'graphql/fragments/postFieldsFragment'
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
  query SearchQuery ($search: String, $type: String, $offset: Int) {
    search(term: $search, first: 10, type: $type, offset: $offset) {
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

export default function SearchPage () {
  const navigation = useNavigation()
  const [refreshing, setRefreshing] = useState(false)
  const [searchString, setSearchString] = useState('')
  const [searchFilter, setSearchFilter] = useState('all')
  const [offset, setOffset] = useState(0)

  const [{ data, fetching, error }, refetchQuery] = useQuery({
    query: searchQuery,
    variables: {
      search: searchString,
      type: searchFilter,
      offset
    }
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
    setRefreshing(true)
    await refetchQuery()
    setRefreshing(false)
  }

  useEffect(() => {
    if (!fetching) setRefreshing(false)
  }, [fetching])

  // TODO: Fix back links on Home Tab when navigating this way,
  // currently causes a crash if trying to go back from Post Details or Member
  const goToPost = id => navigation.navigate(modalScreenName('Post Details'), { id })
  const goToPerson = id => navigation.navigate(modalScreenName('Member'), { id })

  const listHeaderComponent = (
    <View>
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Icon name='Search' style={styles.searchIcon} />
          <TextInput
            value={searchString}
            onChangeText={text => setSearchString(text)}
            style={styles.textInput}
            autoCapitalize='none'
            autoCorrect={false}
            underlineColorAndroid='transparent'
          />
        </View>
      </View>
      <TabBar filter={searchFilter} setSearchFilter={type => setSearchFilter(type)} />
    </View>
  )

  const listFooterComponent = fetching
    ? <Loading style={styles.loading} />
    : null

  return (
    <View style={styles.flatListContainer}>
      <FlatList
        data={searchResults}
        renderItem={({ item }) =>
          <SearchResult
            searchResult={item}
            goToPost={goToPost}
            goToPerson={goToPerson}
          />}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        keyExtractor={(item) => item.id}
        onEndReached={() => fetchMore()}
        ListHeaderComponent={listHeaderComponent}
        ListFooterComponent={listFooterComponent}
      />
    </View>
  )
}

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'post', label: 'Discussions' },
  { id: 'person', label: 'People' },
  { id: 'comment', label: 'Comments' }
]

export function TabBar ({ filter, setSearchFilter }) {
  const { t } = useTranslation()
  // Explicit invocations of dynamic values
  t('All')
  t('Discussions')
  t('People')
  t('Comments')

  return (
    <View style={styles.tabBar}>
      {tabs.map(({ id, label }) => (
        <Tab
          filter={filter}
          id={id}
          key={id}
          label={t(label)}
          setSearchFilter={setSearchFilter}
        />
      ))}
    </View>
  )
}

export function Tab ({ id, label, filter, setSearchFilter }) {
  return (
    <TouchableOpacity
      onPress={() => setSearchFilter(id)}
      hitSlop={{ top: 10, bottom: 15, left: 15, right: 15 }}
    >
      <Text style={[styles.tab, (filter === id) && styles.active]}>{label}</Text>
    </TouchableOpacity>
  )
}

export function SearchResult ({ searchResult, goToPost, goToPerson }) {
  const { content } = searchResult

  const resultComponent = type => {
    switch (type) {
      case 'Person':
        return <PersonCard person={content} goToPerson={goToPerson} />
      case 'Post':
        return <PostCard post={content} goToPost={goToPost} />
      case 'Comment':
        return <CommentCard comment={content} expanded={false} goToPost={goToPost} />
    }
  }
  return (
    <View style={styles.searchResult}>
      {resultComponent(content?.contentTypeName)}
    </View>
  )
}

export function PersonCard ({ person, goToPerson }) {
  const { id, avatarUrl, name, location } = person
  return (
    <TouchableOpacity onPress={() => goToPerson(id)}>
      <View style={styles.personCard}>
        <Avatar avatarUrl={avatarUrl} style={styles.avatar} />
        <View style={styles.nameAndLocation}>
          <Text style={styles.name}>{name}</Text>
          {location?.length > 0 && <Text style={styles.location}>{location}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export function PostCard ({ post, goToPost }) {
  const goToThisPost = () => goToPost(post.id)
  const { creator, groups } = post
  return (
    <TouchableOpacity onPress={goToThisPost} style={styles.postWrapper}>
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
    <TouchableOpacity onPress={goToThisPost} style={styles.commentWrapper}>
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
