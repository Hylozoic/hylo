import React, { Component, PureComponent } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import styles from './FeedList.styles'
import PostCard from '../PostCard'
import Loading from '../Loading'
import Icon from '../Icon'
import PostDetails from '../PostDetails'
import { find } from 'lodash/fp'

export default class FeedList extends Component {
  componentDidMount () {
    this.props.fetchPosts()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.sortBy !== this.props.sortBy ||
        prevProps.filter !== this.props.filter) {
      this.props.fetchPosts()
    }

    const { navigate } = this.context
    if (typeof navigate === 'function') {
      navigate({title: 'Post', component: PostDetails, props: {id: '23805'}})
    }
  }

  render () {
    const { posts, fetchMorePosts, filter, sortBy, setFilter, setSort, pending, header } = this.props

    const listHeaderComponent = <View>
      {header}
      <ListControls
        filter={filter}
        sortBy={sortBy}
        setFilter={setFilter}
        setSort={setSort}
        pending={pending}
        />
      {pending && <Loading />}
    </View>

    return <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => <PostRow post={item} />}
        keyExtractor={(item, index) => item.id}
        onEndReached={fetchMorePosts}
        ListHeaderComponent={listHeaderComponent}
        />
    </View>
  }
}

export const filterOptions = [
  {id: 'all', label: 'All Posts'},
  {id: 'discussion', label: 'Discussions'},
  {id: 'request', label: 'Requests'},
  {id: 'offer', label: 'Offers'}
]

const sortOptions = [
  {id: 'updated', label: 'Latest'},
  {id: 'votes', label: 'Popular'}
]

const optionText = (id, options) => {
  const option = find(o => o.id === id, options) || options[0]
  return option.label
}

export function ListControls ({ filter, sortBy, setFilter, setSort }) {
  return <View style={styles.listControls}>
    <ListControl selected={filter} onChange={() => setFilter('request')} options={filterOptions} />
    <ListControl selected={sortBy} onChange={() => setSort('votes')} options={sortOptions} />
  </View>
}

export function ListControl ({ selected, options, onChange }) {
  // TODO: onPress should open a platform specific dropdown/sheet, which
  // calls onChange
  return <TouchableOpacity style={styles.listControl} onPress={onChange}>
    <Text style={styles.optionText}>{optionText(selected, options)}</Text>
    <Icon name='ArrowDown' style={[styles.optionText, styles.downArrow]} />
  </TouchableOpacity>
}

export class PostRow extends PureComponent {
  static contextTypes = {
    navigate: React.PropTypes.func
  }

  render () {
    const { post } = this.props
    const { navigate } = this.context

    const showPost = () =>
      navigate({title: 'Post', component: Post, props: {post}})

    return <View style={styles.postRow}>
      <TouchableOpacity onPress={showPost}>
        <PostCard post={post} />
      </TouchableOpacity>
    </View>
  }
}

/*

export function PostRow ({ post }, { navigate }) {
  const showPost = () =>
    navigate({title: 'Post', component: PostDetails, props: {id: post.id}})

  return <View style={styles.postRow}>
    <TouchableOpacity onPress={showPost}>
      <PostCard post={post} />
    </TouchableOpacity>
  </View>
}
PostRow.contextTypes = {navigate: React.PropTypes.func}

*/
