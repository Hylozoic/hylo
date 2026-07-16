import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Eye, EyeOff, ImagePlus, Info, Lock, LockOpen } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'
import HyloEditor from 'components/HyloEditor'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import LocationInput from 'components/LocationInput/LocationInput'
import PostTypePills from 'components/PostTypePills/PostTypePills'
import TagInput from 'components/TagInput'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { updateSpace, updateGroupView } from 'store/actions/groupViews'
import { updateTrack } from 'store/actions/trackActions'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { cn, bgImageStyle } from 'util/index'

import { SPACE_ICON_SUGGESTIONS, ACCESS_OPTIONS, accessValueForSpace } from './spaceFormConstants'

/** Modal for editing an existing space's settings — same fields as AddSpaceDialog's creation form,
 * plus a Track settings section (appended below) when the space is backed by a Track.
 * Accepts `space` directly (e.g. More Spaces) and optional parent-menu `view` when the space is on the menu. */
export default function SpaceSettingsModal ({ space: spaceProp, view, group, onClose }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const space = spaceProp || view?.linkedGroup
  const track = space?.track
  const modalTitle = track
    ? t('Track Space Settings')
    : space?.fundingRound
      ? t('Funding Round Space Settings')
      : t('Space Settings')

  const [name, setName] = useState(view?.name || space?.name || '')
  const [icon, setIcon] = useState(space?.icon || SPACE_ICON_SUGGESTIONS[0])
  const [bannerUrl, setBannerUrl] = useState(space?.bannerUrl || '')
  const [avatarUrl, setAvatarUrl] = useState(space?.avatarUrl || '')
  const [purpose, setPurpose] = useState(space?.purpose || '')
  const [description, setDescription] = useState(space?.description || '')
  const [locationObject, setLocationObject] = useState(space?.locationObject || null)
  const [postTypes, setPostTypes] = useState(space?.acceptedPostTypes || [])
  const [access, setAccess] = useState(() => accessValueForSpace({
    visibility: space?.visibility,
    accessibility: space?.accessibility,
    requiredRoles: space?.requiredRoles
  }))
  const [requiredRoles, setRequiredRoles] = useState(() => {
    const roleIds = space?.requiredRoles || []
    const roleById = new Map((space?.groupRoles?.items || []).map(role => [role.id, role]))
    return roleIds.map(id => roleById.get(id)).filter(Boolean)
  })
  const [roleSearchTerm, setRoleSearchTerm] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // Track settings (only relevant when this space is backed by a Track)
  const [actionDescriptor, setActionDescriptor] = useState(track?.actionDescriptor || 'Action')
  const [actionDescriptorPlural, setActionDescriptorPlural] = useState(track?.actionDescriptorPlural || 'Actions')
  const [completionRole, setCompletionRole] = useState(track?.completionRole || null)
  const [publishedAt, setPublishedAt] = useState(track?.publishedAt || null)
  const [accessControlled, setAccessControlled] = useState(track?.accessControlled || false)
  const [showAccessControlInfo, setShowAccessControlInfo] = useState(false)
  const completionMessageEditorRef = useRef(null)

  // Spaces created before roles were set up on them (e.g. migrated Track spaces) may have no
  // group_roles rows yet — fall back to the parent group's roles rather than showing an empty list.
  const roles = useMemo(() => {
    const spaceRoles = space?.groupRoles?.items || []
    const sourceRoles = spaceRoles.length > 0 ? spaceRoles : (group?.groupRoles?.items || [])
    return sourceRoles.map(role => ({ ...role, type: 'group', label: `${role.emoji} ${role.name}` }))
  }, [space?.groupRoles?.items, group?.groupRoles?.items])

  const roleSuggestions = useMemo(() => {
    if (roleSearchTerm === null) return []
    const unselectedRoles = roles.filter(role => !requiredRoles.some(selected => selected.id === role.id))
    if (!roleSearchTerm) return unselectedRoles.slice(0, 5)
    const searchLower = roleSearchTerm.toLowerCase()
    return unselectedRoles.filter(role => role.name.toLowerCase().includes(searchLower))
  }, [roleSearchTerm, roles, requiredRoles])

  const renderRoleSuggestion = useCallback(({ item, handleChoice }) => (
    <li key={item.id}>
      <a onClick={event => handleChoice(item, event)} className='flex items-center gap-2 rounded-md text-foreground hover:text-foreground'>
        <span>{item.emoji}</span>
        <span>{item.name}</span>
      </a>
    </li>
  ), [])

  const selectedCompletionRole = useMemo(
    () => (completionRole?.id ? roles.find(role => role.id === completionRole.id) : null),
    [completionRole, roles]
  )

  const handleSave = useCallback(async () => {
    if (!name.trim() || !space?.id || !group?.id) return
    setIsSaving(true)
    try {
      const accessOption = ACCESS_OPTIONS.find(option => option.value === access)
      const trimmedName = name.trim()
      const menuNameChanged = Boolean(view?.id && trimmedName && trimmedName !== view.name)

      await dispatch(updateSpace({
        id: space.id,
        groupId: group.id,
        spaceViewId: view?.id,
        name: trimmedName,
        description: description || null,
        icon,
        bannerUrl: bannerUrl || null,
        avatarUrl: avatarUrl || null,
        purpose: purpose.trim() || null,
        location: locationObject?.fullText || null,
        locationId: locationObject?.id || null,
        acceptedPostTypes: postTypes,
        visibility: accessOption.visibility,
        accessibility: accessOption.accessibility,
        requiredRoles: access === 'role' ? requiredRoles.map(role => role.id) : [],
        viewName: menuNameChanged ? trimmedName : undefined
      }))

      if (menuNameChanged) {
        await dispatch(updateGroupView({ id: view.id, groupId: group.id, name: trimmedName }))
      }

      if (track?.id) {
        const completionMessage = completionMessageEditorRef.current?.getHTML?.() ?? track.completionMessage
        await dispatch(updateTrack({
          trackId: track.id,
          actionDescriptor,
          actionDescriptorPlural,
          completionMessage,
          completionRole,
          publishedAt,
          accessControlled
        }))
      }

      if (view?.id) {
        await dispatch(fetchGroupViews(group.id))
      } else {
        await dispatch(fetchGroupSpaces(group.id))
      }
      onClose()
    } catch (error) {
      console.error('Failed to save space settings:', error)
    } finally {
      setIsSaving(false)
    }
  }, [dispatch, space?.id, group?.id, view?.id, view?.name, name, description, icon, bannerUrl, avatarUrl, purpose, locationObject, postTypes, access, requiredRoles, track?.id, actionDescriptor, actionDescriptorPlural, completionRole, publishedAt, accessControlled, onClose])

  if (!space) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-darkening/50'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-[40rem] max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{modalTitle}</h2>

        <div className='flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 p-1 -m-1'>
          <UploadAttachmentButton
            type='groupBanner'
            onInitialUpload={({ url }) => setBannerUrl(url)}
            className='w-full group'
          >
            <div
              className={cn('relative w-full h-[20vh] flex flex-col items-center justify-center border-2 border-dashed border-foreground/50 rounded-lg shadow-md bg-cover bg-center bg-darkening/0 hover:bg-darkening/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': !!bannerUrl })}
              style={{ backgroundImage: `url(${bannerUrl})` }}
            >
              <div className='flex flex-col items-center justify-center gap-1'>
                <ImagePlus className='inline-block' />
                <span className='ml-2 text-xs opacity-40 group-hover:opacity-100 transition-all'>{t('Set space banner')}</span>
              </div>
            </div>
          </UploadAttachmentButton>

          <UploadAttachmentButton
            type='groupAvatar'
            onInitialUpload={({ url }) => setAvatarUrl(url)}
            className='relative -top-10 self-center bg-midground -mb-6 group'
          >
            <div
              style={bgImageStyle(avatarUrl)}
              className={cn('relative w-20 h-20 rounded-lg border-dashed border-2 border-foreground/50 shadow-md flex items-center justify-center bg-cover bg-center bg-darkening/0 hover:bg-darkening/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': !!avatarUrl })}
            >
              {!avatarUrl && (
                <div className='flex flex-col items-center justify-center gap-1'>
                  <ImagePlus className='inline-block' />
                  <span className='text-xs opacity-40 group-hover:opacity-100 transition-all'>{t('Add icon')}</span>
                </div>
              )}
            </div>
          </UploadAttachmentButton>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Name')}</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('Space name')}
            />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Icon')}</label>
            <div className='flex flex-wrap items-center gap-2'>
              {SPACE_ICON_SUGGESTIONS.map(iconName => (
                <button
                  key={iconName}
                  type='button'
                  onClick={() => setIcon(iconName)}
                  aria-label={iconName}
                  className={cn(
                    'flex items-center justify-center rounded-md border-2 p-2 transition-all',
                    icon === iconName
                      ? 'border-selected bg-selected/20'
                      : 'border-foreground/20 hover:border-foreground/50'
                  )}
                >
                  <LucideIcon name={iconName} className='w-4 h-4' />
                </button>
              ))}
              <LucideIconPicker value={icon} onChange={setIcon} className='w-auto px-2 shrink-0' />
            </div>
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Purpose')}</label>
            <Input
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder={t('What is this space for?')}
            />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('Description (optional)')}
              rows={3}
              className='w-full rounded-md border border-foreground/20 bg-input p-2 text-sm text-foreground'
            />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Location')}</label>
            <LocationInput
              locationObject={locationObject}
              location={locationObject?.fullText || ''}
              onChange={setLocationObject}
              className='bg-input rounded-md text-foreground placeholder-foreground/40 w-full p-2 text-sm'
            />
          </div>

          <PostTypePills
            postTypes={postTypes}
            onPostTypesChange={setPostTypes}
            label={t('Accepted post types')}
          />

          <div className='flex flex-col gap-2'>
            <label className='text-sm text-foreground/70'>{t('Access')}</label>
            <RadioGroup value={access} onValueChange={setAccess}>
              {ACCESS_OPTIONS.map(option => (
                <div key={option.value} className='flex flex-col gap-1 mb-2'>
                  <div className='flex items-start gap-2'>
                    <RadioGroupItem value={option.value} id={`space-settings-access-${option.value}`} className='mt-0.5 shrink-0' />
                    <Label htmlFor={`space-settings-access-${option.value}`} className='cursor-pointer flex flex-wrap items-baseline gap-x-2'>
                      <span>{t(option.labelKey)}</span>
                      <span className='text-xs font-normal text-foreground/50'>{t(option.descKey)}</span>
                    </Label>
                  </div>
                  {option.value === 'role' && access === 'role' && (
                    <div className='ml-6 mt-1 flex flex-row items-center relative border-2 border-transparent shadow-md transition-all duration-200 group focus-within:border-focus bg-input rounded-md'>
                      <TagInput
                        tags={requiredRoles.map(role => ({ ...role, name: role.label || `${role.emoji} ${role.name}` }))}
                        suggestions={roleSuggestions}
                        handleInputChange={setRoleSearchTerm}
                        handleAddition={(role) => {
                          setRequiredRoles(prev => [...prev, role])
                          setRoleSearchTerm('')
                        }}
                        handleDelete={(role) => {
                          setRequiredRoles(prev => prev.filter(r => r.id !== role.id))
                        }}
                        placeholder={t('Search roles/badges')}
                        allowNewTags={false}
                        renderSuggestion={renderRoleSuggestion}
                        onFocus={() => setRoleSearchTerm('')}
                        onBlur={() => setRoleSearchTerm(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </RadioGroup>
          </div>

          {track?.id && (
            <div className='flex flex-col gap-3 border-t-2 border-foreground/10 pt-3 mt-1'>
              <h3 className='text-base font-semibold'>{t('Track Settings')}</h3>

              <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input rounded-tr-md rounded-br-md rounded-bl-md mb-2'>
                <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>
                  {t('Completion Message')}
                </h3>
                <HyloEditor
                  key={track.id}
                  containerClassName='mt-2'
                  contentHTML={track.completionMessage}
                  className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
                  extendedMenu
                  groupIds={[space.id]}
                  placeholder={t('This message will be shown to members who complete the track')}
                  ref={completionMessageEditorRef}
                  showMenu
                  type='trackCompletionMessage'
                />
              </div>

              <div>
                <label className='text-sm text-foreground/70'>{t('Completion badge or role')}</label>
                <div className='flex flex-row items-center relative p-1 border-transparent transition-all duration-200 group focus-within:border-focus mt-1'>
                  <Select
                    onValueChange={(roleId) => {
                      const role = roles.find(r => r.id === roleId)
                      if (role) setCompletionRole(role)
                    }}
                    value={completionRole?.id || ''}
                  >
                    <SelectTrigger className='w-fit border-2 bg-input border-foreground/30 rounded-md p-2 text-base'>
                      <SelectValue>
                        {selectedCompletionRole ? `${selectedCompletionRole.emoji} ${selectedCompletionRole.name}` : t('Select a badge or role given to members who complete the track')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.emoji} {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
                  <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term')}</div>
                  <input
                    className='p-2 border-none bg-transparent w-full outline-none'
                    maxLength='40'
                    name='actionDescriptor'
                    onChange={e => setActionDescriptor(e.target.value)}
                    value={actionDescriptor}
                    type='text'
                  />
                </div>
                <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
                  <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term plural')}</div>
                  <input
                    className='p-2 border-none bg-transparent w-full outline-none'
                    maxLength='40'
                    name='actionDescriptorPlural'
                    onChange={e => setActionDescriptorPlural(e.target.value)}
                    value={actionDescriptorPlural}
                    type='text'
                  />
                </div>
              </div>

              <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2'>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    className={cn('p-2 rounded-md transition-colors', publishedAt ? 'bg-foreground/10' : 'bg-accent text-white')}
                    onClick={() => setPublishedAt(null)}
                  >
                    <EyeOff className='w-5 h-5' />
                  </button>
                  <button
                    type='button'
                    className={cn('p-2 rounded-md transition-colors', publishedAt ? 'bg-accent text-white' : 'bg-foreground/10')}
                    onClick={() => setPublishedAt(new Date().toISOString())}
                  >
                    <Eye className='w-5 h-5' />
                  </button>
                  <span>{publishedAt ? t('Published') : t('Unpublished')}</span>
                </div>
              </div>

              <div className='flex flex-col bg-input rounded-md p-2 gap-2'>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    className={cn('p-2 rounded-md transition-colors', accessControlled ? 'bg-accent text-white' : 'bg-foreground/10')}
                    onClick={() => setAccessControlled(v => !v)}
                  >
                    {accessControlled ? <Lock className='w-5 h-5' /> : <LockOpen className='w-5 h-5' />}
                  </button>
                  <span>{accessControlled ? t('Access Controlled') : t('Free Access')}</span>
                  <button
                    type='button'
                    className='p-1 rounded-md hover:bg-foreground/10 transition-colors'
                    onClick={() => setShowAccessControlInfo(v => !v)}
                  >
                    <Info className='w-4 h-4 text-foreground/50' />
                  </button>
                </div>
                {showAccessControlInfo && (
                  <p className='text-xs text-foreground/60 ml-1'>
                    {t('When enabled, users will need to purchase access or be granted access by an admin before they can access this track.')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
          <Button variant='secondary' disabled={!name.trim() || isSaving} onClick={handleSave}>
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
