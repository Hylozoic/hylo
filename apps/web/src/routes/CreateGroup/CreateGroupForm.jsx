import { trim } from 'lodash/fp'
import {
  Activity, ArrowRight, DoorOpen, EyeOff, Globe, Hand, HelpCircle, ImagePlus,
  LayoutGrid, Lock, Map, MapPin, MessageCircleMore, Network, Plus, ScrollText, Settings, Shield, Users, X
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useParams } from 'react-router-dom'
import { push } from 'redux-first-history'
import { AdvancedPill, AdvancedSection } from 'components/AdvancedSettings/AdvancedSettings'
import GroupsSelector from 'components/GroupsSelector'
import HomeViewPicker from 'components/HomeViewPicker/HomeViewPicker'
import HyloEditor from 'components/HyloEditor'
import IncludedViewsEditor from 'components/IncludedViewsEditor/IncludedViewsEditor'
import LocationInput from 'components/LocationInput/LocationInput'
import PostTypePills from 'components/PostTypePills/PostTypePills'
import SettingSelectRow from 'components/SettingSelectRow/SettingSelectRow'
import SwitchStyled from 'components/SwitchStyled'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import Button from 'components/ui/button'
import { INPUT_CLASS } from 'components/ui/form-field'
import InfoButton from 'components/ui/info'
import { CUSTOM_VIEW_DEFAULT_POST_TYPES, CUSTOM_VIEW_POST_TYPE_OPTIONS } from 'components/CustomViewForm/customViewFormConstants'
import { createGroupView, updateGroupView } from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { RESP_ADMINISTRATION } from 'store/constants'
import { DEFAULT_AVATAR, GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
import { CUSTOM_HOME_VIEW, POST_TYPE_TO_VIEW_TYPE, viewTypesForCreate } from 'store/models/GroupView'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { updateGroupSettings } from 'routes/GroupSettings/GroupSettings.store'
import { bgImageStyle, cn } from 'util/index'
import { groupUrl } from '@hylo/navigation'
import { createGroup, fetchGroupExists } from './CreateGroup.store'
import { nameToSlug, SLUG_MAX_LENGTH, slugValidatorRegex } from './slug'

const STANDARD_VIEW_TYPES = new Set(['all', 'chat', 'map', 'members', 'welcome', ...Object.values(POST_TYPE_TO_VIEW_TYPE)])

const SLUG_CHECK_DEBOUNCE = 300

const NAME_MAX_LENGTH = 60
const PURPOSE_MAX_LENGTH = 500

// The chosen groups are rendered here as pills instead, so TagInput's own tags are
// hidden and only its field is used. `relative` on that field's row keeps the
// suggestion list attached to the field.
const GROUPS_SELECTOR_CLASS = cn(
  'w-full [&>ul]:flex [&>ul]:m-0 [&>ul]:p-0 [&>ul]:list-none',
  '[&>ul>li:not(:last-child)]:hidden',
  '[&>ul>li:last-child]:relative [&>ul>li:last-child]:w-full [&>ul>li:last-child]:m-0 [&>ul>li:last-child]:p-0',
  '[&>ul>li:last-child>div]:w-full',
  '[&_input]:!w-full [&_input]:!rounded-lg [&_input]:!border-2 [&_input]:!border-foreground/20',
  '[&_input]:!bg-input [&_input]:!px-3 [&_input]:!py-2.5 [&_input]:!text-sm'
)

const ADD_ROW_CLASS = 'flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-foreground/20 py-2 text-xs font-semibold text-foreground/60 hover:border-foreground/40 hover:text-foreground transition-all'

// Parent groups read as a list of what's been added, with the search field appearing
// only once you ask for it — otherwise an empty field sits there implying work to do.
function ParentGroupsEditor ({ options, selected, onChange }) {
  const { t } = useTranslation()
  const [isAdding, setIsAdding] = useState(false)
  const fieldRef = useRef()

  useEffect(() => {
    if (isAdding) fieldRef.current?.querySelector('input')?.focus()
  }, [isAdding])

  const handleChange = useCallback(groups => {
    onChange(groups)
    setIsAdding(false)
  }, [onChange])

  // A suggestion click blurs the field before it registers, so give it a beat.
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (!fieldRef.current?.contains(document.activeElement)) setIsAdding(false)
    }, 200)
  }, [])

  return (
    <div className='flex flex-col gap-2'>
      <p className='text-xs text-foreground/60 mb-0'>{t('groupParentGroupHelpText')}</p>

      <div className='flex flex-wrap items-center gap-2'>
        {selected.map(group => (
          <span key={group.id} className='inline-flex items-center gap-2 rounded-full bg-selected/20 py-1 pl-1 pr-2.5'>
            <div style={bgImageStyle(group.avatarUrl)} className='w-5 h-5 rounded-full bg-cover bg-center shrink-0' />
            <span className='text-sm text-foreground'>{group.name}</span>
            <button
              type='button'
              onClick={() => onChange(selected.filter(g => g.id !== group.id))}
              aria-label={t('Remove {{name}}', { name: group.name })}
              className='text-foreground/50 hover:text-foreground transition-colors'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          </span>
        ))}

        {isAdding
          ? (
            <div ref={fieldRef} onBlur={handleBlur} className='flex-1 basis-48 min-w-0'>
              <GroupsSelector
                options={options}
                selected={selected}
                onChange={handleChange}
                readOnly={false}
                placeholder={t('Search groups to add')}
                className={GROUPS_SELECTOR_CLASS}
              />
            </div>
            )
          : (
            <button type='button' onClick={() => setIsAdding(true)} className={cn(ADD_ROW_CLASS, 'px-3 py-1.5 rounded-full')}>
              <Plus className='w-3 h-3' />{t('Add a parent group')}
            </button>
            )}
      </div>
    </div>
  )
}

const VISIBILITY_OPTIONS = [
  {
    value: GROUP_VISIBILITY.Public,
    icon: Globe,
    title: 'Anyone can find and see',
    description: 'This group will be exposed to search engines.'
  },
  {
    value: GROUP_VISIBILITY.Protected,
    icon: Shield,
    title: 'Visible to related groups',
    description: "Members of this group's parent, child, and related groups can find it and see its join page. Everyone else can't see that it exists. New members will need an invite link to see the group."
  },
  {
    value: GROUP_VISIBILITY.Hidden,
    icon: EyeOff,
    title: 'Members only',
    description: 'Invisible to everyone except its own members and admins of related groups — the only way in is an invitation.'
  }
]

// Home view decides the group's landing route. Each value maps to the view type that
// has to be seeded for that route to resolve.
// Icons match what each view carries in the group menu (VIEW_TYPE_TO_LUCIDE_ICON).
const HOME_VIEW_OPTIONS = [
  {
    value: 'STREAM',
    viewType: 'all',
    icon: Activity,
    title: 'Activity Stream',
    description: "A sorted feed of all your group's posts"
  },
  {
    value: 'CHAT',
    viewType: 'chat',
    icon: MessageCircleMore,
    title: 'Chat',
    description: 'A real-time chat room for quick conversations, coordination and casual interactions.'
  },
  {
    value: 'MAP',
    viewType: 'map',
    icon: Map,
    title: 'Map',
    description: 'See where your people, projects, events and more are located'
  }
]

const ACCESSIBILITY_OPTIONS = [
  {
    value: GROUP_ACCESSIBILITY.Open,
    icon: DoorOpen,
    title: 'Anyone can join instantly',
    description: 'Anybody who can see the group becomes a member the moment they ask — no review, no waiting.'
  },
  {
    value: GROUP_ACCESSIBILITY.Restricted,
    icon: Lock,
    title: 'By request, with approval',
    description: 'People must request to join your group, and be approved by stewards. You can ask applicants questions before they join.'
  },
  {
    value: GROUP_ACCESSIBILITY.Closed,
    icon: Users,
    title: 'By invitation only',
    description: 'Nobody can request to join. Members arrive only when a steward invites them directly or shares an invite link.'
  }
]

function AgreementsEditor ({ agreements, onChange }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-2'>
      {agreements.map((agreement, index) => (
        <div key={index} className='flex items-start gap-2'>
          <div className='flex-1 min-w-0 flex flex-col'>
            <input
              type='text'
              value={agreement.title}
              onChange={e => onChange(agreements.map((a, i) => i === index ? { ...a, title: e.target.value } : a))}
              placeholder={t('Agreement title')}
              className={cn(INPUT_CLASS, 'rounded-b-none border-b-input font-semibold')}
            />
            <textarea
              rows={2}
              value={agreement.description}
              onChange={e => onChange(agreements.map((a, i) => i === index ? { ...a, description: e.target.value } : a))}
              placeholder={t('Describe what members are agreeing to')}
              className={cn(INPUT_CLASS, 'resize-none rounded-t-none [border-top-style:dashed]')}
            />
          </div>
          <button
            type='button'
            onClick={() => onChange(agreements.filter((a, i) => i !== index))}
            aria-label={t('Remove agreement')}
            className='text-foreground/50 hover:text-foreground transition-colors mt-3'
          >
            <X className='w-3.5 h-3.5' />
          </button>
        </div>
      ))}
      <button
        type='button'
        onClick={() => onChange([...agreements, { title: '', description: '', order: agreements.length }])}
        className={ADD_ROW_CLASS}
      >
        <Plus className='w-3 h-3' />{t('Add an agreement')}
      </button>
    </div>
  )
}

function JoinQuestionsEditor ({ questions, onChange }) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-2'>
      <p className='text-xs text-foreground/60 mb-0'>{t('People requesting to join your group must answer these questions. You and other stewards will be able to see their answers before approving.')}</p>
      {questions.map((question, index) => (
        <div key={index} className='flex items-center gap-2'>
          <input
            type='text'
            value={question.text}
            onChange={e => onChange(questions.map((q, i) => i === index ? { ...q, text: e.target.value } : q))}
            placeholder={t('What would you like to ask people who want to join?')}
            className={INPUT_CLASS}
          />
          <button
            type='button'
            onClick={() => onChange(questions.filter((q, i) => i !== index))}
            aria-label={t('Remove question')}
            className='text-foreground/50 hover:text-foreground transition-colors'
          >
            <X className='w-3.5 h-3.5' />
          </button>
        </div>
      ))}
      <button
        type='button'
        onClick={() => onChange([...questions, { text: '' }])}
        className={ADD_ROW_CLASS}
      >
        <Plus className='w-3 h-3' />{t('Add a question')}
      </button>
    </div>
  )
}

// The create-group form itself. Rendered identically by the /create-group page and
// by CreateGroupModal — only the surrounding chrome and the scroll container differ.
export default function CreateGroupForm ({ onClose, bodyClassName, footerClassName }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useParams()

  const currentUser = useSelector(getMe)
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const slugExists = useSelector(state => state.CreateGroup?.slugExists)
  const slugChecked = useSelector(state => state.CreateGroup?.slugChecked)
  const initialGroupName = useSelector(state => getQuerystringParam('name', location))
  const initialGroupSlug = useSelector(state => getQuerystringParam('slug', location))

  const parentGroupOptions = useSelector(state => {
    return currentUser?.memberships.toModelArray()
      // Spaces are containers inside a group — never candidates to parent a new group
      .filter(m => m.group.type !== 'space')
      .filter(m => m.group.accessibility === GROUP_ACCESSIBILITY.Open ||
        hasResponsibilityForGroup(state, { groupId: m.group.id, responsibility: RESP_ADMINISTRATION }))
      .map(m => m.group)
      .sort((a, b) => a.name.localeCompare(b.name)) || []
  }, (prevGroups, nextGroups) => {
    if (prevGroups.length !== nextGroups.length) return false
    return prevGroups.every((item, index) => item.id === nextGroups[index].id)
  })

  const [name, setName] = useState(initialGroupName || '')
  const [slug, setSlug] = useState(initialGroupSlug || '')
  const [slugCustomized, setSlugCustomized] = useState(!!initialGroupSlug)
  const [purpose, setPurpose] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [homeView, setHomeView] = useState('STREAM')
  const [visibility, setVisibility] = useState(GROUP_VISIBILITY.Protected)
  const [accessibility, setAccessibility] = useState(GROUP_ACCESSIBILITY.Restricted)
  const [isNameFocused, setIsNameFocused] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const [locationObject, setLocationObject] = useState(null)
  const [parentGroups, setParentGroups] = useState(
    currentGroup && parentGroupOptions.find(p => p.id === currentGroup.id) ? [currentGroup] : []
  )
  const [agreements, setAgreements] = useState([])
  const [joinQuestions, setJoinQuestions] = useState([])
  const [postTypes, setPostTypes] = useState([...CUSTOM_VIEW_DEFAULT_POST_TYPES])
  const [removedStandardTypes, setRemovedStandardTypes] = useState(new Set())
  const [manualViews, setManualViews] = useState([])
  const [welcomeExtras, setWelcomeExtras] = useState(null)
  const [welcomeEnabled, setWelcomeEnabled] = useState(false)
  const [showWelcomePage, setShowWelcomePage] = useState(true)
  const welcomeEditorRef = useRef(null)
  const [orderedRows, setOrderedRows] = useState([])
  // Opening create-group from inside a group pre-fills that group as a parent, which
  // isn't a default anyone chose — so show the setting rather than hiding the choice.
  const [openAdvanced, setOpenAdvanced] = useState(
    () => new Set(currentGroup && parentGroupOptions.find(p => p.id === currentGroup.id) ? ['parentGroups'] : [])
  )
  const [justRevealed, setJustRevealed] = useState(null)
  // Edit menu swaps the home-view picker for the menu-items editor in place
  const [showMenuEditor, setShowMenuEditor] = useState(false)

  const slugRef = useRef()

  const slugFormatError = useMemo(() => {
    if (!slug) return name ? t('Please enter a URL slug') : false
    if (!slugValidatorRegex.test(slug)) {
      return t('URLs must have between 2 and 40 characters, and can only have lower case letters, numbers, and dashes.')
    }
    return false
  }, [slug, name, t])

  // Only trust the availability answer that came back for the handle currently in the field.
  const slugTaken = !slugFormatError && slugExists && slugChecked === slug
  const slugError = slugFormatError || (slugTaken ? t('This URL already exists. Try another.') : false)
  const nameError = nameTouched && !name.trim() ? t('Please enter a group name') : false
  const isValid = !!name.trim() && !!slug && !slugFormatError && !slugTaken

  useEffect(() => {
    if (!slug || !slugValidatorRegex.test(slug)) return
    const timeout = setTimeout(() => dispatch(fetchGroupExists(slug)), SLUG_CHECK_DEBOUNCE)
    return () => clearTimeout(timeout)
  }, [slug, dispatch])

  const handleNameChange = useCallback(event => {
    const newName = event.target.value
    setName(newName)
    if (!slugCustomized) setSlug(nameToSlug(newName))
  }, [slugCustomized])

  const handleSlugChange = useCallback(event => {
    setSlug(event.target.value)
    setSlugCustomized(true)
  }, [])

  const focusSlug = useCallback(() => {
    slugRef.current?.focus()
    slugRef.current?.select()
  }, [])

  const homeViewType = HOME_VIEW_OPTIONS.find(option => option.value === homeView)?.viewType

  const standardViewTypes = useMemo(() => {
    const postTypeViews = CUSTOM_VIEW_POST_TYPE_OPTIONS
      .filter(option => option.postTypes.every(type => postTypes.includes(type)))
      .map(option => POST_TYPE_TO_VIEW_TYPE[option.postTypes[0]])
    const base = ['all', 'chat', ...postTypeViews, 'map', 'members'].filter(type => !removedStandardTypes.has(type))
    if (welcomeEnabled && !base.includes('welcome') && !removedStandardTypes.has('welcome')) {
      return [...base, 'welcome']
    }
    return base
  }, [postTypes, removedStandardTypes, welcomeEnabled])

  // Whatever sits at the top of the menu is the home — the backend takes the landing
  // route from the first seeded view. Keyed on the row rather than the array so a
  // re-ordered-but-identical list can't feed back into another render.
  const firstRow = orderedRows[0]
  const firstRowKey = firstRow?.key || null

  useEffect(() => {
    if (!firstRow) return
    const match = firstRow.kind === 'standard' &&
      HOME_VIEW_OPTIONS.find(option => option.viewType === firstRow.type)
    setHomeView(match ? match.value : CUSTOM_HOME_VIEW)
  }, [firstRowKey])

  // Only set when the home is a view the segmented control doesn't already carry.
  const customHomeRow = homeView === CUSTOM_HOME_VIEW ? firstRow : null

  const handleRemoveStandardView = useCallback((type) => {
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
  }, [])

  const handleRemoveManualView = useCallback((key) => {
    setManualViews(prev => prev.filter(view => view.key !== key))
  }, [])

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
      return
    }
    setManualViews(prev => [...prev, { ...viewData, key: `manual-${prev.length}-${Date.now()}` }])
  }, [])

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

  const onSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    const manualRowsInOrder = orderedRows.filter(row => row.kind === 'manual')
    const standardTypesInOrder = orderedRows.filter(row => row.kind === 'standard').map(row => row.type)

    // Menu Items only reports `orderedRows` once opened. Until then (and when Post Types
    // change the derived list), seed All Activity, Chat, type views, Map, and Members.
    const viewTypes = viewTypesForCreate(standardTypesInOrder, standardViewTypes, homeViewType)

    const { error, payload } = await dispatch(createGroup({
      accessibility,
      avatarUrl: avatarUrl || DEFAULT_AVATAR,
      bannerUrl,
      // homeView only names the three built-ins; the landing route itself comes from
      // the first seeded view, which is what makes any other menu item work as home.
      homeView: homeView === CUSTOM_HOME_VIEW ? 'STREAM' : homeView,
      name: trim(name),
      slug,
      location: locationObject?.fullText || null,
      locationId: locationObject?.id || null,
      parentIds: parentGroups.map(g => g.id),
      purpose: trim(purpose),
      acceptedPostTypes: postTypes,
      viewTypes,
      visibility
    }))

    if (error) {
      setSubmitError(t('There was an error, please try again.'))
      setSubmitting(false)
      return
    }

    const newGroup = payload?.data?.createGroup

    const effectiveWelcome = welcomeEnabled
      ? {
          pageContent: welcomeEditorRef.current?.getHTML?.() ?? welcomeExtras?.pageContent ?? '',
          showWelcomePage
        }
      : null

    if (newGroup?.id && manualRowsInOrder.length > 0) {
      // Fetch the standard views the backend just seeded so manual (custom/link/text) views
      // can be inserted at their correct position rather than always appended at the end.
      const viewsResult = await dispatch(fetchGroupViews(newGroup.id))
      const createdViews = viewsResult?.payload?.data?.group?.groupViews?.items || []
      const idByType = createdViews.reduce((acc, view) => { acc[view.type] = view.id; return acc }, {})

      let nextId = null
      for (let i = orderedRows.length - 1; i >= 0; i--) {
        const row = orderedRows[i]
        if (row.kind === 'standard') {
          nextId = idByType[row.type] || null
          continue
        }
        const createResult = await dispatch(createGroupView({
          groupId: newGroup.id,
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

    // createGroup ignores agreements and join questions, so they go through
    // updateGroupSettings once the group exists. Welcome page content lives on
    // the seeded welcome view; show-to-new-members is a group setting.
    const namedAgreements = agreements.filter(a => trim(a.title))
    const askedQuestions = joinQuestions.filter(q => trim(q.text))
    const settingsChanges = {}
    if (namedAgreements.length > 0) {
      settingsChanges.agreements = namedAgreements.map((a, order) => ({ ...a, order }))
    }
    if (askedQuestions.length > 0) settingsChanges.joinQuestions = askedQuestions
    if (effectiveWelcome?.showWelcomePage !== undefined) {
      settingsChanges.settings = { showWelcomePage: effectiveWelcome.showWelcomePage }
    }
    if (newGroup?.id && Object.keys(settingsChanges).length > 0) {
      await dispatch(updateGroupSettings(newGroup.id, settingsChanges))
    }

    if (newGroup?.id && effectiveWelcome) {
      const viewsResult = await dispatch(fetchGroupViews(newGroup.id))
      const createdViews = viewsResult?.payload?.data?.group?.groupViews?.items || []
      const welcomeView = createdViews.find(view => view.type === 'welcome')
      if (welcomeView?.id && effectiveWelcome.pageContent) {
        await dispatch(updateGroupView({
          id: welcomeView.id,
          groupId: newGroup.id,
          pageContent: effectiveWelcome.pageContent
        }))
      }
    }

    if (onClose) onClose()
    dispatch(push(groupUrl(slug)))
  }

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
          saveLocationToDB
          placeholder={t('Where is this group based?')}
          className={INPUT_CLASS}
        />
      )
    },
    {
      key: 'postTypes',
      icon: LayoutGrid,
      label: 'Post types',
      defaultSummary: t('Discussions, events, requests, offers'),
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
              {t('Show this welcome page to new members when they first land in the group.')}
            </span>
          </div>
          <HyloEditor
            contentHTML={welcomeExtras?.pageContent || ''}
            className='min-h-[120px] p-2'
            containerClassName='hyloEditor flex flex-col border border-foreground/20 rounded-lg bg-input'
            extendedMenu
            groupIds={[]}
            ref={welcomeEditorRef}
            showMenu
            type='welcomePage'
          />
        </div>
      )
    },
    {
      key: 'parentGroups',
      icon: Network,
      label: 'Parent groups',
      defaultSummary: t('No parent groups'),
      hidden: parentGroupOptions.length === 0,
      render: () => (
        <ParentGroupsEditor
          options={parentGroupOptions}
          selected={parentGroups}
          onChange={setParentGroups}
        />
      )
    },
    {
      key: 'agreements',
      icon: ScrollText,
      label: 'Agreements',
      defaultSummary: t('No agreements'),
      render: () => <AgreementsEditor agreements={agreements} onChange={setAgreements} />
    },
    {
      key: 'joinQuestions',
      icon: HelpCircle,
      label: 'Join questions',
      defaultSummary: t('No questions'),
      render: () => <JoinQuestionsEditor questions={joinQuestions} onChange={setJoinQuestions} />
    }
  ].filter(setting => !setting.hidden), [
    t, locationObject, postTypes, parentGroupOptions, parentGroups,
    agreements, joinQuestions, welcomeEnabled, showWelcomePage, welcomeExtras?.pageContent
  ])

  const revealedSettings = advancedSettings.filter(setting => openAdvanced.has(setting.key))

  return (
    <>
      <div className={cn('flex flex-col', bodyClassName)}>
        <div className='relative mb-12'>
          <UploadAttachmentButton
            type='groupBanner'
            onInitialUpload={({ url }) => setBannerUrl(url)}
            className='w-full group'
          >
            <div
              className={cn('relative w-full h-[150px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-foreground/30 bg-cover bg-center bg-darkening/0 hover:bg-darkening/20 transition-all cursor-pointer', { 'border-none': !!bannerUrl })}
              style={{ backgroundImage: `url(${bannerUrl})` }}
            >
              <div className='flex flex-col items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity'>
                <ImagePlus className='w-5 h-5' />
                <span className='text-xs font-semibold'>{t('Add a banner')}</span>
              </div>
            </div>
          </UploadAttachmentButton>

          <UploadAttachmentButton
            type='groupAvatar'
            onInitialUpload={({ url }) => setAvatarUrl(url)}
            className='absolute left-4 -bottom-9 p-1 rounded-2xl bg-background group'
          >
            <div
              style={bgImageStyle(avatarUrl)}
              className={cn(
                'w-[72px] h-[72px] rounded-xl shadow-lg flex items-center justify-center bg-cover bg-center bg-midground hover:bg-darkening/20 transition-all cursor-pointer',
                avatarUrl ? 'border-4 border-background' : 'border-2 border-dashed border-foreground/30'
              )}
            >
              {!avatarUrl && (
                <div className='flex flex-col items-center justify-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity'>
                  <ImagePlus className='w-4 h-4' />
                  <span className='text-[10px] font-semibold'>{t('Avatar')}</span>
                </div>
              )}
            </div>
          </UploadAttachmentButton>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-[1.35fr_1fr] gap-3 items-start'>
          <div className='flex flex-col gap-1'>
            <div className='h-5 flex items-center'>
              <label htmlFor='groupName' className='text-xs font-bold text-foreground/80'>{t('Name')}</label>
            </div>
            <input
              autoFocus
              id='groupName'
              type='text'
              name='name'
              value={name}
              onChange={handleNameChange}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => { setIsNameFocused(false); setNameTouched(true) }}
              placeholder={t('Name your group')}
              maxLength={NAME_MAX_LENGTH}
              className={cn(INPUT_CLASS, isNameFocused && 'border-focus')}
            />
            {nameError && <span className='text-error text-xs'>{nameError}</span>}
          </div>

          <div className='flex flex-col gap-1'>
            <div className='h-5 flex items-center gap-1.5'>
              <label htmlFor='groupSlug' className='text-xs font-bold text-foreground/80'>{t('Handle')}</label>
              <InfoButton
                className='text-foreground/50'
                content={t("Your group's unique address on Hylo. It appears in your group URL and lets people mention the group in posts.")}
              />
            </div>
            <div className={cn(INPUT_CLASS, 'flex items-center', slugError && 'border-error')}>
              <span className='text-sm text-foreground/40 shrink-0'>@</span>
              <input
                id='groupSlug'
                type='text'
                name='slug'
                value={slug}
                onChange={handleSlugChange}
                onClick={focusSlug}
                ref={slugRef}
                placeholder={t('your-group-name')}
                maxLength={SLUG_MAX_LENGTH}
                className='flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder-foreground/40 focus:outline-none'
              />
            </div>
            {slugError
              ? <span className='text-error text-xs'>{slugError}</span>
              : <span className='text-xs text-foreground/50 truncate'>hylo.com/groups/{slug || '…'}</span>}
          </div>
        </div>

        <div className='flex flex-col gap-1 mt-2'>
          <div className='h-5 flex items-center justify-between'>
            <label htmlFor='groupPurpose' className='text-xs font-bold text-foreground/80'>{t('Purpose')}</label>
            <span className='text-xs text-foreground/50'>{purpose.length} / {PURPOSE_MAX_LENGTH}</span>
          </div>
          <textarea
            id='groupPurpose'
            rows={2}
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            maxLength={PURPOSE_MAX_LENGTH}
            placeholder={t('What is this group for?')}
            className={cn(INPUT_CLASS, 'resize-none')}
          />
        </div>

        <div className='flex flex-col gap-2 mt-5'>
          <span className='text-xs font-bold text-foreground/80'>{t('Who can see this group?')}</span>
          <SettingSelectRow
            label='Who can see this group?'
            value={visibility}
            onChange={setVisibility}
            options={VISIBILITY_OPTIONS}
          />
        </div>

        <div className='flex flex-col gap-2 mt-5'>
          <span className='text-xs font-bold text-foreground/80'>{t('Who can join this group?')}</span>
          <SettingSelectRow
            label='Who can join this group?'
            value={accessibility}
            onChange={setAccessibility}
            options={ACCESSIBILITY_OPTIONS}
          />
        </div>

        <div className='mt-5'>
          {/* items-end + shared mb: the button's bottom sits level with the subtitle,
              so both keep the same distance to the container below */}
          <div className='flex items-end justify-between gap-2 mb-2'>
            <div className='min-w-0'>
              <span className='text-xs font-bold text-foreground/80'>{t("Choose your group's home")}</span>
              <p className='text-xs text-foreground/60 mt-0.5 mb-0'>{t('Set the default view members see when they enter your group.')}</p>
            </div>
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
          {showMenuEditor
            ? (
              <AdvancedSection
                settingKey='views'
                icon={Settings}
                label='Menu Items'
                onHide={() => setShowMenuEditor(false)}
              >
                <IncludedViewsEditor
                  standardViewTypes={standardViewTypes}
                  onRemoveStandardType={handleRemoveStandardView}
                  manualViews={manualViews}
                  onAddView={handleAddView}
                  onRemoveManualView={handleRemoveManualView}
                  acceptedPostTypes={postTypes}
                  onOrderedRowsChange={setOrderedRows}
                  homeViewType={homeViewType}
                  label={t("These are the menu your members use. The one at the top is your group's home.")}
                  labelClassName='text-xs text-foreground/60'
                />
              </AdvancedSection>
              )
            : <HomeViewPicker value={homeView} onChange={setHomeView} customHomeRow={customHomeRow} options={HOME_VIEW_OPTIONS} />}
        </div>

        {visibility === GROUP_VISIBILITY.Public && (
          <div className='rounded-xl bg-foreground/5 p-4 mt-5'>
            <h3 className='font-semibold mb-2 text-sm'>{t('Optional') + ': ' + t('Add my group into the commons')}</h3>
            <p className='text-xs opacity-70 mb-2'>{t('commonsExplainerText1')}</p>
            <p className='text-xs opacity-70 mb-3'>{t('commonsExplainerText2')}</p>
            <p className='text-xs mb-0'>
              {t('Apply here') + ': '}
              <a
                href='https://docs.google.com/forms/d/e/1FAIpQLScuxRGl65OMCVkjjsFllWwK4TQjddkufMu9rukIocgmhyHL7w/viewform'
                target='_blank'
                rel='noopener noreferrer'
                className='text-focus hover:underline'
              >
                {t('Allow-in-Commons form')}
              </a>
            </p>
          </div>
        )}

        <div className='mt-6 pt-5 border-t border-foreground/10'>
          <h2 className='text-xs font-bold text-foreground/80 m-0 mb-2'>{t('Additional settings')}</h2>

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

      <div className={cn('flex items-center justify-end gap-3', footerClassName)}>
        {submitError && <span className='text-error text-sm flex-1'>{submitError}</span>}
        {onClose && (
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            {t('Cancel')}
          </Button>
        )}
        <Button
          onClick={onSubmit}
          disabled={!isValid || submitting}
          variant='highVisibility'
        >
          {t('Create Group')}
          <ArrowRight className='w-4 h-4 ml-2' />
        </Button>
      </div>
    </>
  )
}
