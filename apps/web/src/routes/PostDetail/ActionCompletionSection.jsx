import { Pencil, PartyPopper } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { TextHelpers } from '@hylo/shared'
import { formatUserDatePair } from 'util/dateFormat'
import { FileManager } from 'components/AttachmentManager/FileManager'
import CardFileAttachments from 'components/CardFileAttachments'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import * as Dialog from '@radix-ui/react-dialog'
import { Label } from 'components/ui/label'
import useRouteParams from 'hooks/useRouteParams'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import completePost from 'store/actions/completePost'
import { fetchViewPosts } from 'store/actions/groupViews'
import { fetchTrack } from 'store/actions/trackActions'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import getTrack from 'store/selectors/getTrack'

/** Role objects from a group's embedded groupRoles list. */
function roleItems (group) {
  if (!group) return []
  return group.groupRoles?.items || group.ref?.groupRoles?.items || []
}

/**
 * Resolves the track completion role for display and optimistic membership.
 * Roles live on the parent group; the space's groupRoles list is empty.
 */
function resolveCompletionRole (trackRole, parentGroup, spaceGroup) {
  if (!trackRole) return null
  const id = trackRole.id
  const emoji = trackRole.emoji || trackRole.ref?.emoji
  const name = trackRole.name || trackRole.ref?.name
  if (emoji || name) {
    return {
      id,
      emoji,
      name,
      groupId: trackRole.groupId || trackRole.ref?.groupId || parentGroup?.id
    }
  }
  const found = [...roleItems(parentGroup), ...roleItems(spaceGroup)]
    .find(role => String(role.id) === String(id))
  if (!found) return null
  return {
    id: found.id,
    emoji: found.emoji,
    name: found.name,
    groupId: found.groupId || parentGroup?.id
  }
}

/** True when completion HTML has visible text (empty editor HTML is treated as none). */
function hasVisibleCompletionMessage (html) {
  if (!html) return false
  return TextHelpers.presentHTMLToText(html).trim().length > 0
}

/** True when every action in the list is complete (this post counts as complete). */
function allTrackActionsComplete (trackActions, postId) {
  return Array.isArray(trackActions) &&
    trackActions.length > 0 &&
    trackActions.every(action => action.completedAt || String(action.id) === String(postId))
}

export default function ActionCompletionSection ({ post, currentUser }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const [completionResponse, setCompletionResponse] = useState(post.completionResponse || [])
  const [showTrackCompletionDialog, setShowTrackCompletionDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const completedOnMountRef = useRef(Boolean(post.completedAt))
  const { completionAction, completionActionSettings } = post
  const { instructions, options } = completionActionSettings || {}
  // Track spaces carry the track on the space group (group.track).
  const groupSlug = useEffectiveGroupSlug() || routeParams.groupSlug
  const currentGroup = useSelector(state => getGroupForSlug(state, groupSlug))
  const parentGroup = useSelector(state => {
    const parentSlug = routeParams.groupSlug
    if (!parentSlug || parentSlug === groupSlug) return null
    return getGroupForSlug(state, parentSlug)
  })
  const trackId = currentGroup?.track?.id
  const fetchedTrack = useSelector(state => trackId ? getTrack(state, trackId) : null)
  const currentTrack = fetchedTrack || currentGroup?.track || null
  const groupViews = useSelector(state => getGroupViews(state, currentGroup))
  const actionsView = groupViews.find(v => v.type === 'track-actions')
  const collectionPosts = actionsView?.collectionPosts
  const trackActions = collectionPosts || []
  const completionRole = resolveCompletionRole(currentTrack?.completionRole, parentGroup, currentGroup)
  const trackName = currentGroup?.name || currentTrack?.space?.name || ''

  useEffect(() => {
    if (!trackId || fetchedTrack?.id) return
    dispatch(fetchTrack(trackId))
  }, [dispatch, trackId, fetchedTrack?.id])

  useEffect(() => {
    if (currentGroup?.id && actionsView?.id && collectionPosts === undefined) {
      dispatch(fetchViewPosts(currentGroup.id, actionsView.id))
    }
  }, [currentGroup?.id, actionsView?.id, collectionPosts, dispatch])

  const isTrackCompleteAfterThisPost = allTrackActionsComplete(trackActions, post.id) ||
    (fetchedTrack?.numActions === 1)

  useEffect(() => {
    if (completedOnMountRef.current) return
    if (!post.completedAt || !currentTrack?.id) return

    if (isTrackCompleteAfterThisPost) {
      completedOnMountRef.current = true
      setShowTrackCompletionDialog(true)
      return
    }

    const othersStillIncomplete = Array.isArray(collectionPosts) &&
      collectionPosts.some(action => String(action.id) !== String(post.id) && !action.completedAt)
    if (othersStillIncomplete) {
      completedOnMountRef.current = true
      return
    }

    // Empty or still-loading action list: wait for numActions before deciding
    if (collectionPosts === undefined || fetchedTrack?.numActions == null) return

    completedOnMountRef.current = true
  }, [
    post.completedAt,
    currentTrack?.id,
    collectionPosts,
    fetchedTrack?.numActions,
    isTrackCompleteAfterThisPost
  ])

  const handleSubmitCompletion = useCallback(() => {
    if (completionAction === 'button' || completionResponse.length > 0) {
      const trackCompleted = !post.completedAt && isTrackCompleteAfterThisPost
      if (trackCompleted) {
        setShowTrackCompletionDialog(true)
      }
      dispatch(completePost(post.id, completionResponse, {
        trackId: currentTrack?.id,
        trackCompleted,
        completionRoleId: currentTrack?.completionRole?.id || completionRole?.id,
        completionRole,
        groupId: currentGroup?.id,
        parentGroupId: parentGroup?.id
      }))
    }
    setIsEditing(false)
  }, [
    post,
    completionResponse,
    currentTrack,
    currentGroup?.id,
    parentGroup?.id,
    completionRole,
    dispatch,
    completionAction,
    isTrackCompleteAfterThisPost
  ])

  useEffect(() => {
    // If the post is completed, or re-completed, close edit mode
    // This is needed when editing a comment or reaction type action completion
    setIsEditing(false)
    setCompletionResponse(post.completionResponse)
  }, [post.completedAt, post.completionResponse])

  const handleUploadAttachment = useCallback((attachments) => {
    setCompletionResponse(attachments.map(a => ({ id: a.id, url: a.url })))
  }, [])

  if (!completionAction) return null

  const completedAt = post.completedAt ? formatUserDatePair({ start: post.completedAt }) : null
  let completionControls, completionButtonText, alreadyCompletedMessage
  let completionResponseText = completionResponse?.length > 0 ? completionResponse.map((r, i) => <p key={i}><HyloHTML html={r} /></p>) : null
  switch (completionAction) {
    case 'button':
      completionControls = null
      completionButtonText = 'Mark as Complete'
      break
    case 'selectOne':
      completionControls = (
        <RadioGroup onValueChange={(value) => setCompletionResponse([value])} value={completionResponse?.[0] || ''}>
          {options.map((option) => (
            <div key={option} className='flex items-center gap-2 mb-2 cursor-pointer'>
              <RadioGroupItem value={option} id={`radio-${option}`} />
              <Label htmlFor={`radio-${option}`} className='cursor-pointer'>{option}</Label>
            </div>
          ))}
        </RadioGroup>
      )
      completionButtonText = 'Submit'
      alreadyCompletedMessage = t('You selected:')
      break
    case 'selectMultiple':
      completionControls = (
        <ul className='list-none pl-1'>
          {options.map((option) => (
            <li key={option} className='flex items-center gap-2 mb-2 cursor-pointer'>
              <Checkbox
                id={`checkbox-${option}`}
                key={option}
                checked={completionResponse?.includes(option) || false}
                onCheckedChange={(checked) => {
                  setCompletionResponse((prev) => {
                    if (checked) {
                      return [...(prev || []), option]
                    } else {
                      return (prev || []).filter(item => item !== option)
                    }
                  })
                }}
              />
              <Label htmlFor={`checkbox-${option}`} className='cursor-pointer'>{option}</Label>
            </li>
          ))}
        </ul>
      )
      completionButtonText = 'Submit'
      alreadyCompletedMessage = t('You selected:')
      break
    case 'text':
      completionControls = <textarea type='text' className='w-full outline-none border-border border-2 bg-input rounded-md p-2' value={completionResponse} onChange={(e) => setCompletionResponse([e.target.value])} />
      completionButtonText = 'Submit'
      alreadyCompletedMessage = t('Your response was:')
      break
    case 'uploadFile':
      completionControls = (
        <>
          <FileManager
            attachments={completionResponse}
            type='postCompletion'
            id={post.id}
            attachmentType='file'
            showLoading
            onChange={handleUploadAttachment}
          />
          <UploadAttachmentButton
            className='inline-block'
            type='postCompletion'
            attachmentType='all'
            allowMultiple
            onSuccess={(response) => setCompletionResponse(prev => prev.concat(response))}
          >
            <Button variant='outline'>
              {t('Upload Attachments')}
            </Button>
          </UploadAttachmentButton>
          <Button
            className='ml-2'
            disabled={completionResponse?.length === 0}
            onClick={handleSubmitCompletion}
          >
            {t('Submit Attachments and Complete')}
          </Button>
        </>
      )
      completionButtonText = null
      alreadyCompletedMessage = t('Your uploaded attachments:')
      completionResponseText = <CardFileAttachments attachments={completionResponse.map(a => ({ ...a, type: 'file' }))} />
      break
    case 'comment':
    case 'reaction':
      completionControls = null
      completionButtonText = null
      break
  }

  return (
    <div className='border-2 border-dashed border-foreground/20 rounded-md p-3 m-2'>
      {post.completedAt && !isEditing && (
        <div className='mb-1'>
          <p>{t('You completed this {{actionDescriptor}} {{date}}.', { date: completedAt, actionDescriptor: currentTrack?.actionDescriptor })} {alreadyCompletedMessage}</p>
          {completionResponse?.length > 0 && completionResponseText}
          <Button variant='outline' onClick={() => setIsEditing(true)}><Pencil className='w-4 h-4 cursor-pointer' /> Edit Response</Button>
        </div>
      )}
      {(!post.completedAt || isEditing) && (
        <>
          <h3>Complete this action</h3>
          <p className='font-bold'>{instructions}</p>
          {completionControls}
          {completionButtonText && <Button onClick={handleSubmitCompletion} disabled={completionResponse?.length === 0 && completionAction !== 'button'}>{completionButtonText}</Button>}
        </>
      )}
      <Dialog.Root open={showTrackCompletionDialog} onOpenChange={setShowTrackCompletionDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className='CompletedTrackDialog-Overlay bg-darkening/50 absolute top-0 left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[1100] backdrop-blur-sm'>
            <Dialog.Content className='CompletedTrackDialog-Content min-w-[300px] w-full bg-background p-4 rounded-md z-[1101] max-w-[750px] outline-none'>
              <PartyPopper className='w-10 h-10 text-green-500 mx-auto' />
              <Dialog.Title className='sr-only'>{t('Congratulations!')}</Dialog.Title>
              <Dialog.Description className='sr-only'>{t('Congratulations!')}</Dialog.Description>
              <h3 className='text-2xl font-bold text-center'>{t('Congratulations, you have completed {{trackName}}!', { trackName })}</h3>
              {hasVisibleCompletionMessage(currentTrack?.completionMessage) && (
                <ClickCatcher>
                  <HyloHTML html={currentTrack.completionMessage} className='text-center text-foreground/70 mt-2' />
                </ClickCatcher>
              )}
              {completionRole && (
                <div className='text-center text-foreground border-2 border-selected/20 flex flex-col gap-2 items-center ml-auto mr-auto w-full mt-4 p-4 rounded-md border-dashed'>
                  <div>{t('newRoleEarned')}</div>
                  <div className='rounded-md bg-selected/50 shadow-xl border-2 border-selected/80 px-2 py-1 bg-selected'>{completionRole.emoji} {completionRole.name}</div>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
