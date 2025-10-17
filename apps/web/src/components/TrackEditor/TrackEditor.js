import { isEqual, trim } from 'lodash/fp'
import { Eye, EyeOff, ImagePlus } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { useParams, Navigate } from 'react-router-dom'
import Button from 'components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'
import HyloEditor from 'components/HyloEditor'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import getCommonRoles from 'store/selectors/getCommonRoles'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getTrack from 'store/selectors/getTrack'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { cn } from 'util/index'
import { groupUrl } from '@hylo/navigation'
import { createTrack, updateTrack } from 'store/actions/trackActions'

function TrackEditor (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()

  // Selectors
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const editingTrack = useSelector(state => props.editingTrack ? getTrack(state, routeParams.trackId) : null)
  const hasTracksResponsibility = useSelector(state => currentGroup && hasResponsibilityForGroup(state, { groupId: currentGroup.id, responsibility: RESP_MANAGE_TRACKS }))

  const commonRoles = useSelector(getCommonRoles)
  const groupRoles = useMemo(() => currentGroup?.groupRoles?.items || [], [currentGroup?.groupRoles?.items])
  const roles = useMemo(() => [...commonRoles.map(role => ({ ...role, type: 'common' })), ...groupRoles.map(role => ({ ...role, type: 'group' }))], [commonRoles, groupRoles])

  const [trackState, setTrackState] = useState(Object.assign({
    actionDescriptor: currentGroup.settings.actionDescriptor || 'Action',
    actionDescriptorPlural: currentGroup.settings.actionDescriptorPlural || 'Actions',
    bannerUrl: '',
    completionRole: null,
    completionRoleType: '',
    completionMessage: '',
    description: '',
    name: '',
    groups: [currentGroup],
    publishedAt: null,
    welcomeMessage: ''
  }, editingTrack))

  const [edited, setEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [nameCharacterCount, setNameCharacterCount] = useState(0)
  const descriptionEditorRef = useRef(null)
  const welcomeMessageEditorRef = useRef(null)
  const completionMessageEditorRef = useRef(null)

  const isValid = useMemo(() => {
    return trackState.name?.length > 0 && trackState.actionDescriptor?.length > 0 && trackState.actionDescriptorPlural?.length > 0
  }, [errors, trackState.name, trackState.actionDescriptor, trackState.actionDescriptorPlural])

  useEffect(() => {
    if (editingTrack) {
      setTrackState(prevState => ({
        ...prevState,
        ...editingTrack
      }))
    }
  }, [editingTrack])

  const updateField = (field) => (value) => {
    const newValue = typeof value?.target !== 'undefined' ? value.target.value : value

    if (field === 'completionRole') {
      setTrackState({ ...trackState, completionRole: newValue, completionRoleType: newValue.type })
    } else {
      setTrackState({ ...trackState, [field]: newValue })
    }
    setEdited(true)

    const trimmedValue = trim(newValue)
    if (field === 'name') {
      setErrors({ ...errors, name: trimmedValue === '' ? t('Please enter a track name') : false })
      setNameCharacterCount(trimmedValue.length)
    } else if (field === 'actionDescriptor') {
      setErrors({ ...errors, actionDescriptor: trimmedValue === '' ? t('Please enter a descriptor for actions in this track') : false })
    } else if (field === 'actionDescriptorPlural') {
      setErrors({ ...errors, actionDescriptorPlural: trimmedValue === '' ? t('Please enter a plural descriptor for actions in this track') : false })
    }
  }

  const handleSave = useCallback(async () => {
    if (saving || !isValid) return
    setSaving(true)

    const completionMessage = completionMessageEditorRef.current?.getHTML()
    const description = descriptionEditorRef.current?.getHTML()
    const welcomeMessage = welcomeMessageEditorRef.current?.getHTML()

    const name = typeof trackState.name === 'string' ? trim(trackState.name) : trackState.name

    const save = editingTrack ? updateTrack : createTrack

    const result = await dispatch(save({
      actionDescriptor: trackState.actionDescriptor,
      actionDescriptorPlural: trackState.actionDescriptorPlural,
      bannerUrl: trackState.bannerUrl,
      completionMessage,
      completionRole: trackState.completionRole,
      completionRoleType: trackState.completionRoleType,
      description,
      name,
      groupIds: [currentGroup.id],
      trackId: editingTrack?.id,
      publishedAt: trackState.publishedAt,
      welcomeMessage
    }))

    setSaving(false)
    if (result?.error) {
      setErrors({ ...errors, general: t('There was an error, please try again.') })
    } else {
      setEdited(false)
      setErrors({})
      const savedTrack = result?.payload?.data?.createTrack || result?.payload?.data?.updateTrack
      dispatch(push(editingTrack ? groupUrl(currentGroup.slug, `tracks/${editingTrack.id}?tab=edit`) : groupUrl(currentGroup.slug, `tracks/${savedTrack.id}?tab=edit`)))
    }
  }, [trackState, isValid, editingTrack])

  const handlePublish = useCallback(async () => {
    if (saving || !isValid) return
    setSaving(true)

    const completionMessage = completionMessageEditorRef.current?.getHTML()
    const description = descriptionEditorRef.current?.getHTML()
    const welcomeMessage = welcomeMessageEditorRef.current?.getHTML()

    const name = typeof trackState.name === 'string' ? trim(trackState.name) : trackState.name

    const save = editingTrack ? updateTrack : createTrack

    const result = await dispatch(save({
      actionDescriptor: trackState.actionDescriptor,
      actionDescriptorPlural: trackState.actionDescriptorPlural,
      bannerUrl: trackState.bannerUrl,
      completionMessage,
      completionRole: trackState.completionRole,
      completionRoleType: trackState.completionRoleType,
      description,
      name,
      groupIds: [currentGroup.id],
      trackId: editingTrack?.id,
      publishedAt: new Date().toISOString(),
      welcomeMessage
    }))

    setSaving(false)
    if (result?.error) {
      setErrors({ ...errors, general: t('There was an error, please try again.') })
    } else {
      setEdited(false)
      setErrors({})
      const savedTrack = result?.payload?.data?.createTrack || result?.payload?.data?.updateTrack
      dispatch(push(editingTrack ? groupUrl(currentGroup.slug, `tracks/${editingTrack.id}?tab=edit`) : groupUrl(currentGroup.slug, `tracks/${savedTrack.id}?tab=edit`)))
    }
  }, [trackState, isValid, editingTrack])

  const handleUnpublish = useCallback(async () => {
    if (saving) return
    setSaving(true)

    const completionMessage = completionMessageEditorRef.current?.getHTML()
    const description = descriptionEditorRef.current?.getHTML()
    const welcomeMessage = welcomeMessageEditorRef.current?.getHTML()

    const name = typeof trackState.name === 'string' ? trim(trackState.name) : trackState.name

    const save = editingTrack ? updateTrack : createTrack

    const result = await dispatch(save({
      actionDescriptor: trackState.actionDescriptor,
      actionDescriptorPlural: trackState.actionDescriptorPlural,
      bannerUrl: trackState.bannerUrl,
      completionMessage,
      completionRole: trackState.completionRole,
      completionRoleType: trackState.completionRoleType,
      description,
      name,
      groupIds: [currentGroup.id],
      trackId: editingTrack?.id,
      publishedAt: null,
      welcomeMessage
    }))

    setSaving(false)
    if (result?.error) {
      setErrors({ ...errors, general: t('There was an error, please try again.') })
    } else {
      setEdited(false)
      setErrors({})
      const savedTrack = result?.payload?.data?.createTrack || result?.payload?.data?.updateTrack
      dispatch(push(editingTrack ? groupUrl(currentGroup.slug, `tracks/${editingTrack.id}?tab=edit`) : groupUrl(currentGroup.slug, `tracks/${savedTrack.id}?tab=edit`)))
    }
  }, [trackState, editingTrack])

  if (!hasTracksResponsibility) {
    return <Navigate to={groupUrl(currentGroup.slug)} />
  }

  const { actionDescriptor, actionDescriptorPlural, bannerUrl, completionRole, completionMessage, description, name, publishedAt, welcomeMessage } = trackState

  return (
    <div className='flex flex-col rounded-lg bg-background p-3 shadow-2xl relative'>
      <div className='p-0'>
        <h1 className='w-full text-sm block text-foreground m-0 p-0 mb-4'>{t('Create Track')}</h1>
      </div>

      <UploadAttachmentButton
        type='trackBanner'
        onInitialUpload={({ url }) => updateField('bannerUrl')(url)}
        className='w-full group'
      >
        <div
          className={cn('TrackEditorBannerContainer relative w-full h-[20vh] flex flex-col items-center justify-center border-2 border-dashed border-foreground/50 rounded-lg shadow-md bg-cover bg-center bg-black/0 hover:bg-black/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': !!bannerUrl })}
          style={{ backgroundImage: `url(${bannerUrl})` }}
        >
          <div className='flex flex-col items-center justify-center gap-1'>
            <ImagePlus className='inline-block' />
            <span className='ml-2 text-xs opacity-40 group-hover:opacity-100 transition-all'>{t('Set track banner')}</span>
          </div>
        </div>
      </UploadAttachmentButton>

      <div className='mt-3 flex relative border-2 items-center border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-md mb-8'>
        <div className='text-xs text-foreground/50 px-2 py-1 w-[90px]'>{t('Track name')}*</div>
        <input
          autoFocus
          className='border-none outline-none bg-transparent placeholder:text-foreground/50 p-2 w-full'
          maxLength='120'
          name='name'
          onChange={updateField('name')}
          value={name}
          placeholder={t('Your track\'s name')}
          type='text'
        />
        <span className='absolute right-3 text-sm text-gray-500'>{nameCharacterCount} / 120</span>
      </div>

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-tr-md rounded-br-md rounded-bl-md mb-8'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>Description</h3>
        <HyloEditor
          key={currentGroup.id}
          containerClassName='mt-2'
          contentHTML={description}
          className='h-full p-2 border-border border-t-2 border-foreground/10 min-h-20 mt-1'
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

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-tr-md rounded-br-md rounded-bl-md mb-8'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>
          {t('Welcome Message')}
        </h3>
        <HyloEditor
          key={currentGroup.id}
          contentHTML={welcomeMessage}
          className='h-full p-2 min-h-20 m-0 border-t-2 border-foreground/10'
          extendedMenu
          groupIds={[currentGroup.id]}
          onUpdate={(html) => {
            setEdited(!isEqual(html, welcomeMessage))
          }}
          placeholder={t('This message will be shown to members when they enroll in the track')}
          ref={welcomeMessageEditorRef}
          showMenu
          type='trackWelcomeMessage'
        />
      </div>

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-tr-md rounded-br-md rounded-bl-md'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>Completion Message</h3>
        <HyloEditor
          key={currentGroup.id}
          containerClassName='mt-2'
          contentHTML={completionMessage}
          className='h-full p-2 border-t-2 border-foreground/10 min-h-20 mt-1'
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

      <div>
        <h3>Completion badge or role</h3>
        <div className='flex flex-row items-center relative p-1 border-transparent transition-all duration-200 group focus-within:border-focus mb-4 rounded-md'>
          <Select
            onValueChange={(role) => {
              updateField('completionRole')(role)
            }}
            value={completionRole}
          >
            <SelectTrigger className='w-fit border-2 bg-input border-foreground/30 rounded-md p-2 text-base'>
              <SelectValue>
                {completionRole ? completionRole.emoji + ' ' + completionRole.name : t('Select a badge or role given to members who complete the track')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role}>
                  {role.emoji} {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <h3>Term to describe track units</h3>
        <p className='text-xs text-foreground/60'>{t('actionsTermHelp')}</p>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 transition-all focus-within:border-focus border-2 border-transparent mb-4'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term')}</div>
          <input
            className='p-2 border-none bg-transparent w-full'
            maxLength='40'
            name='actionDescriptor'
            onChange={updateField('actionDescriptor')}
            value={actionDescriptor}
            type='text'
          />
        </div>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 transition-all focus-within:border-focus border-2 border-transparent mb-4'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term plural')}</div>
          <input
            className='p-2 border-none bg-transparent w-full'
            maxLength='40'
            name='actionDescriptorPlural'
            onChange={updateField('actionDescriptorPlural')}
            value={actionDescriptorPlural}
            type='text'
          />
        </div>
      </div>

      <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 transition-all focus-within:border-focus border-2 border-transparent mb-4'>
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
            onClick={handleUnpublish}
          >
            <EyeOff className='w-5 h-5' />
          </button>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-accent text-white' : 'bg-foreground/10'
            )}
            onClick={handlePublish}
          >
            <Eye className='w-5 h-5' />
          </button>
          <span className='mr-2'>{publishedAt ? t('Published. Track is visible. Click the Eye to unpublish.') : t('Unpublished. Click the Eye to publish.')}</span>
        </div>
      </div>

      <div className='flex gap-2 justify-start'>
        {!publishedAt && (
          <>
            <Button
              variant='outline'
              disabled={saving || !isValid}
              onClick={handleSave}
            >
              {t('Save Draft')}
            </Button>
            <Button
              variant='secondary'
              disabled={saving || !isValid}
              onClick={handlePublish}
            >
              {t('Publish')}
            </Button>
          </>
        )}
        {publishedAt && (
          <>
            <Button
              variant='outline'
              disabled={saving}
              onClick={handleUnpublish}
            >
              {t('Unpublish')}
            </Button>
            <Button
              variant='secondary'
              disabled={!edited || !isValid || saving}
              onClick={handleSave}
            >
              {t('Save Changes')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default TrackEditor
