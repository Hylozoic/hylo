import React, { Component } from 'react'
import { View } from 'react-native'
import FeedList from '../FeedList'
import FeedBanner from '../FeedBanner'
import styles from './Feed.styles'

export default class Feed extends Component {
  render () {
    const {
      community,
      currentUser,
      newPost,
      showPost,
      editPost,
      showMember,
      showTopic
    } = this.props

    return <View style={styles.container}>
      <FeedList
        community={community}
        showPost={showPost}
        editPost={editPost}
        showMember={showMember}
        showTopic={showTopic}
        showCommunities={!community}
        header={
          <FeedBanner community={community} currentUser={currentUser}
            all={!community} newPost={newPost} />
        } />
    </View>
  }
}
