import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Boxes, GripVertical, Plus, X } from 'lucide-react'

import { useViewHeader } from 'contexts/ViewHeaderContext'
import { localSpaceSlug, spaceUrl } from '@hylo/navigation'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { updateGroupView } from 'store/actions/groupViews'
import { FETCH_GROUP_SPACES, RESP_ADMINISTRATION } from 'store/constants'
import { getGroupViewById } from 'store/selectors/getGroupViews'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import isPendingFor from 'store/selectors/isPendingFor'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import SpaceSelector from 'components/SpaceSelector'
import Button from 'components/ui/button'
import { cn } from 'util/index'
import {
  filterSpacesForMenuVisibility,
  spaceMenuVisibilityOpts
} from 'util/spaceVisibility'
import {
  appendSpaceId,
  removeSpaceId,
  resolveSpacesByIds,
  spaceIdsFromSettings,
  withSpaceIds
} from 'util/spaceCollection'

import AddSpaceDialog from 'routes/AuthLayoutRouter/components/ContextMenu/AddSpaceDialog'
import { SpaceViewCard } from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewCard'
import EditingBottomBar, { EDITING_BAR_BUTTON_CLASS } from 'routes/AuthLayoutRouter/components/ContextMenu/EditingBottomBar'
import ViewsGridSkeleton from 'routes/AuthLayoutRouter/components/ContextMenu/ViewsGridSkeleton'
import { spaceEntryUrl } from 'routes/AuthLayoutRouter/components/ContextMenu/groupViewMenuUrl'
import { CARD_CLASS, CARD_SIZE_CLASS, cardChrome } from 'routes/AuthLayoutRouter/components/ContextMenu/viewCardTheme'
import useAppearance from 'hooks/useAppearance'

const MOUSE_ACTIVATION = { distance: 5 }
const TOUCH_ACTIVATION = { delay: 180, tolerance: 8 }

/**
 * Steward-curated grid of spaces. Looks like More Spaces; membership is stored
 * on the view's settings.spaceIds.
 */
export default function SpaceCollection ({ group, parentGroup }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { viewId } = useParams()
  const { setHeaderDetails } = useViewHeader()
  const { effectiveColorScheme } = useAppearance()
  const containerRef = useRef(null)

  const ownerGroup = group
  const urlGroup = parentGroup || group
  const groupSlug = urlGroup?.slug
  const isEditingRequested = getQuerystringParam('edit', location) === 'true'
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: ownerGroup?.id
  }))
  const isEditing = isEditingRequested && canAdminister

  const view = useSelector(state => getGroupViewById(state, ownerGroup, viewId))
  const pending = useSelector(state => isPendingFor(FETCH_GROUP_SPACES, state))
  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const publishedOfferings = usePublishedOfferings(ownerGroup?.id)

  const [showPicker, setShowPicker] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const visibilityOpts = useMemo(() => spaceMenuVisibilityOpts({
    offerings: publishedOfferings,
    canManageSpaces: canAdminister,
    memberships: myMemberships,
    currentUser,
    parentGroupId: ownerGroup?.id
  }), [publishedOfferings, canAdminister, myMemberships, currentUser, ownerGroup?.id])

  const allSpaces = ownerGroup?.spaces?.items || []
  const visibleSpaces = useMemo(
    () => filterSpacesForMenuVisibility(allSpaces, visibilityOpts).map(space => ({
      ...space,
      isDraft: Boolean(space.track && !space.track.publishedAt)
    })),
    [allSpaces, visibilityOpts]
  )

  const spaceIds = useMemo(() => spaceIdsFromSettings(view?.settings), [view?.settings])
  const collectionSpaces = useMemo(
    () => filterSpacesForMenuVisibility(resolveSpacesByIds(allSpaces, spaceIds), visibilityOpts),
    [allSpaces, spaceIds, visibilityOpts]
  )

  const presentedView = useMemo(
    () => view ? GroupViewPresenter(view) : { type: 'space-collection' },
    [view]
  )
  const title = view ? displayNameForView(presentedView, t) : t('Space Collection')

  useEffect(() => {
    setHeaderDetails({
      title: isEditing
        ? (
          <span className='flex items-center gap-2'>
            {title}
            <span className='text-xs font-semibold rounded-full border border-foreground/20 bg-foreground/10 text-foreground/70 px-2 py-px leading-none self-center'>
              {t('Editing')}
            </span>
          </span>
          )
        : title,
      icon: <Boxes />,
      info: '',
      search: false
    })
  }, [setHeaderDetails, t, isEditing, title])

  useEffect(() => {
    if (!ownerGroup?.id) return
    dispatch(fetchGroupViews(ownerGroup.id))
    dispatch(fetchGroupSpaces(ownerGroup.id))
  }, [dispatch, ownerGroup?.id])

  const persistSpaceIds = useCallback(async (nextIds) => {
    if (!view?.id || !ownerGroup?.id) return
    await dispatch(updateGroupView({
      id: view.id,
      groupId: ownerGroup.id,
      settings: withSpaceIds(view.settings, nextIds)
    }))
  }, [dispatch, view?.id, view?.settings, ownerGroup?.id])

  const handleOpenSpace = useCallback((space) => {
    if (isEditing || !groupSlug) return
    navigate(spaceEntryUrl(groupSlug, space), { state: { fromSpaceCollection: true } })
  }, [isEditing, groupSlug, navigate])

  const handleOpenSpaceAbout = useCallback((space) => {
    if (!groupSlug) return
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(spaceUrl(groupSlug, local, '/about'))
  }, [groupSlug, navigate])

  const handleRemoveFromCollection = useCallback(async (space) => {
    await persistSpaceIds(spaceIdsFromSettings(removeSpaceId(view?.settings, space.id)))
  }, [persistSpaceIds, view?.settings])

  const handleSelectSpace = useCallback(async (space) => {
    await persistSpaceIds(spaceIdsFromSettings(appendSpaceId(view?.settings, space.id)))
  }, [persistSpaceIds, view?.settings])

  const handleReorderSpace = useCallback(async (space, newIndex) => {
    const current = collectionSpaces.map(s => String(s.id))
    const fromIndex = current.indexOf(String(space.id))
    if (fromIndex === -1) return
    await persistSpaceIds(arrayMove(current, fromIndex, newIndex))
  }, [collectionSpaces, persistSpaceIds])

  const handleSpaceCreated = useCallback(async (newSpace) => {
    setShowAddSpace(false)
    if (ownerGroup?.id) await dispatch(fetchGroupSpaces(ownerGroup.id))
    if (newSpace?.id) {
      await persistSpaceIds(spaceIdsFromSettings(appendSpaceId(view?.settings, newSpace.id)))
    }
  }, [dispatch, ownerGroup?.id, persistSpaceIds, view?.settings])

  const handleDoneEditing = useCallback(() => {
    if (!groupSlug) return
    const path = location.pathname
    navigate(path)
  }, [navigate, groupSlug, location.pathname])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = collectionSpaces.findIndex(s => String(s.id) === String(active.id))
    const newIndex = collectionSpaces.findIndex(s => String(s.id) === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    persistSpaceIds(arrayMove(collectionSpaces.map(s => String(s.id)), oldIndex, newIndex))
  }, [collectionSpaces, persistSpaceIds])

  const activeSpace = collectionSpaces.find(s => String(s.id) === String(activeId))
  const hasContent = collectionSpaces.length > 0

  return (
    <div ref={containerRef} className={cn('w-full max-w-[980px] mx-auto px-4 py-6', isEditing && 'pb-24')} data-testid='space-collection'>
      {pending && !hasContent
        ? <ViewsGridSkeleton />
        : !hasContent
            ? <p className='text-sm text-foreground/40'>{t('No spaces in this collection')}</p>
            : isEditing
              ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={collectionSpaces.map(s => s.id)} strategy={rectSortingStrategy}>
                    <div className='flex flex-wrap gap-3'>
                      {collectionSpaces.map(space => (
                        <SortableSpaceCard
                          key={space.id}
                          space={space}
                          isEditing
                          onOpen={handleOpenSpace}
                          onOpenAbout={handleOpenSpaceAbout}
                          onRemove={handleRemoveFromCollection}
                        />
                      ))}
                      <button
                        type='button'
                        onClick={() => setShowPicker(true)}
                        className={cn(
                          CARD_CLASS,
                          cardChrome(effectiveColorScheme === 'dark'),
                          'border-dashed border-foreground/30 hover:border-foreground/50 bg-transparent items-center justify-center text-foreground/60 hover:text-foreground'
                        )}
                      >
                        <Plus className='w-6 h-6' />
                        <span className='text-sm font-semibold mt-1'>{t('Add spaces')}</span>
                      </button>
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeSpace
                      ? (
                        <div className={CARD_SIZE_CLASS}>
                          <SpaceViewCard space={activeSpace} isEditing />
                        </div>
                        )
                      : null}
                  </DragOverlay>
                </DndContext>
                )
              : (
                <div className='flex flex-wrap gap-3'>
                  {collectionSpaces.map(space => (
                    <SpaceViewCard
                      key={space.id}
                      space={space}
                      onOpen={handleOpenSpace}
                      onOpenAbout={handleOpenSpaceAbout}
                    />
                  ))}
                </div>
                )}

      {isEditing && !hasContent && (
        <div className='flex flex-wrap gap-3 mt-4'>
          <button
            type='button'
            onClick={() => setShowPicker(true)}
            className={cn(
              CARD_CLASS,
              'border-dashed border-foreground/30 hover:border-foreground/50 bg-transparent items-center justify-center text-foreground/60 hover:text-foreground'
            )}
          >
            <Plus className='w-6 h-6' />
            <span className='text-sm font-semibold mt-1'>{t('Add spaces')}</span>
          </button>
        </div>
      )}

      {isEditing && (
        <EditingBottomBar containerRef={containerRef}>
          <div className='w-full max-w-[980px] flex items-center justify-end sm:justify-between gap-4'>
            <p className='hidden sm:flex items-center gap-2 text-sm text-foreground/70 m-0 text-left pointer-events-auto'>
              <GripVertical className='w-4 h-4 shrink-0 text-foreground/50' />
              {t('Drag cards to reorder this collection.')}
            </p>
            <button
              type='button'
              onClick={handleDoneEditing}
              className={cn(EDITING_BAR_BUTTON_CLASS, 'shrink-0')}
            >
              <X className='w-4 h-4' />
              <span>{t('Done Editing')}</span>
            </button>
          </div>
        </EditingBottomBar>
      )}

      {showPicker && (
        <div className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 p-4 pointer-events-auto'>
          <div className='bg-midground rounded-lg shadow-lg p-5 w-full max-w-md max-h-[85vh] flex flex-col'>
            <h2 className='text-lg font-semibold mb-3'>{t('Add spaces')}</h2>
            <div className='overflow-y-auto flex-1 min-h-0'>
              <SpaceSelector
                spaces={visibleSpaces}
                selectedSpaces={collectionSpaces}
                draggable
                onSelectSpace={handleSelectSpace}
                onRemoveSpace={handleRemoveFromCollection}
                onReorderSpace={handleReorderSpace}
                onCreateSpace={() => {
                  setShowPicker(false)
                  setShowAddSpace(true)
                }}
              />
            </div>
            <div className='flex justify-end mt-4 pt-2 border-t border-foreground/10'>
              <Button variant='secondary' onClick={() => setShowPicker(false)}>{t('Done')}</Button>
            </div>
          </div>
        </div>
      )}

      {showAddSpace && (
        <AddSpaceDialog
          group={ownerGroup}
          addToMenu={false}
          onClose={() => setShowAddSpace(false)}
          onCreated={handleSpaceCreated}
        />
      )}
    </div>
  )
}

function SortableSpaceCard ({ space, isEditing, onOpen, onOpenAbout, onRemove }) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: space.id })

  const style = {
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SpaceViewCard
        space={space}
        isEditing={isEditing}
        onOpen={onOpen}
        onOpenAbout={onOpenAbout}
        onHide={onRemove ? () => onRemove(space) : null}
        hideLabel={t('Remove from collection')}
      />
    </div>
  )
}
