import { isEqual, trim } from 'lodash/fp'
import { Eye, EyeOff, ImagePlus, Plus } from 'lucide-react'
import React, { useCallback, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { useParams, Navigate } from 'react-router-dom'
import Button from 'components/ui/button'
import EmojiPicker from 'components/EmojiPicker'
import HyloEditor from 'components/HyloEditor'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { cn } from 'util/index'
import { groupUrl } from 'util/navigation'
import { createTrack } from './CreateTrack.store'

function CreateTrack () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()

  // Selectors
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const hasTracksResponsibility = useSelector(state => currentGroup && hasResponsibilityForGroup(state, { groupId: currentGroup.id, responsibility: RESP_MANAGE_TRACKS }))

  const [trackState, setTrackState] = useState({
    actionsName: currentGroup.settings.actionsName || 'Actions',
    bannerUrl: '',
    completionBadgeEmoji: '',
    completionBadgeName: '',
    completionMessage: '',
    description: '',
    name: '',
    groups: [currentGroup],
    publishedAt: null,
    welcomeMessage: ''
  })
  const [edited, setEdited] = useState(false)
  const [errors, setErrors] = useState({})
  const [nameCharacterCount, setNameCharacterCount] = useState(0)
  const descriptionEditorRef = useRef(null)
  const welcomeMessageEditorRef = useRef(null)
  const completionMessageEditorRef = useRef(null)

  const isValid = useMemo(() => {
    return trackState.name?.length > 0 && trackState.actionsName?.length > 0
  }, [errors])

  // useEffect(() => {
  //   if (trackState.id) {
  //     dispatch(fetchTrack(trackState.id))
  //   }
  // }, [trackState.id])

  const updateField = (field) => (value) => {
    const newValue = typeof value?.target !== 'undefined' ? value.target.value : value

    setTrackState({ ...trackState, [field]: newValue })
    setEdited(true)

    const trimmedValue = trim(newValue)
    if (field === 'name') {
      setErrors({ ...errors, name: trimmedValue === '' ? t('Please enter a track name') : false })
      setNameCharacterCount(trimmedValue.length)
    } else if (field === 'actionsName') {
      setErrors({ ...errors, actionsName: trimmedValue === '' ? t('Please enter a track actions name') : false })
    }
  }

  const onSubmit = useCallback(() => {
    let {
      actionsName,
      bannerUrl,
      completionBadgeEmoji,
      completionBadgeName,
      name,
      publishedAt
    } = trackState

    const completionMessage = completionMessageEditorRef.current?.getHTML()
    const description = descriptionEditorRef.current?.getHTML()
    const welcomeMessage = welcomeMessageEditorRef.current?.getHTML()

    name = typeof name === 'string' ? trim(name) : name

    if (isValid) {
      dispatch(createTrack({
        actionsName,
        bannerUrl,
        completionBadgeEmoji,
        completionBadgeName,
        completionMessage,
        description,
        name,
        groupIds: [currentGroup.id],
        publishedAt,
        welcomeMessage
      }))
        .then(({ error }) => {
          if (error) {
            setErrors({ ...errors, general: t('There was an error, please try again.') })
          } else {
            dispatch(push(groupUrl(currentGroup.slug, 'settings/tracks')))
          }
        })
    }
  }, [trackState, isValid])

  console.log('hasTracksResponsibility', hasTracksResponsibility)
  if (!hasTracksResponsibility) {
    return <Navigate to={groupUrl(currentGroup.slug)} />
  }

  const { actionsName, bannerUrl, completionBadgeEmoji, completionBadgeName, completionMessage, description, name, publishedAt, welcomeMessage } = trackState

  return (
    <div className='w-full bg-white rounded-md shadow-sm p-2'>
      <div className='flex text-center'>
        <h1 className='p-2 w-full text-center block text-foreground'>{t('Create Track')}</h1>
      </div>

      <UploadAttachmentButton
        type='trackBanner'
        onInitialUpload={({ url }) => updateField('bannerUrl')(url)}
        className='w-full group'
      >
        <div
          className={cn('CreateTrackBannerContainer relative w-full h-[20vh] flex flex-col items-center justify-center border-2 border-dashed border-foreground/50 rounded-lg shadow-md bg-cover bg-center bg-black/0 hover:bg-black/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': !!bannerUrl })}
          style={{ backgroundImage: `url(${bannerUrl})` }}
        >
          <div className='flex flex-col items-center justify-center gap-1'>
            <ImagePlus className='inline-block' />
            <span className='ml-2 text-xs opacity-40 group-hover:opacity-100 transition-all'>{t('Set track banner')}</span>
          </div>
        </div>
      </UploadAttachmentButton>

      <div className='bg-background p-2 relative flex items-center'>
        <input
          autoFocus
          className='p-1 text-2xl w-full font-xl font-bold border-b border-dashed border-gray-300'
          maxLength='120'
          name='name'
          onChange={updateField('name')}
          value={name}
          placeholder={t('Your track\'s name*')}
          type='text'
        />
        <span className='absolute right-3 text-sm text-gray-500'>{nameCharacterCount} / 120</span>
      </div>

      <div className='bg-background p-2 relative'>
        <h3>Actions Term*</h3>
        <p className='text-sm text-gray-500'>{t('actionsTermHelp')}:</p>
        <input
          className='p-1 w-full border-b border-dashed border-gray-300'
          maxLength='40'
          name='actionsName'
          onChange={updateField('actionsName')}
          value={actionsName}
          type='text'
        />
      </div>

      <div className='relative bg-background p-2'>
        <h3>Description</h3>
        <HyloEditor
          key={currentGroup.id}
          containerClassName='mt-2'
          contentHTML={description}
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          extendedMenu
          groupIds={[currentGroup.id]}
          onUpdate={(html) => {
            setEdited(!isEqual(html, description))
          }}
          placeholder={t('Your track description here')}
          ref={descriptionEditorRef}
          showMenu
          type='trackDescription'
        />
      </div>

      <div className='bg-background p-2 relative'>
        <h3>Welcome Message</h3>
        <HyloEditor
          key={currentGroup.id}
          containerClassName='mt-2'
          contentHTML={welcomeMessage}
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          extendedMenu
          groupIds={[currentGroup.id]}
          onUpdate={(html) => {
            setEdited(!isEqual(html, welcomeMessage))
          }}
          placeholder={t('Your track welcome message here')}
          ref={welcomeMessageEditorRef}
          showMenu
          type='trackWelcomeMessage'
        />
      </div>

      <div className='bg-background p-2 relative'>
        <h3>Completion Badge and Name</h3>
        <div className='flex items-center gap-2'>
          <EmojiPicker
            forReactions={false}
            emoji={completionBadgeEmoji}
            handleReaction={updateField('completionBadgeEmoji')}
            className='w-8 h-8 bg-foreground/5 rounded flex items-center justify-center cursor-pointer hover:bg-foreground/10 hover:shadow-xl border-2 border-foreground/50 hover:border-foreground/100 transition-all'
          />
          <input
            className='border-b border-dashed border-gray-300 flex-1'
            maxLength='40'
            name='completionBadgeName'
            onChange={updateField('completionBadgeName')}
            value={completionBadgeName}
            placeholder={t('Your track completion badge name here')}
            type='text'
          />
        </div>
      </div>

      <div className='bg-background p-2 relative'>
        <h3>Completion Message</h3>
        <HyloEditor
          key={currentGroup.id}
          containerClassName='mt-2'
          contentHTML={completionMessage}
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          extendedMenu
          groupIds={[currentGroup.id]}
          onUpdate={(html) => {
            setEdited(!isEqual(html, completionMessage))
          }}
          placeholder={t('This message will be shown to members who complete the track')}
          ref={completionMessageEditorRef}
          showMenu
          type='trackCompletionMessage'
        />
      </div>

      <div className='bg-background p-2 relative'>
        {/* <span className='mr-2'>Publish At</span>
        <DateTimePicker
          hourCycle={getHourCycle()}
          granularity='minute'
          value={publishedAt}
          placeholder={t('When to Publish')}
          onChange={updateField('publishedAt')}
          onMonthChange={() => {}}
        /> */}
        <div className='flex items-center gap-2'>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-foreground/10' : 'bg-accent text-white'
            )}
            onClick={() => updateField('publishedAt')(null)}
          >
            <EyeOff className='w-5 h-5' />
          </button>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-accent text-white' : 'bg-foreground/10'
            )}
            onClick={() => updateField('publishedAt')(new Date().toISOString())}
          >
            <Eye className='w-5 h-5' />
          </button>
          <span className='mr-2'>{publishedAt ? t('Publish Now') : t('Unpublished')}</span>
        </div>
      </div>

      <div className=''>
        <Button
          variant='secondary'
          disabled={!edited || !isValid}
          onClick={onSubmit}
        >
          <Plus className={cn('w-4 h-4 bg-primary text-white', { 'bg-secondary': edited && isValid })} />{t('Create Track')}
        </Button>
      </div>
    </div>
  )
}

export default CreateTrack
