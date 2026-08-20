import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Eye, EyeOff, ImagePlus } from 'lucide-react'

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
import { updateFundingRound, fetchFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { localSpaceSlug } from '@hylo/navigation'
import { updateSpace } from 'store/actions/groupViews'
import { updateTrack, fetchTrack } from 'store/actions/trackActions'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getTrack from 'store/selectors/getTrack'
import { groupRolesForPicker } from '@hylo/hooks/groupRoleHelpers'
import { cn } from 'util/index'

import FundingRoundSettingsFields from './FundingRoundSettingsFields'
import SpaceSlugField from './SpaceSlugField'
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
 * plus Track / Funding Round settings when the space is backed by either.
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

  // Track settings (only relevant when this space is backed by a Track)
  const [actionDescriptor, setActionDescriptor] = useState(track?.actionDescriptor || 'Action')
  const [actionDescriptorPlural, setActionDescriptorPlural] = useState(track?.actionDescriptorPlural || 'Actions')
  const [completionRole, setCompletionRole] = useState(track?.completionRole || null)
  const [publishedAt, setPublishedAt] = useState(track?.publishedAt || null)
  const completionMessageEditorRef = useRef(null)

  const accessOptions = useMemo(
    () => accessOptionsForGroup(parentGroup, { includePaid: Boolean(space?.paywall) }),
    [parentGroup, space?.paywall]
  )

  // Funding Round settings
  const [frPublishedAt, setFrPublishedAt] = useState(fundingRound?.publishedAt || null)
  const [frSubmissionsOpenAt, setFrSubmissionsOpenAt] = useState(toDateOrNull(fundingRound?.submissionsOpenAt))
  const [frSubmissionsCloseAt, setFrSubmissionsCloseAt] = useState(toDateOrNull(fundingRound?.submissionsCloseAt))
  const [frVotingOpensAt, setFrVotingOpensAt] = useState(toDateOrNull(fundingRound?.votingOpensAt))
  const [frVotingClosesAt, setFrVotingClosesAt] = useState(toDateOrNull(fundingRound?.votingClosesAt))
  const [frVotingMethod, setFrVotingMethod] = useState(fundingRound?.votingMethod || 'token_allocation_constant')
  const [frTotalTokens, setFrTotalTokens] = useState(fundingRound?.totalTokens ?? '')
  const [frTokenType, setFrTokenType] = useState(fundingRound?.tokenType || 'Votes')
  const [frAllowSelfVoting, setFrAllowSelfVoting] = useState(!!fundingRound?.allowSelfVoting)
  const [frHideFinalResults, setFrHideFinalResults] = useState(!!fundingRound?.hideFinalResultsFromParticipants)
  const [frSubmissionDescriptor, setFrSubmissionDescriptor] = useState(fundingRound?.submissionDescriptor || 'Submission')
  const [frSubmissionDescriptorPlural, setFrSubmissionDescriptorPlural] = useState(fundingRound?.submissionDescriptorPlural || 'Submissions')
  const [frSubmitterRoles, setFrSubmitterRoles] = useState(fundingRound?.submitterRoles || [])
  const [frVoterRoles, setFrVoterRoles] = useState(fundingRound?.voterRoles || [])
  const frCriteriaEditorRef = useRef(null)

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
    setPublishedAt(track.publishedAt || null)
    if (hasTrackSettings(track)) setCompletionRole(track.completionRole || null)
  }, [track?.id, track?.completionMessage, track?.completionRole?.id, track?.actionDescriptor, track?.actionDescriptorPlural, track?.publishedAt])

  const roundIsFull = hasFundingRoundSettings(fundingRound)
  useEffect(() => {
    if (!fundingRound?.id) return
    setFrPublishedAt(fundingRound.publishedAt || null)
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
    setFrHideFinalResults(!!fundingRound.hideFinalResultsFromParticipants)
    setFrSubmitterRoles(fundingRound.submitterRoles || [])
    setFrVoterRoles(fundingRound.voterRoles || [])
    // Full round object is read when roundIsFull flips; avoid depending on the selector's new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectedCompletionRole = useMemo(
    () => (completionRole?.id ? roles.find(role => String(role.id) === String(completionRole.id)) : null),
    [completionRole, roles]
  )

  const handleSave = useCallback(async () => {
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
        paywall: Boolean(accessOption.paywall)
      }))

      if (track?.id) {
        const completionMessage = completionMessageEditorRef.current?.getHTML?.() ?? track.completionMessage
        await dispatch(updateTrack({
          trackId: track.id,
          actionDescriptor,
          actionDescriptorPlural,
          completionMessage,
          completionRole,
          publishedAt
        }))
      }

      if (fundingRound?.id) {
        await dispatch(updateFundingRound({
          id: fundingRound.id,
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
  }, [dispatch, space?.id, parentGroup?.id, view?.id, name, slug, slugValid, description, icon, bannerUrl, purpose, locationObject, postTypes, access, accessOptions, requiredRoles, track?.id, actionDescriptor, actionDescriptorPlural, completionRole, publishedAt, fundingRound?.id, frPublishedAt, frSubmissionsOpenAt, frSubmissionsCloseAt, frVotingOpensAt, frVotingClosesAt, frVotingMethod, frTotalTokens, frTokenType, frAllowSelfVoting, frHideFinalResults, frSubmissionDescriptor, frSubmissionDescriptorPlural, frSubmitterRoles, frVoterRoles, onClose])

  if (!space) return null

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

        <SpaceSlugField
          parentSlug={parentGroup?.slug}
          value={slug}
          onChange={setSlug}
          currentStoredSlug={space.slug}
          onValidityChange={setSlugValid}
          forceShowError={showSlugError}
        />

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
            {accessOptions.map(option => (
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
                key={`${track.id}-${hasTrackSettings(track) ? 'full' : 'slim'}`}
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
                    if (roleId === 'none') {
                      setCompletionRole(null)
                      return
                    }
                    const role = roles.find(r => String(r.id) === String(roleId))
                    if (role) setCompletionRole(role)
                  }}
                  value={completionRole?.id ? String(completionRole.id) : 'none'}
                >
                  <SelectTrigger className='w-fit border-2 bg-input border-foreground/30 rounded-md p-2 text-base'>
                    <SelectValue>
                      {selectedCompletionRole ? `${selectedCompletionRole.emoji} ${selectedCompletionRole.name}` : t('None')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className='z-[1200]'>
                    <SelectItem value='none'>{t('None')}</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={String(role.id)}>
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
          </div>
        )}

        {fundingRound?.id && (
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
            groupIds={[space.id]}
            editorKey={`${fundingRound.id}-${roundIsFull ? 'full' : 'slim'}`}
            initialCriteria={fundingRound.criteria}
          />
        )}
      </div>

      <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
        <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
        <Button variant='secondary' disabled={!name.trim() || isSaving} onClick={handleSave}>
          {isSaving ? t('Saving...') : t('Save')}
        </Button>
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
