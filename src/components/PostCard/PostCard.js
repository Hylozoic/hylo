/* eslint-disable camelcase */
import React from 'react'
import { View } from 'react-native'
import PostHeader from './PostHeader'
import PostBody from './PostBody'
import SpaceFillingImage from '../SpaceFillingImage'
import PostFooter from './PostFooter'
import samplePost from './samplePost'
import { get } from 'lodash/fp'

const { shape, any, object, string, func, array, bool } = React.PropTypes

export default class PostCard extends React.Component {
  static propTypes = {
    post: shape({
      id: any,
      type: string,
      creator: object,
      imageUrl: string,
      name: string,
      details: string,
      commenters: array,
      upVotes: string,
      updatedAt: string
    }),
    currentUser: shape({
      id: any,
      name: string,
      avatarUrl: string
    }),
    fetchPost: func,
    expanded: bool,
    showDetails: func,
    editPost: func,
    showCommunity: bool
  }

  static defaultProps = {
    post: samplePost()
  }

  render () {
    const {
      post, showDetails, editPost, showCommunity, currentUser
    } = this.props
    const slug = get('0.slug', post.communities)

    return <View style={styles.container}>
      <PostHeader creator={post.creator}
        date={post.updatedAt || post.createdAt}
        type={post.type}
        showCommunity={showCommunity}
        editPost={editPost}
        communities={post.communities}
        slug={slug}
        id={post.id} />
      <View style={post.imageUrl ? styles.imageMargin : {}}>
        <SpaceFillingImage imageUrl={post.imageUrl} />
      </View>
      <PostBody title={post.title}
        details={post.details}
        linkPreview={post.linkPreview} />
      <PostFooter id={post.id}
        currentUser={currentUser}
        commenters={post.commenters}
        commentsTotal={post.commentsTotal}
        votesTotal={post.votesTotal}
        myVote={post.myVote} />
    </View>
  }
}

const styles = {
  container: {
    borderWidth: 1,
    borderColor: '#EAEBEB',
    borderRadius: 2,
    backgroundColor: 'white',
    marginLeft: 8, // TODO: remove this, let the wrapper handle this
    marginRight: 8 // TODO: remove this, let the wrapper handle this
  },
  imageMargin: {
    marginBottom: 12
  }
}
