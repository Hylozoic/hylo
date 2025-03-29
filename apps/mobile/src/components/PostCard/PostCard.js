import React, { useMemo } from 'react'
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
import { useNavigation } from '@react-navigation/native'

export default function PostCard ({
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
  const post = useMemo(() => PostPresenter(providedPost, { forGroupId: groupId }), [providedPost])
  const images = useMemo(() => post.imageUrls && post.imageUrls.map(uri => ({ uri })), [post])
  const locationText = useMemo(() => LocationHelpers.generalLocationString(post.locationObject, post.location), [post])
  const isFlagged = useMemo(() => post.flaggedGroups && post.flaggedGroups.includes(groupId), [post])
  const [{ currentUser }] = useCurrentUser()
  const handleShowMember = id => navigation.navigate('Member', { id })

  return (
    <>
      {childPost && (
        <View className='border-1 border-border'>
          <View className='flex-row gap-2 items-center py-2 px-2 bg-midground self-start'>
            <Icon name='Subgroup' className='text-foreground/70 mr-1' />
            <Text className='text-foreground/70'>{t('post from child group')}</Text>
          </View>
        </View>
      )}
      <View className='bg-card border-b border-border'>
        <PostHeader
          announcement={post.announcement}
          creator={post.creator}
          currentUser={currentUser}
          date={post.createdAt}
          hideMenu={hideMenu}
          isFlagged={isFlagged}
          postId={post.id}
          showMember={handleShowMember}
          title={post.title}
          type={post.type}
        />
        {isFlagged && !post.clickthrough && (
          <View className='bg-background/5 p-4'>
            <Text className='text-foreground/70'>{t('clickthroughExplainer')}</Text>
            <TouchableOpacity
              className='bg-secondary mt-2 rounded-md py-2 px-4'
              onPress={() => recordClickthrough({ postId: post.id })}
            >
              <Text className='text-background text-center'>{t('View post')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {(!images || images.length === 0) && (
          <Topics
            topics={post.topics}
            onPress={t => goToTopic(t.name)}
            className='mx-4 mt-2'
          />
        )}
        {(images && images.length > 0) && !(isFlagged && !post.clickthrough) && (
          <ImageAttachments
            creator={post.creator}
            images={images}
            isFlagged={isFlagged && !post.clickthrough}
            onlyLongPress
            onPress={onPress}
            className='mt-2'
            title={post.title}
          >
            <Topics
              topics={post.topics}
              onPress={t => goToTopic(t.name)}
              className='absolute top-2 left-4 z-10'
            />
          </ImageAttachments>
        )}
        {!!locationText && (
          <View className='flex-row items-center mx-4 mt-2'>
            <Icon className='text-foreground/50 mr-2' name='Location' />
            <Text className='text-foreground/70' selectable>{locationText}</Text>
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
        <Files urls={post.fileUrls} className='mx-4 mb-2' />
        {showGroups && (
          <PostGroups
            groups={post.groups}
            includePublic={post.isPublic}
            className='mx-4 mb-2'
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
