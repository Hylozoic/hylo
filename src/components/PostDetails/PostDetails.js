/* eslint-disable camelcase */
import React from 'react'
import { Linking, View, Text, TouchableOpacity, Alert } from 'react-native'
import { get, isEmpty, find } from 'lodash/fp'
import { shape, any, object, string, func, array, bool } from 'prop-types'
import Comments from '../Comments'
import PostBody from '../PostCard/PostBody'
import PostCommunities from '../PostCard/PostCommunities'
import PostImage from '../PostCard/PostImage'
import PostFooter from '../PostCard/PostFooter'
import PostHeader from '../PostCard/PostHeader'
import ProjectMembersSummary from '../ProjectMembersSummary'
import { LoadingScreen } from '../Loading'
import Button from '../Button'
import SocketSubscriber from '../SocketSubscriber'
import { FileLabel } from '../PostEditor/FileSelector'
import InlineEditor, { toHtml } from '../InlineEditor'
import KeyboardFriendlyView from '../KeyboardFriendlyView'
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
    pending: bool,
    showMember: func,
    showTopic: func
  }

  state = {
    commentText: ''
  }

  static navigationOptions = ({ navigation }) => {
    return {
      headerTitle: 'Detail'
    }
  }

  componentDidMount () {
    this.props.fetchPost()
  }

  shouldComponentUpdate (nextProps) {
    return !!nextProps.isFocused
  }

  handleShowMember = (memberId) => this.props.showMember(memberId)

  handleShowTopic = (topicId) => this.props.showTopic(topicId, get('post.communities.0.id', this.props))

  handleGoToCommunity = (communityId) => this.props.goToCommunity(communityId)

  handleCreateComment = (commentText) => {
    const commentTextAsHtml = toHtml(commentText)

    if (!isEmpty(commentTextAsHtml)) {
      this.setState(() => ({ submitting: true }))
      return this.props.createComment(commentTextAsHtml)
        .then(({ error }) => {
          if (error) {
            Alert.alert("Your comment couldn't be saved; please try again.")
            this.setState(() => ({ submitting: false }))
          } else {
            this.setState(() => ({ commentText: '', submitting: false }))
            // Scrolls to the last comment (the one that was created)
            this.refs.comments.getWrappedInstance().scrollToEnd()
          }
        })
    }
  }

  handleCommentOnChange = (commentText) => {
    this.setState(() => ({ commentText }))
  }

  render () {
    const {
      post,
      currentUser,
      editPost,
      pending,
      isProject,
      joinProject,
      leaveProject,
      goToMembers
    } = this.props

    const {
      commentText,
      submitting
    } = this.state

    if (!post || !post.creator || !post.title) return <LoadingScreen />

    const slug = get('communities.0.slug', post)
    const communityId = get('communities.0.id', post)
    const isMember = find(member => member.id === currentUser.id, post.members)
    const location = post.location || (post.locationObject && post.locationObject.fullText)

    const postCard = <View style={styles.postCard}>
      <PostHeader
        creator={post.creator}
        date={post.createdAt}
        type={post.type}
        editPost={editPost}
        communities={post.communities}
        slug={slug}
        pinned={post.pinned}
        topics={post.topics}
        showTopic={this.handleShowTopic}
        postId={post.id}
        showMember={this.handleShowMember}
        goToCommunity={this.handleGoToCommunity}
        announcement={post.announcement}
        closeOnDelete
      />
      <PostImage imageUrls={post.imageUrls} linked />
      <PostBody
        type={post.type}
        title={post.title}
        details={post.details}
        startTime={post.startTime}
        endTime={post.endTime}
        linkPreview={post.linkPreview}
        slug={slug}
        showMember={this.handleShowMember}
        showTopic={this.handleShowTopic} />
      {isProject &&
        <ProjectMembersSummary
          members={post.members}
          onPress={goToMembers}
          dimension={34}
          style={styles.projectMembersContainer} />}
      <PostCommunities
        communities={post.communities}
        slug={slug}
        goToCommunity={this.handleGoToCommunity}
        shouldShowCommunities />
      {!!location && <View style={[styles.infoRow, styles.bottomInfoRow]}>
        <Text style={styles.infoRowLabel}>Location:</Text>
        <Text style={styles.infoRowinfo}>{location}</Text>
      </View>}
      {!isEmpty(post.fileUrls) && <Files urls={post.fileUrls} />}
      {isProject && <JoinProjectButton onPress={isMember ? leaveProject : joinProject} leaving={isMember} />}
      <PostFooter id={post.id}
        currentUser={currentUser}
        commenters={post.commenters}
        commentsTotal={post.commentsTotal}
        votesTotal={post.votesTotal}
        myVote={post.myVote}
        showActivityLabel />
    </View>

    return <KeyboardFriendlyView style={styles.container}>
      <Comments
        ref='comments'
        header={postCard}
        footer={<CommentPrompt
          currentUser={currentUser}
          communityId={communityId}
          submitting={submitting}
          onChange={this.handleCommentOnChange}
          onSubmit={this.handleCreateComment}
          commentText={commentText} />
        }
        postId={post.id}
        postPending={pending}
        showMember={this.handleShowMember}
        showTopic={this.handleShowTopic}
        slug={slug} />
      <SocketSubscriber type='post' id={post.id} />
    </KeyboardFriendlyView>
  }
}

export function CommentPrompt ({ currentUser, onChange, onSubmit, submitting, commentText, communityId }) {
  if (!currentUser) return null

  return <InlineEditor
    onChange={onChange}
    onSubmit={onSubmit}
    value={commentText}
    containerStyle={styles.inlineEditor}
    submitting={submitting}
    placeholder={'Write a comment...'}
    communityId={communityId}
  />
}

export function Files ({ urls }) {
  return <View style={styles.files}>
    {urls.map(url =>
      <TouchableOpacity key={url} onPress={openUrlFn(url)}>
        <FileLabel url={url} />
      </TouchableOpacity>
    )}
  </View>
}

const openUrlFn = url => () =>
  Linking.canOpenURL(url).then(ok => ok && Linking.openURL(url))

export function JoinProjectButton ({ onPress, leaving }) {
  const text = leaving ? 'Leave Project' : 'Join Project'
  return <Button
    style={styles.joinButton}
    text={text}
    onPress={onPress} />
}
