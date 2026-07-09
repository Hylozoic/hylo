import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { GripVertical, Plus, X } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import LocationInput from 'components/LocationInput/LocationInput'
import PostTypePills from 'components/PostTypePills/PostTypePills'
import TagInput from 'components/TagInput'
import { CUSTOM_VIEW_POST_TYPE_OPTIONS } from 'components/CustomViewForm/customViewFormConstants'
import { addQuerystringToPath } from '@hylo/navigation'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { createSpace, createGroupView } from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
import { POST_TYPE_TO_VIEW_TYPE } from 'store/models/GroupView'
import { cn } from 'util/index'

import GroupViewIcon from './GroupViewIcon'
import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'

/** Suggested icons covering common space archetypes (chat, circle, team, local group, etc). */
const SPACE_ICON_SUGGESTIONS = [
  'MessageCircleMore',
  'Circle',
  'Building2',
  'MapPin',
  'Users',
  'Sparkles',
  'Heart',
  'Landmark',
  'Trees',
  'Globe'
]

const STANDARD_VIEW_TYPES = new Set(['all', 'chat', 'members', ...Object.values(POST_TYPE_TO_VIEW_TYPE)])

const ACCESS_OPTIONS = [
  {
    value: 'open',
    labelKey: 'Open',
    descKey: 'Anyone who can see this space can join it',
    visibility: GROUP_VISIBILITY.Public,
    accessibility: GROUP_ACCESSIBILITY.Open
  },
  {
    value: 'request',
    labelKey: 'Request to Join',
    descKey: 'Must be approved by a group host',
    visibility: GROUP_VISIBILITY.Public,
    accessibility: GROUP_ACCESSIBILITY.Restricted
  },
  {
    value: 'invite',
    labelKey: 'Invite Only',
    descKey: 'Only people who are invited can join',
    visibility: GROUP_VISIBILITY.Hidden,
    accessibility: GROUP_ACCESSIBILITY.Closed
  },
  {
    value: 'role',
    labelKey: 'Role Gated',
    descKey: 'Only members with the selected roles can join',
    visibility: GROUP_VISIBILITY.Hidden,
    accessibility: GROUP_ACCESSIBILITY.Closed
  },
  {
    value: 'paid',
    labelKey: 'Paid',
    descKey: 'Requires payment to join (details coming soon)',
    visibility: GROUP_VISIBILITY.Hidden,
    accessibility: GROUP_ACCESSIBILITY.Closed
  }
]

/** Keeps drag order stable across renders: preserves the order of keys still present,
 * appends any brand-new keys at the end, and drops keys that no longer exist. */
function mergeViewOrder (prevOrder, currentKeys) {
  const currentSet = new Set(currentKeys)
  const kept = prevOrder.filter(key => currentSet.has(key))
  const keptSet = new Set(kept)
  const added = currentKeys.filter(key => !keptSet.has(key))
  return [...kept, ...added]
}

/** Single draggable row in the Included Views editor. */
function SortableViewRow ({ rowKey, row, isHome, onRemove, t }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowKey })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }
  const presentedView = GroupViewPresenter({ type: row.type, name: row.name, pageContent: row.pageContent })
  const rowLabel = row.name || displayNameForView(presentedView, t)

  return (
    <li ref={setNodeRef} style={style} className='list-none flex items-center gap-1 border-2 border-foreground/10 rounded-md p-1 pl-1'>
      <button type='button' className='p-1 cursor-grab text-foreground/40 shrink-0' {...attributes} {...listeners} aria-label={t('Drag to reorder')}>
        <GripVertical className='w-3.5 h-3.5' />
      </button>
      <GroupViewIcon view={presentedView} className='w-4 h-4 shrink-0 text-foreground/70 mr-2' />
      <span className='flex-1 text-sm text-foreground truncate'>
        {rowLabel}
        {isHome && <span className='ml-1 text-xs text-foreground/50'>({t('Home')})</span>}
      </span>
      {row.removable && (
        <button
          type='button'
          onClick={onRemove}
          className='p-1 text-foreground/40 hover:text-foreground transition-colors'
          aria-label={t('Remove view')}
        >
          <X className='w-3.5 h-3.5' />
        </button>
      )}
    </li>
  )
}

/** Modal for creating a new space under the current group. */
export default function AddSpaceDialog ({ group, onClose }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routerLocation = useLocation()

  const [name, setName] = useState('')
  const [icon, setIcon] = useState(SPACE_ICON_SUGGESTIONS[0])
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [locationObject, setLocationObject] = useState(null)
  const [postTypes, setPostTypes] = useState([])
  const [removedStandardTypes, setRemovedStandardTypes] = useState(new Set())
  const [manualViews, setManualViews] = useState([])
  const [viewOrder, setViewOrder] = useState([])
  const [showAddViewDialog, setShowAddViewDialog] = useState(false)
  const [access, setAccess] = useState('open')
  const [requiredRoles, setRequiredRoles] = useState([])
  const [roleSearchTerm, setRoleSearchTerm] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

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
    const base = ['all', 'chat', 'members']
    const postTypeViews = CUSTOM_VIEW_POST_TYPE_OPTIONS
      .filter(option => option.postTypes.every(type => postTypes.includes(type)))
      .map(option => POST_TYPE_TO_VIEW_TYPE[option.postTypes[0]])
    return [...base, ...postTypeViews].filter(type => !removedStandardTypes.has(type))
  }, [postTypes, removedStandardTypes])

  const rowsByKey = useMemo(() => {
    const rows = {}
    standardViewTypes.forEach(type => {
      rows[type] = { key: type, kind: 'standard', type, removable: type !== 'all' }
    })
    manualViews.forEach(view => {
      rows[view.key] = { ...view, kind: 'manual', removable: true }
    })
    return rows
  }, [standardViewTypes, manualViews])

  const rowKeys = useMemo(() => Object.keys(rowsByKey), [rowsByKey])

  // Reconcile drag order with the current set of rows: keep existing order, append new rows, drop removed ones.
  useEffect(() => {
    setViewOrder(prev => mergeViewOrder(prev, rowKeys))
  }, [rowKeys])

  const orderedRows = useMemo(
    () => viewOrder.map(key => rowsByKey[key]).filter(Boolean),
    [viewOrder, rowsByKey]
  )

  const combinedViewsForAddDialog = useMemo(
    () => orderedRows.map(row => ({ type: row.type })),
    [orderedRows]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setViewOrder(prev => {
      const oldIndex = prev.indexOf(active.id)
      const newIndex = prev.indexOf(over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  const handleRemoveStandardView = useCallback((type) => {
    setRemovedStandardTypes(prev => new Set(prev).add(type))
  }, [])

  const handleRemoveManualView = useCallback((key) => {
    setManualViews(prev => prev.filter(view => view.key !== key))
  }, [])

  const handleAddView = useCallback((viewData) => {
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

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !group?.id) return
    setIsCreating(true)
    try {
      const accessOption = ACCESS_OPTIONS.find(option => option.value === access)
      const standardTypesInOrder = orderedRows.filter(row => row.kind === 'standard').map(row => row.type)
      const manualRowsInOrder = orderedRows.filter(row => row.kind === 'manual')

      const result = await dispatch(createSpace({
        parentGroupId: group.id,
        name: name.trim(),
        description: description || null,
        icon,
        purpose: purpose.trim() || null,
        location: locationObject?.fullText || null,
        locationId: locationObject?.id || null,
        acceptedPostTypes: postTypes,
        visibility: accessOption.visibility,
        accessibility: accessOption.accessibility,
        requiredRoles: access === 'role' ? requiredRoles.map(role => role.id) : null,
        viewTypes: standardTypesInOrder
      }))

      const newSpace = result?.payload?.data?.createSpace
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
            addToEnd: nextId == null,
            orderInFrontOfViewId: nextId || undefined
          }))
          nextId = createResult?.payload?.data?.createGroupView?.id || null
        }
      }

      await dispatch(fetchGroupViews(group.id))
      onClose()
      navigate(addQuerystringToPath(routerLocation.pathname, { edit: 'true' }))
    } catch (error) {
      console.error('Failed to create space:', error)
    } finally {
      setIsCreating(false)
    }
  }, [dispatch, group?.id, name, description, icon, purpose, locationObject, postTypes, access, requiredRoles, orderedRows, onClose, navigate, routerLocation.pathname])

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-darkening/50'>
      <div className='bg-midground rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-[40rem] max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Add Space')}</h2>

        <div className='flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 p-1 -m-1'>
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
            <label className='text-sm text-foreground/70'>{t('Included Views')}</label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={viewOrder} strategy={verticalListSortingStrategy}>
                <ul className='flex flex-col gap-1 m-0 p-0'>
                  {orderedRows.map((row, index) => (
                    <SortableViewRow
                      key={row.key}
                      rowKey={row.key}
                      row={row}
                      isHome={index === 0}
                      onRemove={() => row.kind === 'standard' ? handleRemoveStandardView(row.type) : handleRemoveManualView(row.key)}
                      t={t}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <AddViewButton onClick={() => setShowAddViewDialog(true)} />
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-sm text-foreground/70'>{t('Access')}</label>
            <RadioGroup value={access} onValueChange={setAccess}>
              {ACCESS_OPTIONS.map(option => (
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
        </div>

        <div className='flex justify-end gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onClose}>{t('Cancel')}</Button>
          <Button variant='secondary' disabled={!name.trim() || isCreating} onClick={handleCreate}>
            {isCreating ? t('Creating...') : t('Create')}
          </Button>
        </div>
      </div>

      {showAddViewDialog && (
        <AddGroupViewDialog
          group={null}
          groupViews={combinedViewsForAddDialog}
          acceptedPostTypes={postTypes}
          onAdd={handleAddView}
          onClose={() => setShowAddViewDialog(false)}
        />
      )}
    </div>
  )
}

/** Button row for adding spaces in edit mode. */
export function AddSpaceButton ({ onClick }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      onClick={onClick}
      className='flex items-center gap-2 w-full text-base text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 rounded-md p-2 pl-2 mb-2 transition-all opacity-85 hover:opacity-100'
    >
      <Plus className='w-4 h-4' />
      <span>{t('Add Space')}</span>
    </button>
  )
}
