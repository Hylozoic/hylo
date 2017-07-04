/* eslint-disable camelcase */
import React from 'react'
import { View, Text } from 'react-native'
import PostHeader from '../PostCard/PostHeader'
import PostBody from '../PostCard/PostBody'
import SpaceFillingImage from '../SpaceFillingImage'
import PostFooter from '../PostCard/PostFooter'
import Comments from '../Comments'
import { get } from 'lodash/fp'
const { shape, any, object, string, func, array, bool } = React.PropTypes
import styles from './PostDetails.styles'

export default class PostDetails extends React.Component {
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
    editPost: func,
    pending: bool
  }

  componentDidMount () {
    this.props.fetchPost()
  }

  render () {
    const {
      post,
      currentUser,
      editPost,
      pending
    } = this.props
    const slug = get('0.slug', post.communities)

    const { location } = post

    const postCard = <View style={styles.postCard}>
      <PostHeader creator={post.creator}
        date={post.updatedAt || post.createdAt}
        type={post.type}
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
      {!!location && <View style={[styles.infoRow, styles.bottomInfoRow]}>
        <Text style={styles.infoRowLabel}>Location:</Text>
        <Text style={styles.infoRowinfo}>{location}</Text>
      </View>}
      <PostFooter id={post.id}
        currentUser={currentUser}
        commenters={post.commenters}
        commentsTotal={post.commentsTotal}
        votesTotal={post.votesTotal}
        myVote={post.myVote}
        showActivityLabel />
    </View>

    return <View style={styles.container}>
      <Comments
        header={postCard}
        postId={post.id}
        postPending={pending} />
    </View>
  }
}
