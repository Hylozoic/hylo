import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Check, MessageCircle } from 'lucide-react'
import RoundImageRow from 'components/RoundImageRow'
import { cn } from 'util/index'
import { dueInfo } from './boardState'

/** Due chip colours (literal class names so Tailwind's scanner picks them up). */
const DUE_TONE = {
  late: 'bg-destructive/15 text-destructive',
  soon: 'bg-accent/15 text-accent',
  normal: 'bg-foreground/10 text-foreground/70'
}

/** The card's face, shared by the sortable card and the copy shown under the pointer while dragging. */
export function TaskCardFace ({ task, isDone, onToggleDone, onOpen, className, dragging }) {
  const { t, i18n } = useTranslation()
  const due = dueInfo(task.endTime, { done: isDone, locale: i18n?.language })
  const assignees = task.members?.items || []
  const hasFooter = due || task.commentsTotal > 0 || assignees.length > 0

  return (
    <div
      data-testid='task-card'
      data-task-title={task.title}
      onClick={onOpen}
      className={cn(
        'rounded-lg bg-card border border-foreground/10 p-2.5 shadow-sm cursor-grab select-none transition-shadow hover:border-foreground/30 hover:shadow-md',
        dragging && 'shadow-xl cursor-grabbing',
        className
      )}
    >
      <div className='flex items-start gap-2'>
        <button
          type='button'
          data-testid='task-card-done-toggle'
          aria-label={isDone ? t('Mark not done') : t('Mark complete')}
          title={isDone ? t('Mark not done') : t('Mark complete')}
          onClick={e => { e.stopPropagation(); onToggleDone && onToggleDone() }}
          onPointerDown={e => e.stopPropagation()}
          className={cn(
            'mt-0.5 w-4 h-4 shrink-0 rounded-full grid place-items-center p-0 cursor-pointer',
            isDone ? 'bg-selected border-none text-white' : 'bg-transparent border border-foreground/40 text-transparent hover:border-selected'
          )}
        >
          <Check className='w-2.5 h-2.5' strokeWidth={3} />
        </button>
        <div className={cn('flex-1 min-w-0 text-sm font-bold leading-snug break-words', isDone ? 'text-foreground/60' : 'text-foreground')}>
          {task.title}
        </div>
      </div>
      {hasFooter && (
        <div className='flex items-center gap-2 mt-2 pl-6'>
          {due && (
            <span className={cn('inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-bold whitespace-nowrap', DUE_TONE[due.tone])}>
              <Calendar className='w-3 h-3' />
              {due.days === 0 && !isDone ? t('Today') : due.label}
            </span>
          )}
          {task.commentsTotal > 0 && (
            <span className='inline-flex items-center gap-1 text-[11px] font-bold text-foreground/60'>
              <MessageCircle className='w-3 h-3' />{task.commentsTotal}
            </span>
          )}
          {assignees.length > 0 && (
            <span className='ml-auto' title={assignees.map(a => a.name).join(', ')}>
              <RoundImageRow imageUrls={assignees.map(a => a.avatarUrl)} cap={3} tiny />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** A draggable task card in a column. */
export default function TaskCard ({ task, isDone, onToggleDone, onOpen, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(isDragging && 'opacity-40')}>
      <TaskCardFace task={task} isDone={isDone} onToggleDone={onToggleDone} onOpen={onOpen} />
    </div>
  )
}
