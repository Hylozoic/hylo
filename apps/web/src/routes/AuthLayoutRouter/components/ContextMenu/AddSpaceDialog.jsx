import React, { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { BadgeDollarSign, ImagePlus, Layers, MessageCircleMore, Plus, Shapes } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import IncludedViewsEditor from 'components/IncludedViewsEditor/IncludedViewsEditor'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import LocationInput from 'components/LocationInput/LocationInput'
import PostTypePills from 'components/PostTypePills/PostTypePills'
import TagInput from 'components/TagInput'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { CUSTOM_VIEW_DEFAULT_POST_TYPES, CUSTOM_VIEW_POST_TYPE_OPTIONS } from 'components/CustomViewForm/customViewFormConstants'
import { addQuerystringToPath, localSpaceSlug, spaceHomeUrl, spaceUrl } from '@hylo/navigation'
import { createSpace, createGroupView, updateGroupView } from 'store/actions/groupViews'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'
import { createTrack } from 'store/actions/trackActions'
import { createFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { POST_TYPE_TO_VIEW_TYPE } from 'store/models/GroupView'
import getMe from 'store/selectors/getMe'
import { cn } from 'util/index'
import { isOneColumnLayout } from 'util/navigationLayout'

import FundingRoundSettingsFields from './FundingRoundSettingsFields'
import { SPACE_ICON_SUGGESTIONS, accessOptionsForGroup, toIsoOrNull } from './spaceFormConstants'

const STANDARD_VIEW_TYPES = new Set([
  'all',
  'chat',
  'members',
  'welcome',
  'track-actions',
  'funding-round-submissions',
  ...Object.values(POST_TYPE_TO_VIEW_TYPE)
])

/** Space types selectable at creation — immutable afterward (no type switch in SpaceSettingsModal). */
const SPACE_TYPE_OPTIONS = [
  { value: 'custom', labelKey: 'Custom Space', icon: Layers },
  { value: 'chat', labelKey: 'Chat Space', icon: MessageCircleMore },
  { value: 'track', labelKey: 'Track', icon: Shapes },
  { value: 'funding-round', labelKey: 'Funding Round', icon: BadgeDollarSign }
]

/** Defaults for accepted post types / included views / icon based on the selected space type. */
function defaultsForSpaceType (spaceType) {
  switch (spaceType) {
    case 'chat':
      return {
        postTypes: [],
        standardViewTypes: ['chat'],
        icon: 'MessageCircleMore'
      }
    case 'track':
      return {
        postTypes: [],
        standardViewTypes: ['track-actions', 'chat', 'members', 'welcome'],
        icon: 'Shapes'
      }
    case 'funding-round':
      return {
        postTypes: [],
        standardViewTypes: ['funding-round-submissions', 'chat', 'members', 'welcome'],
        icon: 'BadgeDollarSign'
      }
    default:
      return {
        postTypes: [...CUSTOM_VIEW_DEFAULT_POST_TYPES],
        standardViewTypes: null,
        icon: 'Circle'
      }
  }
}

/** Post-type-derived views for Custom Space (All Activity, Chat, Members, then type views). */
function customSpaceStandardViews (postTypes, removedStandardTypes) {
  const base = ['all', 'chat', 'members']
  const postTypeViews = CUSTOM_VIEW_POST_TYPE_OPTIONS
    .filter(option => option.postTypes.every(type => postTypes.includes(type)))
    .map(option => POST_TYPE_TO_VIEW_TYPE[option.postTypes[0]])
  return [...base, ...postTypeViews].filter(type => !removedStandardTypes.has(type))
}

/** Modal for creating a new space under the current group.
 * Pass `addToMenu={false}` when adding from More Spaces (space view created off-menu). */
export default function AddSpaceDialog ({ group, onClose, onCreated, addToMenu = true }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const currentUser = useSelector(getMe)
  const isOneColumn = isOneColumnLayout(
    currentUser?.settings?.groupNavStyle,
    group?.settings?.layout
  )

  const [spaceType, setSpaceType] = useState('custom')
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(() => defaultsForSpaceType('custom').icon)
  const [bannerUrl, setBannerUrl] = useState('')
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [locationObject, setLocationObject] = useState(null)
  const [postTypes, setPostTypes] = useState(() => defaultsForSpaceType('custom').postTypes)
  const [removedStandardTypes, setRemovedStandardTypes] = useState(() => new Set())
  const [presetStandardViews, setPresetStandardViews] = useState(null)
  const [manualViews, setManualViews] = useState([])
  const [welcomeExtras, setWelcomeExtras] = useState(null)
  const [orderedRows, setOrderedRows] = useState([])
  const [access, setAccess] = useState('open')
  const [requiredRoles, setRequiredRoles] = useState([])
  const [roleSearchTerm, setRoleSearchTerm] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  // Funding Round settings (only used when creating a funding-round space)
  const [frPublishedAt, setFrPublishedAt] = useState(null)
  const [frSubmissionsOpenAt, setFrSubmissionsOpenAt] = useState(null)
  const [frSubmissionsCloseAt, setFrSubmissionsCloseAt] = useState(null)
  const [frVotingOpensAt, setFrVotingOpensAt] = useState(null)
  const [frVotingClosesAt, setFrVotingClosesAt] = useState(null)
  const [frVotingMethod, setFrVotingMethod] = useState('token_allocation_constant')
  const [frTotalTokens, setFrTotalTokens] = useState(100)
  const [frTokenType, setFrTokenType] = useState('Votes')
  const [frAllowSelfVoting, setFrAllowSelfVoting] = useState(false)
  const [frHideFinalResults, setFrHideFinalResults] = useState(false)
  const [frSubmissionDescriptor, setFrSubmissionDescriptor] = useState('Submission')
  const [frSubmissionDescriptorPlural, setFrSubmissionDescriptorPlural] = useState('Submissions')
  const [frSubmitterRoles, setFrSubmitterRoles] = useState([])
  const [frVoterRoles, setFrVoterRoles] = useState([])
  const frCriteriaEditorRef = useRef(null)

  /** Switches space type and resets post types / included views / icon to that type's defaults. */
  const handleSpaceTypeChange = useCallback((value) => {
    setSpaceType(value)
    const defaults = defaultsForSpaceType(value)
    setPostTypes(defaults.postTypes)
    setRemovedStandardTypes(new Set())
    setPresetStandardViews(defaults.standardViewTypes)
    setManualViews([])
    setIcon(defaults.icon)
  }, [])

  const groupRoles = useMemo(() => group?.groupRoles?.items || [], [group?.groupRoles?.items])
  const roles = useMemo(() => groupRoles.map(role => ({ ...role, type: 'group', label: `${role.emoji} ${role.name}` })), [groupRoles])

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

  const standardViewTypes = useMemo(() => {
    if (presetStandardViews) {
      return presetStandardViews.filter(type => !removedStandardTypes.has(type))
    }
    return customSpaceStandardViews(postTypes, removedStandardTypes)
  }, [presetStandardViews, postTypes, removedStandardTypes])

  /** Removes a standard view unless it is the current home (top) view. */
  const handleRemoveStandardView = useCallback((type) => {
    if (type === 'track-actions' || type === 'funding-round-submissions') return
    const homeRow = orderedRows[0]
    if (homeRow?.kind === 'standard' && homeRow.type === type) return
    setRemovedStandardTypes(prev => new Set(prev).add(type))
    if (type === 'welcome') setWelcomeExtras(null)
  }, [orderedRows])

  /** Removes a staged custom/link/text view unless it is the current home (top) view. */
  const handleRemoveManualView = useCallback((key) => {
    if (orderedRows[0]?.key === key) return
    setManualViews(prev => prev.filter(view => view.key !== key))
  }, [orderedRows])

  const handleAddView = useCallback((viewData) => {
    if (viewData.type === 'welcome') {
      setWelcomeExtras({
        pageContent: viewData.pageContent,
        showWelcomePage: viewData.showWelcomePage
      })
    }
    if (STANDARD_VIEW_TYPES.has(viewData.type)) {
      setRemovedStandardTypes(prev => {
        const next = new Set(prev)
        next.delete(viewData.type)
        return next
      })
      // Preset space types (track/chat/funding) may not already include this view — append it.
      setPresetStandardViews(prev => {
        if (!prev || prev.includes(viewData.type)) return prev
        return [...prev, viewData.type]
      })
      return
    }
    setManualViews(prev => [...prev, { ...viewData, key: `manual-${prev.length}-${Date.now()}` }])
  }, [])

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !group?.id) return
    setIsCreating(true)
    try {
      const accessOption = accessOptionsForGroup(group).find(option => option.value === access)
      const standardTypesInOrder = orderedRows.filter(row => row.kind === 'standard').map(row => row.type)
      const manualRowsInOrder = orderedRows.filter(row => row.kind === 'manual')
      // Fall back to standardViewTypes if IncludedViewsEditor hasn't reported order yet
      const viewTypes = standardTypesInOrder.length > 0 ? standardTypesInOrder : standardViewTypes

      const result = await dispatch(createSpace({
        parentGroupId: group.id,
        name: name.trim(),
        description: description || null,
        icon,
        bannerUrl: bannerUrl || null,
        purpose: purpose.trim() || null,
        location: locationObject?.fullText || null,
        locationId: locationObject?.id || null,
        acceptedPostTypes: postTypes,
        visibility: accessOption.visibility,
        accessibility: accessOption.accessibility,
        requiredRoles: access === 'role' ? requiredRoles.map(role => role.id) : null,
        paywall: Boolean(accessOption.paywall),
        viewTypes,
        addToMenu
      }))

      const newSpace = result?.payload?.data?.createSpace

      if (newSpace?.id && spaceType === 'track') {
        await dispatch(createTrack({
          groupId: newSpace.id,
          name: name.trim(),
          actionDescriptor: 'Action',
          actionDescriptorPlural: 'Actions'
        }))
      } else if (newSpace?.id && spaceType === 'funding-round') {
        await dispatch(createFundingRound({
          groupId: newSpace.id,
          title: name.trim(),
          publishedAt: toIsoOrNull(frPublishedAt),
          submissionsOpenAt: toIsoOrNull(frSubmissionsOpenAt),
          submissionsCloseAt: toIsoOrNull(frSubmissionsCloseAt),
          votingOpensAt: toIsoOrNull(frVotingOpensAt),
          votingClosesAt: toIsoOrNull(frVotingClosesAt),
          votingMethod: frVotingMethod,
          totalTokens: frTotalTokens === '' ? null : Number(frTotalTokens),
          tokenType: frTokenType,
          allowSelfVoting: frAllowSelfVoting,
          hideFinalResultsFromParticipants: frHideFinalResults,
          submissionDescriptor: frSubmissionDescriptor,
          submissionDescriptorPlural: frSubmissionDescriptorPlural,
          submitterRoles: frSubmitterRoles,
          voterRoles: frVoterRoles,
          criteria: frCriteriaEditorRef.current?.getHTML?.() || null
        }))
      }

      if (newSpace?.id && manualRowsInOrder.length > 0) {
        // Fetch the standard views the backend just seeded so manual (custom/link/text) views
        // can be inserted at their correct position rather than always appended at the end.
        const viewsResult = await dispatch(fetchGroupViews(newSpace.id))
        const createdViews = viewsResult?.payload?.data?.group?.groupViews?.items || []
        const idByType = createdViews.reduce((acc, view) => { acc[view.type] = view.id; return acc }, {})

        // Walk the full order in reverse so each manual view can be inserted in front of
        // whatever comes after it (already known, since we're going backwards) — this also
        // means a manual view left first overall correctly becomes the home view (order 0).
        let nextId = null
        for (let i = orderedRows.length - 1; i >= 0; i--) {
          const row = orderedRows[i]
          if (row.kind === 'standard') {
            nextId = idByType[row.type] || null
            continue
          }
          const createResult = await dispatch(createGroupView({
            groupId: newSpace.id,
            type: row.type,
            name: row.name,
            icon: row.icon,
            link: row.link,
            pageContent: row.pageContent,
            topics: row.topics,
            settings: row.settings,
            postId: row.postId,
            userId: row.userId,
            linkedGroupId: row.linkedGroupId,
            addToEnd: nextId == null,
            orderInFrontOfViewId: nextId || undefined
          }))
          nextId = createResult?.payload?.data?.createGroupView?.id || null
        }
      }

      if (newSpace?.id && welcomeExtras) {
        const viewsResult = await dispatch(fetchGroupViews(newSpace.id))
        const createdViews = viewsResult?.payload?.data?.group?.groupViews?.items || []
        const welcomeView = createdViews.find(view => view.type === 'welcome')
        if (welcomeView?.id && welcomeExtras.pageContent) {
          await dispatch(updateGroupView({
            id: welcomeView.id,
            groupId: newSpace.id,
            pageContent: welcomeExtras.pageContent
          }))
        }
        if (welcomeExtras.showWelcomePage !== undefined) {
          await dispatch(updateGroupSettings(newSpace.id, {
            settings: { showWelcomePage: welcomeExtras.showWelcomePage }
          }))
        }
      }

      // Before navigating: parent menu (fetchGroupViews), the new space's own
      // views + track/FR config, the creator's membership (fetchForCurrentUser —
      // without it SpaceContent greets the creator with the join page), and for
      // off-menu spaces the parent's spaces list, which is how the route resolves them.
      await Promise.all([
        dispatch(fetchGroupViews(group.id)),
        newSpace?.id ? dispatch(fetchGroupViews(newSpace.id)) : Promise.resolve(),
        dispatch(fetchForCurrentUser()),
        addToMenu === false && group?.slug ? dispatch(fetchForGroup(group.slug)) : Promise.resolve()
      ])
      onClose()
      if (onCreated) {
        onCreated(newSpace)
        return
      }
      // Open the new space's menu in edit mode so included views can be arranged.
      // Two-column: the space's home (sidebar becomes the space menu).
      // One-column: the space's own card-menu grid.
      if (newSpace?.slug && group?.slug) {
        const local = localSpaceSlug(group.slug, newSpace.slug)
        navigate(isOneColumn
          ? addQuerystringToPath(spaceUrl(group.slug, local), { edit: 'true' })
          : addQuerystringToPath(spaceHomeUrl(group.slug, newSpace), { edit: 'true' }))
      } else {
        navigate(addQuerystringToPath(routerLocation.pathname, { edit: 'true' }))
      }
    } catch (error) {
      console.error('Failed to create space:', error)
    } finally {
      setIsCreating(false)
    }
  }, [dispatch, group?.id, name, description, icon, bannerUrl, purpose, locationObject, postTypes, access, requiredRoles, spaceType, orderedRows, standardViewTypes, welcomeExtras, onClose, onCreated, navigate, routerLocation.pathname, addToMenu, isOneColumn, frPublishedAt, frSubmissionsOpenAt, frSubmissionsCloseAt, frVotingOpensAt, frVotingClosesAt, frVotingMethod, frTotalTokens, frTokenType, frAllowSelfVoting, frHideFinalResults, frSubmissionDescriptor, frSubmissionDescriptorPlural, frSubmitterRoles, frVoterRoles])

  // Portal above AuthLayout nav stacking so access radios / FR checkboxes remain clickable.
  return createPortal(
    <div className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 pointer-events-auto'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-[40rem] max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Add Space')}</h2>

        <div className='flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 p-1 -m-1'>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
            {SPACE_TYPE_OPTIONS.map(option => {
              const OptionIcon = option.icon
              const isSelected = spaceType === option.value
              return (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => handleSpaceTypeChange(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-all',
                    isSelected
                      ? 'border-selected bg-selected/20'
                      : 'border-foreground/20 hover:border-foreground/50'
                  )}
                >
                  <OptionIcon className='w-4 h-4' />
                  <span className='text-sm'>{t(option.labelKey)}</span>
                </button>
              )
            })}
          </div>

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
            <label className='text-sm text-foreground/70'>{t('Name')}</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('Space name')}
            />
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

          <IncludedViewsEditor
            key={spaceType}
            standardViewTypes={standardViewTypes}
            onRemoveStandardType={handleRemoveStandardView}
            manualViews={manualViews}
            onAddView={handleAddView}
            onRemoveManualView={handleRemoveManualView}
            acceptedPostTypes={postTypes}
            onOrderedRowsChange={setOrderedRows}
          />

          <div className='flex flex-col gap-2'>
            <label className='text-sm text-foreground/70'>{t('Access')}</label>
            <RadioGroup value={access} onValueChange={setAccess}>
              {accessOptionsForGroup(group).map(option => (
                <div key={option.value} className='flex flex-col gap-1 mb-2'>
                  <div className='flex items-start gap-2'>
                    <RadioGroupItem value={option.value} id={`space-access-${option.value}`} className='mt-0.5 shrink-0' />
                    <Label htmlFor={`space-access-${option.value}`} className='cursor-pointer flex flex-wrap items-baseline gap-x-2'>
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

          {spaceType === 'funding-round' && (
            <FundingRoundSettingsFields
              publishedAt={frPublishedAt}
              setPublishedAt={setFrPublishedAt}
              submissionDescriptor={frSubmissionDescriptor}
              setSubmissionDescriptor={setFrSubmissionDescriptor}
              submissionDescriptorPlural={frSubmissionDescriptorPlural}
              setSubmissionDescriptorPlural={setFrSubmissionDescriptorPlural}
              submissionsOpenAt={frSubmissionsOpenAt}
              setSubmissionsOpenAt={setFrSubmissionsOpenAt}
              submissionsCloseAt={frSubmissionsCloseAt}
              setSubmissionsCloseAt={setFrSubmissionsCloseAt}
              votingOpensAt={frVotingOpensAt}
              setVotingOpensAt={setFrVotingOpensAt}
              votingClosesAt={frVotingClosesAt}
              setVotingClosesAt={setFrVotingClosesAt}
              votingMethod={frVotingMethod}
              setVotingMethod={setFrVotingMethod}
              totalTokens={frTotalTokens}
              setTotalTokens={setFrTotalTokens}
              tokenType={frTokenType}
              setTokenType={setFrTokenType}
              allowSelfVoting={frAllowSelfVoting}
              setAllowSelfVoting={setFrAllowSelfVoting}
              hideFinalResults={frHideFinalResults}
              setHideFinalResults={setFrHideFinalResults}
              submitterRoles={frSubmitterRoles}
              setSubmitterRoles={setFrSubmitterRoles}
              voterRoles={frVoterRoles}
              setVoterRoles={setFrVoterRoles}
              roles={roles}
              criteriaEditorRef={frCriteriaEditorRef}
              groupIds={group?.id ? [group.id] : []}
              editorKey='create'
            />
          )}
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
          <Button variant='secondary' disabled={!name.trim() || isCreating} onClick={handleCreate}>
            {isCreating ? t('Creating...') : t('Create')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Button row for adding spaces in edit mode. */
export function AddSpaceButton ({ onClick, className }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full text-base text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 rounded-md p-2 pl-2 mb-2 transition-all opacity-85 hover:opacity-100',
        className
      )}
    >
      <Plus className='w-4 h-4' />
      <span>{t('Add Space')}</span>
    </button>
  )
}
