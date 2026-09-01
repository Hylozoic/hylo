import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Hand, ImagePlus, LayoutGrid, MapPin, Trash2 } from 'lucide-react'

import { AdvancedPill, AdvancedSection } from 'components/AdvancedSettings/AdvancedSettings'
import Button from 'components/ui/button'
import { FIELD_LABEL_CLASS, INPUT_CLASS } from 'components/ui/form-field'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { Input } from 'components/ui/input'
import HyloEditor from 'components/HyloEditor'
import LocationInput from 'components/LocationInput/LocationInput'
import PostTypePills from 'components/PostTypePills/PostTypePills'
import SettingSelectRow from 'components/SettingSelectRow/SettingSelectRow'
import SwitchStyled from 'components/SwitchStyled'
import TagInput from 'components/TagInput'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { updateFundingRound, fetchFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { localSpaceSlug } from '@hylo/navigation'
import { createGroupView, updateGroupView, updateSpace } from 'store/actions/groupViews'
import { updateTrack, fetchTrack } from 'store/actions/trackActions'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getTrack from 'store/selectors/getTrack'
import { groupRolesForPicker } from '@hylo/hooks/groupRoleHelpers'
import { DEFAULT_BANNER } from 'store/models/Group'
import { cn } from 'util/index'

import FundingRoundSettingsFields from './FundingRoundSettingsFields'
import SpaceIconRow from './SpaceIconRow'
import SpaceSlugField from './SpaceSlugField'
import TrackSettingsFields from './TrackSettingsFields'
import { SPACE_ICON_SUGGESTIONS, accessOptionsForGroup, accessValueForSpace, toIsoOrNull } from './spaceFormConstants'

function toDateOrNull (value) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function hasTrackSettings (track) {
  return Boolean(track && Object.prototype.hasOwnProperty.call(track, 'completionMessage'))
}

function hasFundingRoundSettings (round) {
  return Boolean(round && Object.prototype.hasOwnProperty.call(round, 'criteria'))
}

function roleItems (g) {
  if (!g) return []
  return g.groupRoles?.items || g.ref?.groupRoles?.items || []
}

/** Modal for editing an existing space's settings — same fields as AddSpaceDialog's creation form,
 * including Track / Funding Round settings when the space is backed by either.
 * `parentGroup` is the containing group (never the space). `space` can be passed directly
 * (e.g. More Spaces) or taken from optional parent-menu `view.linkedGroup`. */
export default function SpaceSettingsModal ({ space: spaceProp, view, parentGroup: parentGroupProp, onClose, inline = false }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const passedSpace = spaceProp || view?.linkedGroup
  const spaceFromStore = useSelector(state => {
    const slug = passedSpace?.slug
    if (!slug) return null
    return getGroupForSlug(state, slug)?.ref || null
  })
  const parentFromStore = useSelector(state => {
    const slug = parentGroupProp?.slug
    if (!slug) return null
    return getGroupForSlug(state, slug)?.ref || null
  })
  const parentGroup = parentFromStore || parentGroupProp
  // Prefer the normalized Group so track / fundingRound survive slim linkedGroup payloads.
  const space = (passedSpace || spaceFromStore)
    ? {
        ...passedSpace,
        ...spaceFromStore,
        track: spaceFromStore?.track || passedSpace?.track,
        fundingRound: spaceFromStore?.fundingRound || passedSpace?.fundingRound
      }
    : null
  const welcomeView = useSelector(state => {
    const slug = passedSpace?.slug
    if (!slug) return null
    const views = getGroupForSlug(state, slug)?.groupViews?.toModelArray?.() || []
    return views.find(view => view.type === 'welcome')?.ref || null
  })
  const fetchedTrack = useSelector(state => space?.track?.id ? getTrack(state, space.track.id) : null)
  const fetchedRound = useSelector(state => space?.fundingRound?.id ? getFundingRound(state, space.fundingRound.id) : null)
  const track = fetchedTrack || space?.track
  const fundingRound = fetchedRound || space?.fundingRound
  const modalTitle = track
    ? t('Track Space Settings')
    : fundingRound
      ? t('Funding Round Space Settings')
      : t('Space Settings')

  const [name, setName] = useState(space?.name || view?.name || '')
  const [slug, setSlug] = useState(() => localSpaceSlug(parentGroup?.slug, space?.slug))
  const [slugValid, setSlugValid] = useState(true)
  const [showSlugError, setShowSlugError] = useState(false)
  const [icon, setIcon] = useState(space?.icon || SPACE_ICON_SUGGESTIONS[0])
  const [bannerUrl, setBannerUrl] = useState(space?.bannerUrl || '')
  const [purpose, setPurpose] = useState(space?.purpose || '')
  const [description, setDescription] = useState(space?.description || '')
  const [locationObject, setLocationObject] = useState(space?.locationObject || null)
  const [postTypes, setPostTypes] = useState(space?.acceptedPostTypes || [])
  const [access, setAccess] = useState(() => accessValueForSpace({
    visibility: space?.visibility,
    accessibility: space?.accessibility,
    requiredRoles: space?.requiredRoles,
    paywall: space?.paywall
  }))
  const [requiredRoles, setRequiredRoles] = useState(() => {
    const roleIds = space?.requiredRoles || []
    const sourceRoles = roleItems(parentGroup)
    const roleById = new Map(sourceRoles.map(role => [String(role.id), role]))
    return roleIds.map(id => roleById.get(String(id))).filter(Boolean)
  })
  const [roleSearchTerm, setRoleSearchTerm] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [openAdvanced, setOpenAdvanced] = useState(() => new Set())
  const [justRevealed, setJustRevealed] = useState(null)
  // Welcome edits only save if the panel was ever opened
  const [welcomeTouched, setWelcomeTouched] = useState(false)
  const [welcomeDraft, setWelcomeDraft] = useState(null)
  const [showWelcomePage, setShowWelcomePage] = useState(space?.settings?.showWelcomePage ?? true)
  const welcomeEditorRef = useRef(null)

  // Track settings (only relevant when this space is backed by a Track)
  const [actionDescriptor, setActionDescriptor] = useState(track?.actionDescriptor || 'Action')
  const [actionDescriptorPlural, setActionDescriptorPlural] = useState(track?.actionDescriptorPlural || 'Actions')
  const [completionRole, setCompletionRole] = useState(track?.completionRole || null)
  const completionMessageEditorRef = useRef(null)

  const accessOptions = useMemo(
    () => accessOptionsForGroup(parentGroup, { includePaid: Boolean(space?.paywall) }),
    [parentGroup, space?.paywall]
  )

  const accessSelectOptions = useMemo(
    () => accessOptions.map(option => ({
      value: option.value,
      icon: option.icon,
      title: option.labelKey,
      description: option.descKey
    })),
    [accessOptions]
  )

  // Funding Round settings
  const [frSubmissionsOpenAt, setFrSubmissionsOpenAt] = useState(toDateOrNull(fundingRound?.submissionsOpenAt))
  const [frSubmissionsCloseAt, setFrSubmissionsCloseAt] = useState(toDateOrNull(fundingRound?.submissionsCloseAt))
  const [frVotingOpensAt, setFrVotingOpensAt] = useState(toDateOrNull(fundingRound?.votingOpensAt))
  const [frVotingClosesAt, setFrVotingClosesAt] = useState(toDateOrNull(fundingRound?.votingClosesAt))
  const [frVotingMethod, setFrVotingMethod] = useState(fundingRound?.votingMethod || 'token_allocation_constant')
  const [frTotalTokens, setFrTotalTokens] = useState(fundingRound?.totalTokens ?? '')
  const [frTokenType, setFrTokenType] = useState(fundingRound?.tokenType || 'Votes')
  const [frAllowSelfVoting, setFrAllowSelfVoting] = useState(!!fundingRound?.allowSelfVoting)
  const [frAllowLateJoiners, setFrAllowLateJoiners] = useState(!!fundingRound?.allowLateJoiners)
  const [frHideFinalResults, setFrHideFinalResults] = useState(!!fundingRound?.hideFinalResultsFromParticipants)
  const [frSubmissionDescriptor, setFrSubmissionDescriptor] = useState(fundingRound?.submissionDescriptor || 'Submission')
  const [frSubmissionDescriptorPlural, setFrSubmissionDescriptorPlural] = useState(fundingRound?.submissionDescriptorPlural || 'Submissions')
  const [frSubmitterRoles, setFrSubmitterRoles] = useState(fundingRound?.submitterRoles || [])
  const [frVoterRoles, setFrVoterRoles] = useState(fundingRound?.voterRoles || [])
  const frCriteriaEditorRef = useRef(null)

  // The welcome panel edits the space's welcome view — make sure its
  // pageContent is actually loaded (menu payloads are slim).
  useEffect(() => {
    if (space?.id) dispatch(fetchGroupViews(space.id))
  }, [dispatch, space?.id])

  const toggleAdvanced = useCallback((key) => {
    const isOpen = openAdvanced.has(key)
    if (isOpen && key === 'welcome') {
      // The editor unmounts with the panel — keep the drafted page in state.
      setWelcomeDraft(current => welcomeEditorRef.current?.getHTML?.() ?? current)
    }
    if (!isOpen) {
      setJustRevealed(key)
      if (key === 'welcome') setWelcomeTouched(true)
    }
    setOpenAdvanced(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [openAdvanced])

  // Revealed editors append below the pills, often past the fold — bring the new one
  // into view so clicking a pill visibly does something.
  useEffect(() => {
    if (!justRevealed) return
    const element = document.querySelector(`[data-advanced-key="${justRevealed}"]`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    setJustRevealed(null)
  }, [justRevealed])

  useEffect(() => {
    const trackId = space?.track?.id
    if (!trackId || fetchedTrack?.id) return
    if (hasTrackSettings(spaceFromStore?.track) || hasTrackSettings(passedSpace?.track)) return
    dispatch(fetchTrack(trackId))
  }, [dispatch, space?.track?.id, fetchedTrack?.id, spaceFromStore?.track, passedSpace?.track])

  useEffect(() => {
    const roundId = space?.fundingRound?.id
    if (!roundId || fetchedRound?.id) return
    if (hasFundingRoundSettings(spaceFromStore?.fundingRound) || hasFundingRoundSettings(passedSpace?.fundingRound)) return
    dispatch(fetchFundingRound(roundId))
  }, [dispatch, space?.fundingRound?.id, fetchedRound?.id, spaceFromStore?.fundingRound, passedSpace?.fundingRound])

  // Hydrate track / round fields if they arrive after the modal opened (slim menu payload first).
  useEffect(() => {
    if (!track?.id) return
    setActionDescriptor(track.actionDescriptor || 'Action')
    setActionDescriptorPlural(track.actionDescriptorPlural || 'Actions')
    if (hasTrackSettings(track)) setCompletionRole(track.completionRole || null)
  }, [track?.id, track?.completionMessage, track?.completionRole?.id, track?.actionDescriptor, track?.actionDescriptorPlural])

  const roundIsFull = hasFundingRoundSettings(fundingRound)
  useEffect(() => {
    if (!fundingRound?.id) return
    setFrSubmissionDescriptor(fundingRound.submissionDescriptor || 'Submission')
    setFrSubmissionDescriptorPlural(fundingRound.submissionDescriptorPlural || 'Submissions')
    if (!roundIsFull) return
    setFrSubmissionsOpenAt(toDateOrNull(fundingRound.submissionsOpenAt))
    setFrSubmissionsCloseAt(toDateOrNull(fundingRound.submissionsCloseAt))
    setFrVotingOpensAt(toDateOrNull(fundingRound.votingOpensAt))
    setFrVotingClosesAt(toDateOrNull(fundingRound.votingClosesAt))
    setFrVotingMethod(fundingRound.votingMethod || 'token_allocation_constant')
    setFrTotalTokens(fundingRound.totalTokens ?? '')
    setFrTokenType(fundingRound.tokenType || 'Votes')
    setFrAllowSelfVoting(!!fundingRound.allowSelfVoting)
    setFrAllowLateJoiners(!!fundingRound.allowLateJoiners)
    setFrHideFinalResults(!!fundingRound.hideFinalResultsFromParticipants)
    setFrSubmitterRoles(fundingRound.submitterRoles || [])
    setFrVoterRoles(fundingRound.voterRoles || [])
    // Full round object is read when roundIsFull flips; avoid depending on the selector's new object each render.
  }, [fundingRound?.id, roundIsFull])

  // Spaces inherit role definitions from the parent group (no per-space groups_roles rows).
  const roles = useMemo(
    () => groupRolesForPicker(roleItems(parentGroup)),
    [parentGroup]
  )

  const roleSuggestions = useMemo(() => {
    if (roleSearchTerm === null) return []
    const unselectedRoles = roles.filter(role => !requiredRoles.some(selected => selected.id === role.id))
    if (!roleSearchTerm) return unselectedRoles
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

  const handleSave = useCallback(async (status) => {
    if (!name.trim() || !space?.id || !parentGroup?.id) return
    if (!slugValid) {
      setShowSlugError(true)
      return
    }
    setIsSaving(true)
    try {
      const accessOption = accessOptions.find(option => option.value === access)
      const trimmedName = name.trim()

      // Space menu labels use linkedGroup.name — do not snapshot the name onto group_views.
      await dispatch(updateSpace({
        id: space.id,
        groupId: parentGroup.id,
        spaceViewId: view?.id,
        name: trimmedName,
        slug,
        description: description || null,
        icon,
        bannerUrl: bannerUrl || null,
        purpose: purpose.trim() || null,
        location: locationObject?.fullText || null,
        locationId: locationObject?.id || null,
        acceptedPostTypes: postTypes,
        visibility: accessOption.visibility,
        accessibility: accessOption.accessibility,
        requiredRoles: access === 'role' ? requiredRoles.map(role => role.id) : [],
        paywall: Boolean(accessOption.paywall),
        status
      }))

      if (welcomeTouched) {
        const pageContent = welcomeEditorRef.current?.getHTML?.() ?? welcomeDraft ?? welcomeView?.pageContent ?? ''
        if (welcomeView?.id) {
          if (pageContent !== (welcomeView.pageContent || '')) {
            await dispatch(updateGroupView({ id: welcomeView.id, groupId: space.id, pageContent }))
          }
        } else {
          await dispatch(createGroupView({ groupId: space.id, type: 'welcome', pageContent, addToEnd: true }))
        }
        if (showWelcomePage !== (space?.settings?.showWelcomePage ?? true)) {
          await dispatch(updateGroupSettings(space.id, { settings: { showWelcomePage } }))
        }
      }

      if (track?.id) {
        const completionMessage = completionMessageEditorRef.current?.getHTML?.() ?? track.completionMessage
        await dispatch(updateTrack({
          trackId: track.id,
          actionDescriptor,
          actionDescriptorPlural,
          completionMessage,
          completionRole
        }))
      }

      if (fundingRound?.id) {
        await dispatch(updateFundingRound({
          id: fundingRound.id,
          submissionsOpenAt: toIsoOrNull(frSubmissionsOpenAt),
          submissionsCloseAt: toIsoOrNull(frSubmissionsCloseAt),
          votingOpensAt: toIsoOrNull(frVotingOpensAt),
          votingClosesAt: toIsoOrNull(frVotingClosesAt),
          votingMethod: frVotingMethod,
          totalTokens: frTotalTokens === '' ? null : Number(frTotalTokens),
          tokenType: frTokenType,
          allowSelfVoting: frAllowSelfVoting,
          allowLateJoiners: frAllowLateJoiners,
          hideFinalResultsFromParticipants: frHideFinalResults,
          submissionDescriptor: frSubmissionDescriptor,
          submissionDescriptorPlural: frSubmissionDescriptorPlural,
          submitterRoles: frSubmitterRoles,
          voterRoles: frVoterRoles,
          criteria: frCriteriaEditorRef.current?.getHTML?.() ?? fundingRound.criteria
        }))
      }

      // Refresh the space's own views (typed views appear/disappear with acceptedPostTypes)
      // and the parent menu so nested space labels/copies stay in sync.
      await dispatch(fetchGroupViews(space.id))
      await dispatch(fetchGroupViews(parentGroup.id))
      if (!view?.id) {
        await dispatch(fetchGroupSpaces(parentGroup.id))
      }
      onClose()
    } catch (error) {
      console.error('Failed to save space settings:', error)
    } finally {
      setIsSaving(false)
    }
  }, [dispatch, space?.id, parentGroup?.id, view?.id, name, slug, slugValid, description, icon, bannerUrl, purpose, locationObject, postTypes, access, accessOptions, requiredRoles, welcomeTouched, welcomeDraft, welcomeView, showWelcomePage, space?.settings?.showWelcomePage, track?.id, actionDescriptor, actionDescriptorPlural, completionRole, fundingRound?.id, frSubmissionsOpenAt, frSubmissionsCloseAt, frVotingOpensAt, frVotingClosesAt, frVotingMethod, frTotalTokens, frTokenType, frAllowSelfVoting, frAllowLateJoiners, frHideFinalResults, frSubmissionDescriptor, frSubmissionDescriptorPlural, frSubmitterRoles, frVoterRoles, onClose])

  const advancedSettings = useMemo(() => [
    {
      key: 'location',
      icon: MapPin,
      label: 'Location',
      defaultSummary: locationObject?.fullText || t('No location'),
      render: () => (
        <LocationInput
          locationObject={locationObject}
          location={locationObject?.fullText || ''}
          onChange={setLocationObject}
          className={INPUT_CLASS}
        />
      )
    },
    {
      key: 'postTypes',
      icon: LayoutGrid,
      label: 'Post types',
      defaultSummary: postTypes.length > 0 ? postTypes.join(', ') : t('None'),
      render: () => (
        <PostTypePills postTypes={postTypes} onPostTypesChange={setPostTypes} label={t('Accepted post types')} />
      )
    },
    {
      key: 'welcome',
      icon: Hand,
      label: 'Welcome',
      defaultSummary: welcomeView ? null : t('No welcome page'),
      render: () => (
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <SwitchStyled
              checked={showWelcomePage}
              onChange={() => setShowWelcomePage(v => !v)}
              backgroundColor={showWelcomePage ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
            />
            <span className='text-sm text-foreground/80'>
              {t('Show this welcome page to new members when they first land in the space.')}
            </span>
          </div>
          <HyloEditor
            key={welcomeView?.id ? `welcome-${welcomeView.id}` : 'welcome-new'}
            contentHTML={welcomeDraft ?? welcomeView?.pageContent ?? ''}
            className='min-h-[120px] p-2'
            containerClassName='hyloEditor flex flex-col border border-foreground/20 rounded-lg bg-input'
            extendedMenu
            groupIds={space?.id ? [space.id] : []}
            ref={welcomeEditorRef}
            showMenu
            type='welcomePage'
          />
        </div>
      )
    }
  ], [t, locationObject, postTypes, welcomeView, welcomeDraft, showWelcomePage, space?.id])

  const revealedSettings = advancedSettings.filter(setting => openAdvanced.has(setting.key))

  if (!space) return null

  const spaceStatus = space.status || 'published'
  const isFundingRoundLifecycle = ['submissions', 'discussion', 'voting', 'completed'].includes(spaceStatus)
  const hasBanner = Boolean(bannerUrl && bannerUrl !== DEFAULT_BANNER)

  /** Clear the banner locally; an empty value is persisted as a delete on save. */
  const handleRemoveBanner = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setBannerUrl('')
  }

  const panel = (
    <div className={inline ? 'flex flex-col' : 'bg-midground rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-[40rem] max-h-[85vh] flex flex-col'}>
      {!inline && <h2 className='text-lg font-semibold mb-4'>{modalTitle}</h2>}

      <div className={inline ? 'flex flex-col gap-3' : 'flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 p-1 -m-1'}>
        <UploadAttachmentButton
          type='groupBanner'
          onInitialUpload={({ url }) => setBannerUrl(url)}
          className='w-full group'
        >
          <div
            className={cn('relative w-full h-[20vh] flex flex-col items-center justify-center border-2 border-dashed border-foreground/50 rounded-lg shadow-md bg-cover bg-center bg-darkening/0 hover:bg-darkening/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': hasBanner })}
            style={hasBanner ? { backgroundImage: `url(${bannerUrl})` } : undefined}
          >
            {hasBanner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    onClick={handleRemoveBanner}
                    aria-label={t('Remove Banner')}
                    className='absolute top-2 right-6 z-10 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-destructive transition-all'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent className='z-[1200]'>{t('Remove Banner')}</TooltipContent>
              </Tooltip>
            )}
            <div className='flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 text-white opacity-60 group-hover:opacity-100 transition-opacity'>
              <ImagePlus className='w-4 h-4' />
              <span className='text-xs font-semibold'>{t('Set space banner')}</span>
            </div>
          </div>
        </UploadAttachmentButton>

        <SpaceIconRow value={icon} onChange={setIcon} />

        <div className='grid grid-cols-1 sm:grid-cols-[1.35fr_1fr] gap-3 items-start'>
          <div className='flex flex-col gap-1'>
            <div className='h-5 flex items-center'>
              <label className={FIELD_LABEL_CLASS}>{t('Name')}</label>
            </div>
            <Input
              className={INPUT_CLASS}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('Space name')}
            />
          </div>

          <SpaceSlugField
            parentSlug={parentGroup?.slug}
            value={slug}
            onChange={setSlug}
            currentStoredSlug={space.slug}
            onValidityChange={setSlugValid}
            forceShowError={showSlugError}
          />
        </div>

        <div className='flex flex-col gap-1'>
          <label className={FIELD_LABEL_CLASS}>{t('Purpose')}</label>
          <Input
            className={INPUT_CLASS}
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder={t('What is this space for?')}
          />
        </div>

        <div className='flex flex-col gap-1'>
          <label className={FIELD_LABEL_CLASS}>{t('Description')}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('Description (optional)')}
            rows={3}
            className={cn(INPUT_CLASS, 'min-h-[80px] resize-none')}
          />
        </div>

        <div className='flex flex-col gap-2'>
          <label className={FIELD_LABEL_CLASS}>{t('Access')}</label>
          <SettingSelectRow
            label='Access'
            value={access}
            onChange={setAccess}
            options={accessSelectOptions}
            popoverClassName='z-[1200]'
          />
          {access === 'role' && (
            <div className='ml-12 flex flex-row items-center relative border-2 border-transparent shadow-md transition-all duration-200 group focus-within:border-focus bg-input rounded-md'>
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

        {track?.id && (
          <TrackSettingsFields
            actionDescriptor={actionDescriptor}
            setActionDescriptor={setActionDescriptor}
            actionDescriptorPlural={actionDescriptorPlural}
            setActionDescriptorPlural={setActionDescriptorPlural}
            completionRole={completionRole}
            setCompletionRole={setCompletionRole}
            roles={roles}
            completionMessageEditorRef={completionMessageEditorRef}
            groupIds={[space.id]}
            editorKey={`${track.id}-${hasTrackSettings(track) ? 'full' : 'slim'}`}
            initialCompletionMessage={track.completionMessage}
          />
        )}

        {fundingRound?.id && (
          <FundingRoundSettingsFields
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
            allowLateJoiners={frAllowLateJoiners}
            setAllowLateJoiners={setFrAllowLateJoiners}
            hideFinalResults={frHideFinalResults}
            setHideFinalResults={setFrHideFinalResults}
            submitterRoles={frSubmitterRoles}
            setSubmitterRoles={setFrSubmitterRoles}
            voterRoles={frVoterRoles}
            setVoterRoles={setFrVoterRoles}
            roles={roles}
            criteriaEditorRef={frCriteriaEditorRef}
            groupIds={[space.id]}
            editorKey={`${fundingRound.id}-${roundIsFull ? 'full' : 'slim'}`}
            initialCriteria={fundingRound.criteria}
          />
        )}

        <div className='mt-2 pt-4 border-t border-foreground/10'>
          <h2 className={cn(FIELD_LABEL_CLASS, 'm-0 mb-2')}>{t('Additional settings')}</h2>

          <div className='flex flex-wrap gap-2'>
            {advancedSettings.map(setting => (
              <AdvancedPill
                key={setting.key}
                isOpen={openAdvanced.has(setting.key)}
                icon={setting.icon}
                label={setting.label}
                defaultSummary={setting.defaultSummary}
                onClick={() => toggleAdvanced(setting.key)}
              />
            ))}
          </div>

          {revealedSettings.length > 0 && (
            <div className='flex flex-col gap-3 mt-4'>
              {revealedSettings.map(setting => (
                <AdvancedSection
                  key={setting.key}
                  settingKey={setting.key}
                  icon={setting.icon}
                  label={setting.label}
                  onHide={() => toggleAdvanced(setting.key)}
                >
                  {setting.render()}
                </AdvancedSection>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
        <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
        {isFundingRoundLifecycle
          ? (
            <Button variant='secondary' disabled={!name.trim() || isSaving} onClick={() => handleSave()}>
              {isSaving ? t('Saving...') : t('Save')}
            </Button>
            )
          : (
            <>
              <Button variant='primary' disabled={!name.trim() || isSaving} onClick={() => handleSave('draft')}>
                {isSaving ? t('Saving...') : t('Save Draft')}
              </Button>
              <Button variant='secondary' disabled={!name.trim() || isSaving} onClick={() => handleSave('published')}>
                {isSaving ? t('Saving...') : t('Publish')}
              </Button>
            </>
            )}
      </div>
    </div>
  )

  if (inline) return panel

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose()
  }

  // Portal above AuthLayout nav stacking (nav is z-50); otherwise the left edge of the
  // centered panel sits under GlobalNav/ContextMenu and radio/checkbox hit targets miss.
  return createPortal(
    <div
      className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 pointer-events-auto'
      onClick={handleBackdropClick}
    >
      {panel}
    </div>,
    document.body
  )
}
