import React, { useMemo, useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import { LocationHelpers } from '@hylo/shared'
import recordClickthroughMutation from '@hylo/graphql/mutations/recordClickthroughMutation'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import PostPresenter from '@hylo/presenters/PostPresenter'
import PostHeader from './PostHeader'
import PostBody from './PostBody'
import PostGroups from './PostGroups'
import PostFooter from './PostFooter'
import ImageAttachments from 'components/ImageAttachments'
import Files from 'components/Files'
import Icon from 'components/Icon'
import Topics from 'components/Topics'
import styles from 'components/PostCard/PostCard.styles'
import { useNavigation } from '@react-navigation/native'

export default function PostCard ({
  goToGroup,
  hideDetails,
  groupId,
  hideMenu,
  onPress,
  post: providedPost = {},
  respondToEvent,
  showGroups = true,
  childPost,
  showTopic: goToTopic
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [, recordClickthrough] = useMutation(recordClickthroughMutation)
  const post = useMemo(() => PostPresenter(providedPost, groupId), [providedPost])
  const images = useMemo(() => post.imageUrls && post.imageUrls.map(uri => ({ uri })), [post])
  const locationText = useMemo(() => LocationHelpers.generalLocationString(post.locationObject, post.location), [post])
  const isFlagged = useMemo(() => post.flaggedGroups && post.flaggedGroups.includes(groupId), [post])
  const [{ currentUser }] = useCurrentUser()
  const handleShowMember = id => navigation.navigate('Member', { id })

  return (
    <>
      {childPost && (
        <View style={styles.childPost}>
          <View style={styles.childPostInner}>
            <Icon name='Subgroup' style={styles.childPostIcon} /><Text style={styles.childPostText}>{' '}{t('post from child group')}</Text>
          </View>
        </View>
      )}
      <View style={styles.container}>
        <PostHeader
          announcement={post.announcement}
          creator={post.creator}
          currentUser={currentUser}
          date={post.createdAt}
          hideMenu={hideMenu}
          isFlagged={isFlagged}
          pinned={post.pinned}
          postId={post.id}
          showMember={handleShowMember}
          title={post.title}
          type={post.type}
        />
        {isFlagged && !post.clickthrough && (
          <View style={styles.clickthroughContainer}>
            <Text style={styles.clickthroughText}>{t('clickthroughExplainer')}</Text>
            <TouchableOpacity
              style={styles.clickthroughButton}
              onPress={() => recordClickthrough({ postId: post.id })}
            >
              <Text style={styles.clickthroughButtonText}>{t('View post')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {(!images || images.length === 0) && (
          <Topics
            topics={post.topics}
            onPress={t => goToTopic(t.name)}
            style={styles.topics}
          />
        )}
        {(images && images.length > 0) && !(isFlagged && !post.clickthrough) && (
          <ImageAttachments
            creator={post.creator}
            images={images}
            isFlagged={isFlagged && !post.clickthrough}
            onlyLongPress
            onPress={onPress}
            style={styles.images}
            title={post.title}
          >
            <Topics
              topics={post.topics}
              onPress={t => goToTopic(t.name)}
              style={[styles.topics, styles.topicsOnImage]}
            />
          </ImageAttachments>
        )}
        {!!locationText && (
          <View style={styles.locationRow}>
            <Icon style={styles.locationIcon} name='Location' />
            <Text style={styles.locationText} selectable>{locationText}</Text>
          </View>
        )}
        <PostBody
          details={post.details}
          post={post}
          currentUser={currentUser}
          endTime={post.endTimeRaw}
          hideDetails={hideDetails}
          isFlagged={isFlagged && !post.clickthrough}
          linkPreview={post.linkPreview}
          linkPreviewFeatured={post.linkPreviewFeatured}
          myEventResponse={post.myEventResponse}
          respondToEvent={respondToEvent}
          shouldTruncate
          startTime={post.startTimeRaw}
          title={post.title}
          type={post.type}
        />
        <Files urls={post.fileUrls} style={styles.files} />
        {showGroups && (
          <PostGroups
            goToGroup={goToGroup}
            groups={post.groups}
            includePublic={post.isPublic}
            style={styles.groups}
          />
        )}
        <PostFooter
          commenters={post.commenters}
          commentersTotal={post.commentersTotal}
          eventInvitations={post.eventInvitations}
          onPress={onPress}
          postId={post.id}
          members={post.members}
        />
      </View>
    </>
  )
}
