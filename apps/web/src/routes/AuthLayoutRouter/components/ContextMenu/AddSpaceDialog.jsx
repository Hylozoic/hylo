import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import useTour from 'tours/useTour'
import { SPACE_CREATE_TOUR_ID, spaceCreateTourSteps } from 'tours/spaceCreateTour'
import { TRACK_SETUP_TOUR_ID, trackSetupTourSteps } from 'tours/trackSetupTour'
import { FUNDING_ROUND_SETUP_TOUR_ID, fundingRoundSetupTourSteps } from 'tours/fundingRoundSetupTour'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { Activity, BadgeDollarSign, Hand, ImagePlus, Layers, LayoutGrid, MapPin, MessageCircleMore, Plus, Settings, Shapes } from 'lucide-react'

import Button from 'components/ui/button'
import { FIELD_LABEL_CLASS, INPUT_CLASS } from 'components/ui/form-field'
import { Input } from 'components/ui/input'
import { AdvancedPill, AdvancedSection } from 'components/AdvancedSettings/AdvancedSettings'
import HomeViewPicker from 'components/HomeViewPicker/HomeViewPicker'
import HyloEditor from 'components/HyloEditor'
import IncludedViewsEditor from 'components/IncludedViewsEditor/IncludedViewsEditor'
import LocationInput from 'components/LocationInput/LocationInput'
import PostTypePills from 'components/PostTypePills/PostTypePills'
import SettingSelectRow from 'components/SettingSelectRow/SettingSelectRow'
import SwitchStyled from 'components/SwitchStyled'
import TagInput from 'components/TagInput'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { CUSTOM_VIEW_DEFAULT_POST_TYPES, CUSTOM_VIEW_POST_TYPE_OPTIONS } from 'components/CustomViewForm/customViewFormConstants'
import { addQuerystringToPath, localSpaceSlug, spaceHomeUrl, spaceUrl } from '@hylo/navigation'
import { nameToSlug } from 'routes/CreateGroup/slug'
import { createSpace, createGroupView, updateGroupView } from 'store/actions/groupViews'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'
import { createTrack } from 'store/actions/trackActions'
import { createFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { CUSTOM_HOME_VIEW, POST_TYPE_TO_VIEW_TYPE, viewTypesForCreate } from 'store/models/GroupView'
import { groupRolesForPicker } from '@hylo/hooks/groupRoleHelpers'
import getMe from 'store/selectors/getMe'
import { cn } from 'util/index'
import { isOneColumnLayout } from 'util/navigationLayout'

import FundingRoundSettingsFields from './FundingRoundSettingsFields'
import SpaceIconRow from './SpaceIconRow'
import SpaceSlugField from './SpaceSlugField'
import TrackSettingsFields from './TrackSettingsFields'
import { accessOptionsForGroup, toIsoOrNull } from './spaceFormConstants'

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

/** Home options a custom space can lead with — spaces have no map view; any other
 * view promoted to the top of the menu takes the first segment's place. */
const SPACE_HOME_VIEW_OPTIONS = [
  {
    value: 'STREAM',
    viewType: 'all',
    icon: Activity,
    title: 'Activity Stream',
    description: "A sorted feed of all your space's posts"
  },
  {
    value: 'CHAT',
    viewType: 'chat',
    icon: MessageCircleMore,
    title: 'Chat',
    description: 'A real-time chat room for quick conversations, coordination and casual interactions.'
  }
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

  // First-open tour of the space form's load-bearing choices, offered by invitation
  const spaceTourStepList = useMemo(() => spaceCreateTourSteps(t), [t])
  const { invitation: spaceTourInvitation } = useTour({
    id: SPACE_CREATE_TOUR_ID,
    steps: spaceTourStepList,
    autoStart: true,
    autoStartDelay: 1200,
    inviteMessage: t('Creating a space? Take a quick tour of the big decisions.')
  })

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const currentUser = useSelector(getMe)
  const isOneColumn = isOneColumnLayout(
    currentUser?.settings?.groupNavStyle,
    group?.settings?.layout
  )

  const [spaceType, setSpaceType] = useState('custom')
  // Type-specific tours when the Track or Funding Round type is selected
  const trackTourStepList = useMemo(() => trackSetupTourSteps(t), [t])
  const { invitation: trackTourInvitation } = useTour({
    id: TRACK_SETUP_TOUR_ID,
    steps: trackTourStepList,
    autoStart: true,
    autoStartDelay: 1200,
    enabled: spaceType === 'track',
    inviteMessage: t('Setting up a track? Take a quick tour.')
  })
  const roundTourStepList = useMemo(() => fundingRoundSetupTourSteps(t), [t])
  const { invitation: roundTourInvitation } = useTour({
    id: FUNDING_ROUND_SETUP_TOUR_ID,
    steps: roundTourStepList,
    autoStart: true,
    autoStartDelay: 1200,
    enabled: spaceType === 'funding-round',
    inviteMessage: t('Setting up a funding round? Take a quick tour.')
  })
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugCustomized, setSlugCustomized] = useState(false)
  const [slugValid, setSlugValid] = useState(false)
  const [showSlugError, setShowSlugError] = useState(false)
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
  const [homeView, setHomeView] = useState('STREAM')
  const [showMenuEditor, setShowMenuEditor] = useState(false)
  const [openAdvanced, setOpenAdvanced] = useState(() => new Set())
  const [justRevealed, setJustRevealed] = useState(null)
  const [welcomeEnabled, setWelcomeEnabled] = useState(false)
  const [showWelcomePage, setShowWelcomePage] = useState(true)
  const welcomeEditorRef = useRef(null)
  const [access, setAccess] = useState('open')
  const [requiredRoles, setRequiredRoles] = useState([])
  const [roleSearchTerm, setRoleSearchTerm] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  // Funding Round settings (only used when creating a funding-round space)
  const [frSubmissionsOpenAt, setFrSubmissionsOpenAt] = useState(null)
  const [frSubmissionsCloseAt, setFrSubmissionsCloseAt] = useState(null)
  const [frVotingOpensAt, setFrVotingOpensAt] = useState(null)
  const [frVotingClosesAt, setFrVotingClosesAt] = useState(null)
  const [frVotingMethod, setFrVotingMethod] = useState('token_allocation_constant')
  const [frTotalTokens, setFrTotalTokens] = useState(100)
  const [frTokenType, setFrTokenType] = useState('Votes')
  const [frAllowSelfVoting, setFrAllowSelfVoting] = useState(false)
  const [frAllowLateJoiners, setFrAllowLateJoiners] = useState(false)
  const [frHideFinalResults, setFrHideFinalResults] = useState(false)
  const [frSubmissionDescriptor, setFrSubmissionDescriptor] = useState('Submission')
  const [frSubmissionDescriptorPlural, setFrSubmissionDescriptorPlural] = useState('Submissions')
  const [frSubmitterRoles, setFrSubmitterRoles] = useState([])
  const [frVoterRoles, setFrVoterRoles] = useState([])
  const frCriteriaEditorRef = useRef(null)

  // Track settings (only used when creating a track space)
  const [actionDescriptor, setActionDescriptor] = useState('Action')
  const [actionDescriptorPlural, setActionDescriptorPlural] = useState('Actions')
  const [completionRole, setCompletionRole] = useState(null)
  const completionMessageEditorRef = useRef(null)

  /** Switches space type and resets post types / included views / icon to that type's defaults. */
  const handleSpaceTypeChange = useCallback((value) => {
    setSpaceType(value)
    const defaults = defaultsForSpaceType(value)
    setPostTypes(defaults.postTypes)
    setRemovedStandardTypes(new Set())
    setPresetStandardViews(defaults.standardViewTypes)
    setManualViews([])
    setIcon(defaults.icon)
    setHomeView('STREAM')
    // Tracks and funding rounds ship a welcome page — turn the setting on so new
    // members land there, and open the Welcome panel so the toggle is visible.
    const welcomeByDefault = value === 'track' || value === 'funding-round'
    setWelcomeEnabled(welcomeByDefault)
    setShowWelcomePage(true)
    setOpenAdvanced(prev => {
      const next = new Set(prev)
      if (welcomeByDefault) next.add('welcome')
      else next.delete('welcome')
      return next
    })
  }, [])

  const roles = useMemo(
    () => groupRolesForPicker(group?.groupRoles?.items),
    [group?.groupRoles?.items]
  )

  const accessOptions = useMemo(
    () => accessOptionsForGroup(group),
    [group]
  )

  const accessSelectOptions = useMemo(
    () => accessOptions.map(option => ({
      value: option.value,
      icon: option.icon,
      title: option.labelKey,
      description: option.descKey,
      disabled: option.disabled,
      disabledTooltip: option.disabledTooltipKey
    })),
    [accessOptions]
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

  const standardViewTypes = useMemo(() => {
    const base = presetStandardViews
      ? presetStandardViews.filter(type => !removedStandardTypes.has(type))
      : customSpaceStandardViews(postTypes, removedStandardTypes)
    if (welcomeEnabled && !base.includes('welcome') && !removedStandardTypes.has('welcome')) {
      return [...base, 'welcome']
    }
    return base
  }, [presetStandardViews, postTypes, removedStandardTypes, welcomeEnabled])

  // Whatever sits at the top of the menu is the home — the backend takes the landing
  // route from the first seeded view. Keyed on the row rather than the array so a
  // re-ordered-but-identical list can't feed back into another render.
  const firstRow = orderedRows[0]
  const firstRowKey = firstRow?.key || null

  useEffect(() => {
    if (!firstRow || spaceType !== 'custom') return
    const match = firstRow.kind === 'standard' &&
      SPACE_HOME_VIEW_OPTIONS.find(option => option.viewType === firstRow.type)
    setHomeView(match ? match.value : CUSTOM_HOME_VIEW)
  }, [firstRowKey, spaceType])

  // Only set when the home is a view the segmented control doesn't already carry.
  const customHomeRow = homeView === CUSTOM_HOME_VIEW ? firstRow : null
  const homeViewType = SPACE_HOME_VIEW_OPTIONS.find(option => option.value === homeView)?.viewType

  const toggleAdvanced = useCallback((key) => {
    const isOpen = openAdvanced.has(key)
    if (isOpen && key === 'welcome') {
      // The editor unmounts with the panel — keep the drafted page in state.
      setWelcomeExtras(current => ({
        pageContent: welcomeEditorRef.current?.getHTML?.() ?? current?.pageContent ?? '',
        showWelcomePage
      }))
      setWelcomeEnabled(false)
      setRemovedStandardTypes(prev => new Set(prev).add('welcome'))
    }
    if (!isOpen) {
      setJustRevealed(key)
      if (key === 'welcome') {
        setWelcomeEnabled(true)
        setRemovedStandardTypes(prev => {
          if (!prev.has('welcome')) return prev
          const next = new Set(prev)
          next.delete('welcome')
          return next
        })
      }
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
  }, [openAdvanced, showWelcomePage])

  // Revealed editors append below the pills, often past the fold — bring the new one
  // into view so clicking a pill visibly does something.
  useEffect(() => {
    if (!justRevealed) return
    const element = document.querySelector(`[data-advanced-key="${justRevealed}"]`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    setJustRevealed(null)
  }, [justRevealed])

  /** Removes a standard view unless it is the current home (top) view. */
  const handleRemoveStandardView = useCallback((type) => {
    if (type === 'track-actions' || type === 'funding-round-submissions') return
    const homeRow = orderedRows[0]
    if (homeRow?.kind === 'standard' && homeRow.type === type) return
    setRemovedStandardTypes(prev => new Set(prev).add(type))
    if (type === 'welcome') {
      setWelcomeExtras(null)
      setWelcomeEnabled(false)
      setOpenAdvanced(prev => {
        const next = new Set(prev)
        next.delete('welcome')
        return next
      })
    }
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
      if (viewData.showWelcomePage !== undefined) setShowWelcomePage(viewData.showWelcomePage)
      setWelcomeEnabled(true)
      setJustRevealed('welcome')
      setOpenAdvanced(prev => {
        if (prev.has('welcome')) return prev
        return new Set(prev).add('welcome')
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

  const handleCreate = useCallback(async (status) => {
    if (!name.trim() || !group?.id) return
    if (!slugValid) {
      setShowSlugError(true)
      return
    }
    setIsCreating(true)
    try {
      const accessOption = accessOptions.find(option => option.value === access)
      const standardTypesInOrder = orderedRows.filter(row => row.kind === 'standard').map(row => row.type)
      const manualRowsInOrder = orderedRows.filter(row => row.kind === 'manual')
      // Custom spaces put the chosen home first; preset types already lead with theirs.
      const viewTypes = spaceType === 'custom'
        ? viewTypesForCreate(standardTypesInOrder, standardViewTypes, homeViewType)
        : (standardTypesInOrder.length > 0 ? standardTypesInOrder : standardViewTypes)

      // The welcome panel's editor wins while mounted; otherwise use the kept draft.
      const effectiveWelcome = welcomeEnabled
        ? {
            pageContent: welcomeEditorRef.current?.getHTML?.() ?? welcomeExtras?.pageContent ?? '',
            showWelcomePage
          }
        : null

      const result = await dispatch(createSpace({
        parentGroupId: group.id,
        name: name.trim(),
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
        requiredRoles: access === 'role' ? requiredRoles.map(role => role.id) : null,
        paywall: Boolean(accessOption.paywall),
        viewTypes,
        addToMenu: status === 'draft' ? false : addToMenu,
        status
      }))

      const newSpace = result?.payload?.data?.createSpace

      if (newSpace?.id && spaceType === 'track') {
        await dispatch(createTrack({
          groupId: newSpace.id,
          actionDescriptor,
          actionDescriptorPlural,
          completionMessage: completionMessageEditorRef.current?.getHTML?.() || null,
          completionRole
        }))
      } else if (newSpace?.id && spaceType === 'funding-round') {
        await dispatch(createFundingRound({
          groupId: newSpace.id,
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

      if (newSpace?.id && effectiveWelcome) {
        const viewsResult = await dispatch(fetchGroupViews(newSpace.id))
        const createdViews = viewsResult?.payload?.data?.group?.groupViews?.items || []
        const welcomeView = createdViews.find(view => view.type === 'welcome')
        if (welcomeView?.id && effectiveWelcome.pageContent) {
          await dispatch(updateGroupView({
            id: welcomeView.id,
            groupId: newSpace.id,
            pageContent: effectiveWelcome.pageContent
          }))
        }
        if (effectiveWelcome.showWelcomePage !== undefined) {
          await dispatch(updateGroupSettings(newSpace.id, {
            settings: { showWelcomePage: effectiveWelcome.showWelcomePage }
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
        (addToMenu === false || status === 'draft') && group?.slug ? dispatch(fetchForGroup(group.slug)) : Promise.resolve()
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
  }, [dispatch, group?.id, name, slug, slugValid, description, icon, bannerUrl, purpose, locationObject, postTypes, access, accessOptions, requiredRoles, spaceType, orderedRows, standardViewTypes, homeViewType, welcomeEnabled, welcomeExtras, showWelcomePage, onClose, onCreated, navigate, routerLocation.pathname, addToMenu, isOneColumn, actionDescriptor, actionDescriptorPlural, completionRole, frSubmissionsOpenAt, frSubmissionsCloseAt, frVotingOpensAt, frVotingClosesAt, frVotingMethod, frTotalTokens, frTokenType, frAllowSelfVoting, frAllowLateJoiners, frHideFinalResults, frSubmissionDescriptor, frSubmissionDescriptorPlural, frSubmitterRoles, frVoterRoles])

  const advancedSettings = useMemo(() => [
    {
      key: 'location',
      icon: MapPin,
      label: 'Location',
      defaultSummary: t('No location'),
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
      defaultSummary: defaultsForSpaceType(spaceType).postTypes.length > 0
        ? t('Discussions, events, requests, offers')
        : t('None'),
      render: () => (
        <PostTypePills postTypes={postTypes} onPostTypesChange={setPostTypes} label={t('Accepted post types')} />
      )
    },
    {
      key: 'welcome',
      icon: Hand,
      label: 'Welcome',
      defaultSummary: welcomeEnabled ? null : t('No welcome page'),
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
            contentHTML={welcomeExtras?.pageContent || ''}
            className='min-h-[120px] p-2'
            containerClassName='hyloEditor flex flex-col border border-foreground/20 rounded-lg bg-input'
            extendedMenu
            groupIds={group?.id ? [group.id] : []}
            ref={welcomeEditorRef}
            showMenu
            type='welcomePage'
          />
        </div>
      )
    }
  ], [t, locationObject, postTypes, spaceType, showWelcomePage, welcomeEnabled, welcomeExtras?.pageContent, group?.id])

  const revealedSettings = advancedSettings.filter(setting => openAdvanced.has(setting.key))
  const hideHomePickerCopy = spaceType === 'chat' || spaceType === 'track' || spaceType === 'funding-round'

  /** Closes the dialog when the dimmed overlay (not the panel) is clicked. */
  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose()
  }

  // Portal above AuthLayout nav stacking so access radios / FR checkboxes remain clickable.
  return createPortal(
    <div
      className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 pointer-events-auto'
      onClick={handleBackdropClick}
    >
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-[40rem] max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>
          {addToMenu ? t('Create a new space in the main menu') : t('Create a new space in More Spaces')}
        </h2>

        {spaceTourInvitation}
        {trackTourInvitation}
        {roundTourInvitation}
        <div className='flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 p-1 -m-1'>
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2' data-tour='space-type'>
            {SPACE_TYPE_OPTIONS.map(option => {
              const OptionIcon = option.icon
              const isSelected = spaceType === option.value
              return (
                <button
                  key={option.value}
                  type='button'
                  data-tour={'space-type-' + option.value}
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
                onChange={e => {
                  const newName = e.target.value
                  setName(newName)
                  if (!slugCustomized) setSlug(nameToSlug(newName))
                }}
                placeholder={t('Space name')}
              />
            </div>

            <SpaceSlugField
              parentSlug={group?.slug}
              value={slug}
              onChange={(next) => {
                setSlug(next)
                setSlugCustomized(true)
              }}
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

          <div className='flex flex-col gap-2' data-tour='space-access'>
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

          <div className='mt-2' data-tour='space-home'>
            {(!hideHomePickerCopy || !showMenuEditor) && (
              <div className={cn('flex items-end gap-2 mb-2', hideHomePickerCopy ? '' : 'justify-between')}>
                {!hideHomePickerCopy && (
                  <div className='min-w-0'>
                    <span className={FIELD_LABEL_CLASS}>{t("Choose your space's home")}</span>
                    <p className='text-xs text-foreground/60 mt-0.5 mb-0'>{t('Set the default view members see when they enter your space.')}</p>
                  </div>
                )}
                {!showMenuEditor && (
                  <button
                    type='button'
                    onClick={() => setShowMenuEditor(true)}
                    className='shrink-0 flex items-center gap-1.5 text-xs font-semibold text-foreground/70 hover:text-foreground border border-foreground/20 hover:border-foreground/40 rounded-md px-2 py-1 transition-colors'
                  >
                    <Settings className='w-3.5 h-3.5' />
                    {t('Edit Menu')}
                  </button>
                )}
              </div>
            )}
            {showMenuEditor
              ? (
                <AdvancedSection
                  settingKey='views'
                  icon={Settings}
                  label='Menu Items'
                  onHide={() => setShowMenuEditor(false)}
                >
                  <IncludedViewsEditor
                    key={spaceType}
                    standardViewTypes={standardViewTypes}
                    onRemoveStandardType={handleRemoveStandardView}
                    manualViews={manualViews}
                    onAddView={handleAddView}
                    onRemoveManualView={handleRemoveManualView}
                    acceptedPostTypes={postTypes}
                    onOrderedRowsChange={setOrderedRows}
                    label={t("These are the menu your members use. The one at the top is your space's home.")}
                    labelClassName='text-xs text-foreground/60'
                  />
                </AdvancedSection>
                )
              : spaceType === 'custom' && (
                <HomeViewPicker
                  value={homeView}
                  onChange={setHomeView}
                  customHomeRow={customHomeRow}
                  options={SPACE_HOME_VIEW_OPTIONS}
                />
              )}
          </div>

          {spaceType === 'track' && (
            <TrackSettingsFields
              actionDescriptor={actionDescriptor}
              setActionDescriptor={setActionDescriptor}
              actionDescriptorPlural={actionDescriptorPlural}
              setActionDescriptorPlural={setActionDescriptorPlural}
              completionRole={completionRole}
              setCompletionRole={setCompletionRole}
              roles={roles}
              completionMessageEditorRef={completionMessageEditorRef}
              groupIds={group?.id ? [group.id] : []}
              editorKey='create'
            />
          )}

          {spaceType === 'funding-round' && (
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
              groupIds={group?.id ? [group.id] : []}
              editorKey='create'
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

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10' data-tour='space-publish'>
          <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
          <Button variant='primary' disabled={!name.trim() || isCreating} onClick={() => handleCreate('draft')}>
            {isCreating ? t('Creating...') : t('Save as Draft')}
          </Button>
          <Button variant='secondary' disabled={!name.trim() || isCreating} onClick={() => handleCreate('published')}>
            {isCreating ? t('Creating...') : t('Create and Publish')}
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
