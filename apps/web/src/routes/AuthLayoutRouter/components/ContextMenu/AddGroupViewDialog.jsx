import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'

import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import { Input } from 'components/ui/input'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import GroupsSelector from 'components/GroupsSelector'
import PostSelector from 'components/PostSelector'
import PeopleSelector from 'routes/Messages/PeopleSelector'
import GroupViewIcon from './GroupViewIcon'
import AddCollectionDialog from './AddCollectionDialog'
import AddSpaceCollectionDialog from './AddSpaceCollectionDialog'
import AddCustomViewDialog from './AddCustomViewDialog'
import AddWelcomeViewDialog from './AddWelcomeViewDialog'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { createGroupView } from 'store/actions/groupViews'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import fetchPeople from 'store/actions/fetchPeople'
import {
  getChildGroups,
  getParentGroups,
  getPeerGroups
} from 'store/selectors/getGroupRelationships'
import { cn } from 'util/index'
import { sanitizeURL } from 'util/url'

/** Common views that can only appear once. Hidden from Add View when already in the menu. */
const COMMON_VIEW_TYPES = [
  'all',
  'chat',
  'members',
  'map',
  'welcome',
  'discussions',
  'events',
  'requests-and-offers',
  'resources',
  'proposals',
  'projects'
]

/** User-created view types. Always offered; can add more than one of each. */
const CUSTOM_VIEW_TYPES = [
  'custom',
  'collection',
  'space-collection',
  'link',
  'post',
  'member',
  'group',
  'text',
  'separator'
]

const SINGLETON_VIEW_TYPES = new Set(COMMON_VIEW_TYPES)

/** View types that require picking a specific entity before creating. */
const ENTITY_VIEW_TYPES = new Set(['post', 'member', 'group'])

/** Short description shown on the right side of each add-view row. */
function descriptionForViewType (type, t) {
  return t(`addViewDesc-${type}`, { defaultValue: '' })
}

/** Modal for picking and creating a new group view.
 * Pass `onAdd` to stage the view locally instead of dispatching a mutation — used when
 * building up a not-yet-created group/space (e.g. AddSpaceDialog's Included Views editor). */
export default function AddGroupViewDialog ({ group, groupViews, onClose, onAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [selectedType, setSelectedType] = useState(null)
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkIcon, setLinkIcon] = useState('Globe')
  const [textContent, setTextContent] = useState('')
  const [showCustomViewDialog, setShowCustomViewDialog] = useState(false)
  const [showCollectionDialog, setShowCollectionDialog] = useState(false)
  const [showSpaceCollectionDialog, setShowSpaceCollectionDialog] = useState(false)
  const [showWelcomeViewDialog, setShowWelcomeViewDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [people, setPeople] = useState([])
  const [peopleSelectorOpen, setPeopleSelectorOpen] = useState(false)
  const [peopleSearch, setPeopleSearch] = useState(null)

  const parentGroups = useSelector(state => getParentGroups(state, group))
  const childGroups = useSelector(state => getChildGroups(state, group))
  const peerGroups = useSelector(state => getPeerGroups(state, group))

  // Related groups are not loaded with the main group payload — fetch them when
  // the user opens the Group picker (same source as More Spaces).
  useEffect(() => {
    if (selectedType !== 'group' || !group?.slug) return
    dispatch(fetchGroupRelationships(group.slug))
  }, [selectedType, group?.slug, dispatch])

  const relatedGroupOptions = useMemo(() => {
    const byId = new Map()
    ;[...parentGroups, ...childGroups, ...peerGroups].forEach(related => {
      if (related?.id) byId.set(related.id, related)
    })
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [parentGroups, childGroups, peerGroups])

  const typesInMenu = useMemo(
    () => new Set((groupViews || []).map(view => view.type)),
    [groupViews]
  )

  const isTypeInMenu = useCallback((type) => {
    return SINGLETON_VIEW_TYPES.has(type) && typesInMenu.has(type)
  }, [typesInMenu])

  const commonViewTypes = useMemo(
    () => COMMON_VIEW_TYPES.filter(type => !isTypeInMenu(type)),
    [isTypeInMenu]
  )

  const customViewTypes = CUSTOM_VIEW_TYPES

  const resetTypeFields = useCallback(() => {
    setLinkName('')
    setLinkUrl('')
    setLinkIcon('Globe')
    setTextContent('')
    setPeople([])
    setPeopleSearch(null)
    setPeopleSelectorOpen(false)
  }, [])

  const handleRowClick = useCallback((type) => {
    if (isTypeInMenu(type)) return
    setSelectedType(prev => {
      if (prev === type) {
        resetTypeFields()
        return null
      }
      resetTypeFields()
      return type
    })
  }, [isTypeInMenu, resetTypeFields])

  const canAdd = useMemo(() => {
    if (!selectedType) return false
    if (ENTITY_VIEW_TYPES.has(selectedType)) return false
    if (selectedType === 'link') return Boolean(linkName.trim() && linkUrl.trim())
    if (selectedType === 'text') return Boolean(textContent.trim())
    if (selectedType === 'custom' || selectedType === 'collection' || selectedType === 'space-collection') return true
    return true
  }, [selectedType, linkName, linkUrl, textContent])

  const placementFields = useMemo(() => ({ addToEnd: true }), [])

  /** Create a GroupView (or stage via onAdd) and close the dialog. */
  const createView = useCallback(async (viewData) => {
    if (onAdd) {
      onAdd(viewData)
      onClose()
      return
    }
    if (!group?.id) return

    setIsCreating(true)
    try {
      await dispatch(createGroupView({ groupId: group.id, ...viewData }))
      // Stay in edit menu mode after creating a view (unlike spaces, which navigate in)
      onClose()
    } catch (error) {
      console.error('Failed to create group view:', error)
    } finally {
      setIsCreating(false)
    }
  }, [dispatch, group?.id, onAdd, onClose])

  const handleAdd = useCallback(async () => {
    if (!canAdd || !selectedType) return
    if (!onAdd && !group?.id) return

    if (selectedType === 'custom') {
      setShowCustomViewDialog(true)
      return
    }

    if (selectedType === 'collection') {
      setShowCollectionDialog(true)
      return
    }

    if (selectedType === 'space-collection') {
      setShowSpaceCollectionDialog(true)
      return
    }

    if (selectedType === 'welcome') {
      setShowWelcomeViewDialog(true)
      return
    }

    await createView({
      type: selectedType,
      name: selectedType === 'link' ? linkName.trim() : null,
      link: selectedType === 'link' ? (sanitizeURL(linkUrl.trim()) || linkUrl.trim()) : null,
      icon: selectedType === 'link' ? linkIcon : null,
      pageContent: selectedType === 'text' ? textContent.trim() : null,
      ...placementFields
    })
  }, [canAdd, createView, group?.id, selectedType, linkName, linkUrl, linkIcon, textContent, onAdd, placementFields])

  const handleSelectPost = useCallback((post) => {
    if (!post?.id || isCreating) return
    createView({
      type: 'post',
      name: post.title || null,
      postId: post.id,
      ...placementFields
    })
  }, [createView, isCreating, placementFields])

  const handleSelectPerson = useCallback((person) => {
    if (!person?.id || isCreating) return
    createView({
      type: 'member',
      name: person.name || null,
      userId: person.id,
      ...placementFields
    })
  }, [createView, isCreating, placementFields])

  const handleSelectGroups = useCallback((selectedGroups) => {
    if (isCreating) return
    const selectedGroup = selectedGroups?.[selectedGroups.length - 1]
    if (!selectedGroup?.id) return
    createView({
      type: 'group',
      name: selectedGroup.name || null,
      linkedGroupId: selectedGroup.id,
      ...placementFields
    })
  }, [createView, isCreating, placementFields])

  const fetchPeopleForGroup = useCallback(async (autocomplete = '') => {
    if (!group?.id) return
    const response = await dispatch(fetchPeople({
      autocomplete: typeof autocomplete === 'string' ? autocomplete : peopleSearch || '',
      groupIds: [group.id],
      first: 20
    }))
    const members = response?.payload?.data?.groups?.items?.[0]?.members?.items || []
    setPeople(members)
  }, [dispatch, group?.id, peopleSearch])

  const fetchDefaultPeopleList = useCallback(() => {
    fetchPeopleForGroup('')
  }, [fetchPeopleForGroup])

  const handleCustomViewCreated = useCallback(() => {
    setShowCustomViewDialog(false)
    onClose()
  }, [onClose])

  const handleCollectionCreated = useCallback(() => {
    setShowCollectionDialog(false)
    onClose()
  }, [onClose])

  const handleSpaceCollectionCreated = useCallback(() => {
    setShowSpaceCollectionDialog(false)
    onClose()
  }, [onClose])

  const handleWelcomeViewCreated = useCallback(() => {
    setShowWelcomeViewDialog(false)
    onClose()
  }, [onClose])

  /** Renders one toggle-select row plus any type-specific fields. */
  const renderTypeRow = (type) => {
    const isSelected = selectedType === type
    const presentedView = GroupViewPresenter({ type })
    const label = displayNameForView({ type }, t)

    return (
      <React.Fragment key={type}>
        <button
          type='button'
          onClick={() => handleRowClick(type)}
          className={cn(
            'flex items-center gap-3 w-full px-2 py-1 text-left rounded-md transition-colors cursor-pointer',
            'hover:bg-foreground/5',
            isSelected && 'bg-selected/10'
          )}
        >
          <Checkbox
            checked={isSelected}
            className='pointer-events-none'
            aria-hidden
          />
          <GroupViewIcon view={presentedView} className='w-4 h-4 shrink-0 text-foreground/70' />
          <span className='flex-1 text-base text-foreground truncate'>{label}</span>
          <span className='text-xs text-foreground/50 shrink-0 max-w-[40%] text-right truncate'>
            {descriptionForViewType(type, t)}
          </span>
        </button>

        {isSelected && type === 'text' && (
          <div className='ml-9 mr-1 mb-1'>
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              placeholder={t('Text to display in the menu')}
              rows={3}
              className='w-full rounded-md border border-foreground/20 bg-input p-2 text-sm text-foreground'
            />
          </div>
        )}

        {isSelected && type === 'link' && (
          <div className='ml-9 mr-1 mb-1 flex flex-col gap-2'>
            <div className='flex flex-col gap-1'>
              <label className='text-sm text-foreground/70'>{t('Icon')}</label>
              <LucideIconPicker value={linkIcon} onChange={setLinkIcon} />
            </div>
            <Input
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
              placeholder={t('Title')}
            />
            <Input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder={t('URL')}
            />
          </div>
        )}

        {isSelected && type === 'post' && group && (
          <div className='ml-9 mr-1 mb-1' onClick={e => e.stopPropagation()}>
            <PostSelector group={group} onSelectPost={handleSelectPost} posts={[]} />
          </div>
        )}

        {isSelected && type === 'member' && group && (
          <div className='ml-9 mr-1 mb-1' onClick={e => e.stopPropagation()}>
            <PeopleSelector
              showLabel={false}
              placeholder={t('Search for a member')}
              fetchPeople={fetchPeopleForGroup}
              fetchDefaultList={fetchDefaultPeopleList}
              setPeopleSearch={setPeopleSearch}
              people={people}
              selectedPeople={[]}
              selectPerson={handleSelectPerson}
              removePerson={() => {}}
              peopleSelectorOpen={peopleSelectorOpen}
              onFocus={() => setPeopleSelectorOpen(true)}
              autoFocus
            />
          </div>
        )}

        {isSelected && type === 'group' && (
          <div className='ml-9 mr-1 mb-1' onClick={e => e.stopPropagation()}>
            <GroupsSelector
              options={relatedGroupOptions}
              selected={[]}
              onChange={handleSelectGroups}
              placeholder={relatedGroupOptions.length === 0 ? t('No related groups available') : t('Type group name...')}
            />
          </div>
        )}
      </React.Fragment>
    )
  }

  // Portal above AuthLayout nav stacking so the dialog is not trapped behind GlobalNav.
  return createPortal(
    <>
      <div className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 pointer-events-auto'>
        <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md max-h-[80vh] flex flex-col'>
          <h2 className='text-lg font-semibold mb-4'>{t('Add View')}</h2>

          <div className='flex flex-col gap-1 overflow-y-auto flex-1 min-h-0'>
            {commonViewTypes.length > 0 && (
              <section>
                <h3 className='text-xs font-semibold uppercase tracking-wide text-foreground/50 px-2 py-1.5'>
                  {t('Common Views')}
                </h3>
                {commonViewTypes.map(type => renderTypeRow(type))}
              </section>
            )}
            {customViewTypes.length > 0 && (
              <section>
                <h3 className={cn(
                  'text-xs font-semibold uppercase tracking-wide text-foreground/50 px-2 py-1.5',
                  commonViewTypes.length > 0 && 'mt-2'
                )}
                >
                  {t('Custom Views')}
                </h3>
                {customViewTypes.map(type => renderTypeRow(type))}
              </section>
            )}
          </div>

          <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
            <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
            {!ENTITY_VIEW_TYPES.has(selectedType) && (
              <Button variant='secondary' disabled={!canAdd || isCreating} onClick={handleAdd}>
                {isCreating
                  ? t('Creating...')
                  : (selectedType === 'custom' || selectedType === 'collection' || selectedType === 'space-collection' || selectedType === 'welcome')
                      ? t('Next')
                      : t('Add View')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {showCustomViewDialog && (
        <AddCustomViewDialog
          group={group}
          onCancel={() => setShowCustomViewDialog(false)}
          onCreated={handleCustomViewCreated}
          onAdd={onAdd ? (viewData) => { onAdd(viewData); handleCustomViewCreated() } : undefined}
        />
      )}

      {showCollectionDialog && (
        <AddCollectionDialog
          group={group}
          onCancel={() => setShowCollectionDialog(false)}
          onCreated={handleCollectionCreated}
          onAdd={onAdd ? (viewData) => { onAdd(viewData); handleCollectionCreated() } : undefined}
        />
      )}

      {showSpaceCollectionDialog && (
        <AddSpaceCollectionDialog
          group={group}
          onCancel={() => setShowSpaceCollectionDialog(false)}
          onCreated={handleSpaceCollectionCreated}
          onAdd={onAdd ? (viewData) => { onAdd(viewData); handleSpaceCollectionCreated() } : undefined}
        />
      )}

      {showWelcomeViewDialog && (
        <AddWelcomeViewDialog
          group={group}
          onCancel={() => setShowWelcomeViewDialog(false)}
          onCreated={handleWelcomeViewCreated}
          onAdd={onAdd ? (viewData) => { onAdd(viewData); handleWelcomeViewCreated() } : undefined}
        />
      )}
    </>,
    document.body
  )
}

/** Button row for adding views in edit mode. */
export function AddViewButton ({ onClick, className }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full min-h-[34px] px-2 text-sm text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 rounded-md transition-all opacity-85 hover:opacity-100',
        className
      )}
    >
      <Plus className='w-3.5 h-3.5' />
      <span>{t('Add View')}</span>
    </button>
  )
}
