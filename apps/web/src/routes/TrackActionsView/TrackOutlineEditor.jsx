import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { Ellipsis, GripVertical, Plus } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import ActionCompletionResponsesDialog from 'components/ActionCompletionResponsesDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { applyDateInputValue, toDateInputValue } from 'components/ui/nativeDateTimePicker'
import useRouteParams from 'hooks/useRouteParams'
import deletePost from 'store/actions/deletePost'
import { createTrackModule, deleteTrackModule, updateTrackModule, updateTrackOutline } from 'store/actions/groupViews'
import { updateTrack } from 'store/actions/trackActions'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { createPostUrl, editPostUrl, postUrl } from '@hylo/navigation'
import { cn } from 'util/index'

import { CompletionTypeTag } from './TrackOutlineParts'
import { moduleNumber, moveOutlineItem, outlineToInput } from './outlineModel'

const fieldClass = 'h-8 px-2.5 rounded-lg border border-foreground/20 bg-background text-foreground text-[13px] outline-none focus:border-foreground/50'

// Drag and drop ids are "<type>:<id>", e.g. "action:42" or "module-end:7"
const dndId = (type, id) => `${type}:${id}`
const parseDndId = value => {
  const [type, id] = String(value).split(':')
  return { type, id }
}

/** Pointer position first, so short rows inside a module win over the module around them. */
function collisionDetection (args) {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCenter(args)
}

/**
 * A text field that keeps its own draft and saves when the person leaves it or
 * presses Enter, so each keystroke isn't a request.
 */
function SavedInput ({ value, onSave, className, inputRef, required, ...props }) {
  const [draft, setDraft] = useState(value || '')
  useEffect(() => { setDraft(value || '') }, [value])

  const save = () => {
    const trimmed = draft.trim()
    if (required && !trimmed) {
      setDraft(value || '')
      return
    }
    if (trimmed !== (value || '')) onSave(trimmed)
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={event => { if (event.key === 'Enter') event.target.blur() }}
      className={cn(fieldClass, className)}
      {...props}
    />
  )
}

/** One action in the editor: drag by the grip, click to edit, open its completions, or remove it. */
function EditRow ({ post, nested, track, groupId, viewId }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useRouteParams()
  const querystringParams = getQuerystringParam(['edit'], location)
  const [showResponses, setShowResponses] = useState(false)

  const id = dndId('action', post.id)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id })
  const { setNodeRef: setDropRef, isOver, active } = useDroppable({ id })
  const showDropLine = isOver && active && active.id !== id

  const remove = () => {
    if (window.confirm(t('Are you sure you want to remove this action? You cannot undo this.'))) {
      dispatch(deletePost(post.id, groupId, track.id, viewId))
    }
  }

  return (
    <div
      ref={node => { setDragRef(node); setDropRef(node) }}
      data-testid='track-edit-action'
      className={cn(
        'flex items-center gap-2.5 rounded-[10px] border border-foreground/15',
        nested ? 'py-2 px-3 bg-background/60' : 'py-3 px-3.5 bg-card',
        showDropLine && 'shadow-[inset_0_3px_0_hsl(var(--focus))]',
        isDragging && 'opacity-40'
      )}
    >
      <button type='button' className='text-foreground/50 cursor-grab touch-none flex' aria-label={t('Drag to reorder')} {...listeners} {...attributes}>
        <GripVertical className='w-4 h-4' />
      </button>
      <button
        type='button'
        className='flex-1 min-w-0 text-left text-sm font-semibold truncate hover:underline'
        onClick={() => navigate(editPostUrl(post.id, routeParams, querystringParams))}
      >
        {post.title}
      </button>
      <CompletionTypeTag type={post.completionAction} />
      <button type='button' className='text-xs text-foreground/60 whitespace-nowrap hover:text-foreground hover:underline' onClick={() => setShowResponses(true)}>
        {t('{{count}} done', { count: post.numPeopleCompleted || 0 })}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className='outline-none text-foreground/60 hover:text-foreground' aria-label={t('More options')}>
          <Ellipsis className='w-4 h-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}${postUrl(post.id, routeParams)}`)}>
            {t('Copy Link')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={remove}>{t('Remove')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {showResponses && <ActionCompletionResponsesDialog post={post} onClose={() => setShowResponses(false)} />}
    </div>
  )
}

/**
 * A module in the editor: rename it, set when it opens, describe it, and add or
 * drop actions into it. Dropping on the header adds an action to the end.
 */
function EditModule ({ item, number, track, groupId, viewId, autoFocus, onAddAction }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const titleRef = useRef(null)
  const trackModule = item.module
  const count = item.posts.length

  useEffect(() => {
    if (autoFocus && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [autoFocus])

  const id = dndId('module', item.id)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id })
  const { setNodeRef: setHeadRef, isOver: overHead, active } = useDroppable({ id })
  const { setNodeRef: setEndRef, isOver: overEndZone } = useDroppable({ id: dndId('module-end', item.id) })
  const draggingAction = active && parseDndId(active.id).type === 'action'
  const showHeadLine = overHead && active && active.id !== id
  const overEnd = overEndZone && draggingAction

  const save = data => dispatch(updateTrackModule({ groupId, viewId, moduleId: item.id, data }))

  const opening = trackModule.opensAt ? 'date' : trackModule.opensAfterPrevious ? 'after' : 'now'
  const changeOpening = value => {
    if (value === 'now') return save({ opensAt: null, opensAfterPrevious: false })
    if (value === 'after') return save({ opensAt: null, opensAfterPrevious: true })
    // Default to a week from today, at the start of the day
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setHours(0, 0, 0, 0)
    return save({ opensAt: nextWeek.toISOString(), opensAfterPrevious: false })
  }
  const changeOpeningDate = value => {
    if (!value) return
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    const date = applyDateInputValue(trackModule.opensAt ? new Date(trackModule.opensAt) : null, value, midnight)
    if (date) save({ opensAt: date.toISOString() })
  }

  const remove = () => dispatch(deleteTrackModule({ groupId, viewId, moduleId: item.id }))

  return (
    <div
      data-testid='track-edit-module'
      className={cn(
        'rounded-xl border border-focus/40 bg-focus/5',
        showHeadLine && 'shadow-[inset_0_3px_0_hsl(var(--focus))]',
        isDragging && 'opacity-40'
      )}
    >
      <div ref={node => { setDragRef(node); setHeadRef(node) }} className='flex items-center flex-wrap gap-x-2.5 gap-y-2 py-3 px-3.5'>
        <button type='button' className='text-foreground/50 cursor-grab touch-none flex' aria-label={t('Drag to reorder')} {...listeners} {...attributes}>
          <GripVertical className='w-4 h-4' />
        </button>
        <span className='text-xs font-bold text-foreground/70 whitespace-nowrap'>{track.moduleDescriptor} {number}</span>
        <SavedInput
          inputRef={titleRef}
          value={trackModule.title}
          onSave={title => save({ title })}
          required
          aria-label={t('{{moduleDescriptor}} title', { moduleDescriptor: track.moduleDescriptor })}
          className='flex-1 min-w-[140px] text-[15px] font-bold bg-transparent border-transparent hover:border-foreground/20'
        />
        <select
          value={opening}
          onChange={event => changeOpening(event.target.value)}
          aria-label={t('When it opens')}
          className={cn(fieldClass, 'max-w-[170px]')}
        >
          <option value='now'>{t('Open now')}</option>
          <option value='date'>{t('Opens on a date')}</option>
          {number > 1 && <option value='after'>{t('After {{moduleDescriptor}} {{number}}', { moduleDescriptor: track.moduleDescriptor, number: number - 1 })}</option>}
        </select>
        {trackModule.opensAt && (
          <input
            type='date'
            value={toDateInputValue(new Date(trackModule.opensAt))}
            onChange={event => changeOpeningDate(event.target.value)}
            aria-label={t('Opening date')}
            className={fieldClass}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className='outline-none w-[30px] h-[30px] rounded-md grid place-items-center text-foreground/60 hover:bg-foreground/10' aria-label={t('{{moduleDescriptor}} options', { moduleDescriptor: track.moduleDescriptor })}>
            <Ellipsis className='w-4 h-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={remove} className='text-destructive focus:text-destructive'>
              {count > 0
                ? t('Remove {{moduleDescriptor}} (keep its {{count}} {{actionDescriptor}})', {
                  moduleDescriptor: track.moduleDescriptor,
                  count,
                  actionDescriptor: count === 1 ? track.actionDescriptor : track.actionDescriptorPlural
                })
                : t('Remove {{moduleDescriptor}}', { moduleDescriptor: track.moduleDescriptor })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className='pt-0 pr-3 pb-3 pl-3 sm:pl-9 flex flex-col gap-1.5'>
        <SavedInput
          value={trackModule.description}
          onSave={description => save({ description })}
          placeholder={t('What this {{moduleDescriptor}} is about (optional)', { moduleDescriptor: track.moduleDescriptor })}
          className='w-full bg-transparent text-foreground/80 mb-0.5'
        />
        {item.posts.map(post => (
          <EditRow key={post.id} post={post} nested track={track} groupId={groupId} viewId={viewId} />
        ))}
        <button
          ref={setEndRef}
          type='button'
          onClick={() => onAddAction(item.id)}
          className={cn(
            'flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed text-[13px] font-semibold text-foreground/70 hover:border-foreground/60 hover:text-foreground transition-colors',
            overEnd ? 'border-focus bg-focus/15' : 'border-foreground/30'
          )}
        >
          <Plus className='w-3.5 h-3.5' />
          {count > 0
            ? t('Add {{actionDescriptor}}', { actionDescriptor: track.actionDescriptor })
            : t('Add {{actionDescriptor}}, or drag one here', { actionDescriptor: track.actionDescriptor })}
        </button>
      </div>
    </div>
  )
}

/** Drop zone under the outline: anything dropped here goes to the end of the top level. */
function EndDropZone () {
  const { setNodeRef, isOver } = useDroppable({ id: dndId('end', 'outline') })
  return <div ref={setNodeRef} className={cn('h-3.5 rounded-md', isOver && 'bg-focus/50')} />
}

/**
 * The outline editor for a track: name the modules and actions, drag to reorder,
 * drag an action into or out of a module, and add actions or modules.
 */
export default function TrackOutlineEditor ({ items, track, groupId, viewId }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const [dragging, setDragging] = useState(null)
  const [focusModuleId, setFocusModuleId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = ({ active, over }) => {
    setDragging(null)
    if (!over) return
    const dragged = parseDndId(active.id)
    const target = parseDndId(over.id)
    const moved = moveOutlineItem(items, { kind: dragged.type, id: dragged.id }, target)
    if (moved !== items) dispatch(updateTrackOutline({ groupId, viewId, items: outlineToInput(moved) }))
  }

  const addAction = moduleId => {
    navigate(createPostUrl(routeParams, { newPostType: 'action', viewId, moduleId: moduleId || undefined, edit: 'true' }))
  }

  const addModule = async () => {
    const action = await dispatch(createTrackModule({
      groupId,
      viewId,
      data: { title: t('Untitled {{moduleDescriptor}}', { moduleDescriptor: track.moduleDescriptor }) }
    }))
    const created = action?.payload?.data?.createTrackModule
    if (created?.id) setFocusModuleId(String(created.id))
  }

  const rename = field => value => dispatch(updateTrack({ trackId: track.id, [field]: value }))

  const draggingTitle = dragging && (dragging.type === 'module'
    ? items.find(item => item.kind === 'module' && item.id === dragging.id)?.module.title
    : items.flatMap(item => item.kind === 'module' ? item.posts : [item.post]).find(post => String(post.id) === dragging.id)?.title)

  return (
    <>
      <div className='flex flex-wrap items-center gap-2.5 py-3 px-3.5 rounded-xl bg-card border border-foreground/10 mb-4 text-[13px] text-foreground/70' data-testid='track-naming'>
        <span>{t('Call them')}</span>
        <SavedInput value={track.moduleDescriptor} onSave={rename('moduleDescriptor')} required aria-label={t('Module name')} className='w-24' />
        <SavedInput value={track.moduleDescriptorPlural} onSave={rename('moduleDescriptorPlural')} required aria-label={t('Module name plural')} className='w-24' />
        <span>{t('and')}</span>
        <SavedInput value={track.actionDescriptor} onSave={rename('actionDescriptor')} required aria-label={t('Action name')} className='w-24' />
        <SavedInput value={track.actionDescriptorPlural} onSave={rename('actionDescriptorPlural')} required aria-label={t('Action name plural')} className='w-24' />
        <span className='w-full text-xs text-foreground/50'>
          {t('Drag to reorder, or drag a {{actionDescriptor}} into or out of a {{moduleDescriptor}}. {{moduleDescriptorPlural}} can’t go inside other {{moduleDescriptorPlural}}.', {
            actionDescriptor: track.actionDescriptor,
            moduleDescriptor: track.moduleDescriptor,
            moduleDescriptorPlural: track.moduleDescriptorPlural
          })}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={({ active }) => setDragging(parseDndId(active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className='flex flex-col gap-2.5'>
          {items.map(item => item.kind === 'module'
            ? (
              <EditModule
                key={`module-${item.id}`}
                item={item}
                number={moduleNumber(items, item.id)}
                track={track}
                groupId={groupId}
                viewId={viewId}
                autoFocus={focusModuleId === item.id}
                onAddAction={addAction}
              />
              )
            : <EditRow key={`action-${item.id}`} post={item.post} track={track} groupId={groupId} viewId={viewId} />)}
          <EndDropZone />
        </div>
        <DragOverlay>
          {draggingTitle != null && (
            <div data-testid='track-drag-overlay' className='flex items-center gap-2.5 rounded-[10px] border border-focus bg-card py-2.5 px-3.5 text-sm font-semibold shadow-2xl cursor-grabbing'>
              <GripVertical className='w-4 h-4 text-foreground/50' />
              <span className='truncate'>{draggingTitle}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className='flex gap-2.5 mt-1.5'>
        <button
          type='button'
          onClick={() => addAction(null)}
          className='flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-foreground/30 hover:border-foreground/60 text-[13px] font-bold transition-colors'
        >
          <Plus className='w-3.5 h-3.5' />
          {t('Add {{actionDescriptor}}', { actionDescriptor: track.actionDescriptor })}
        </button>
        <button
          type='button'
          onClick={addModule}
          data-testid='track-add-module'
          className='flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-foreground/30 hover:border-foreground/60 text-[13px] font-bold transition-colors'
        >
          <Plus className='w-3.5 h-3.5' />
          {t('Add {{moduleDescriptor}}', { moduleDescriptor: track.moduleDescriptor })}
        </button>
      </div>
    </>
  )
}
