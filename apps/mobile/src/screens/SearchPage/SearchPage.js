import React from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native'
import Loading from 'components/Loading'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import UnwrappedPostCard from 'components/PostCard'
import PostHeader from 'components/PostCard/PostHeader'
import { PostTitle } from 'components/PostCard/PostBody/PostBody'
import UnwrappedCommentCard from 'components/Comment'
import styles from './SearchPage.styles'
import { useTranslation } from 'react-i18next'

export default class SearchPage extends React.Component {
  state = {
    refreshing: false
  }

  componentDidMount () {
    this.props.fetchSearchResults()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.searchTerm !== this.props.searchTerm ||
      prevProps.filter !== this.props.filter) {
      this.props.fetchSearchResults()
    }
    if (prevProps.pending && !this.props.pending) {
      this.setState({
        refreshing: false
      })
    }
  }

  fetchMore = () => {
    const { pending } = this.props
    if (pending) return null
    this.props.fetchMoreSearchResults()
  }

  handleRefresh = () => {
    const { refreshing } = this.state
    if (refreshing) return null
    this.setState({ refreshing: true })
    this.props.fetchSearchResults()
  }

  render () {
    const {
      searchResults, searchTerm, setSearchTerm, pending, goToPost, goToPerson,
      filter, setSearchFilter
    } = this.props
    const { refreshing } = this.state

    const listHeaderComponent = (
      <View>
        <View style={styles.searchBar}>
          <View style={styles.searchBox}>
            <Icon name='Search' style={styles.searchIcon} />
            <TextInput
              value={searchTerm}
              onChangeText={text => setSearchTerm(text)}
              style={styles.textInput}
              autoCapitalize='none'
              autoCorrect={false}
              underlineColorAndroid='transparent'
            />
          </View>
        </View>
        <TabBar filter={filter} setSearchFilter={setSearchFilter} />
      </View>
    )

    const listFooterComponent = pending
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
          onRefresh={this.handleRefresh}
          refreshing={refreshing}
          keyExtractor={(item) => item.id}
          onEndReached={() => this.fetchMore()}
          ListHeaderComponent={listHeaderComponent}
          ListFooterComponent={listFooterComponent}
        />
      </View>
    )
  }
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
  const { type, content } = searchResult

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
      {resultComponent(type)}
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
