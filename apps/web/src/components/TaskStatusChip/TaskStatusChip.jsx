import React, { useCallback, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { fetchTaskStatuses, moveTask } from 'store/actions/taskActions'
import { cn } from 'util/index'

/** Dot colour for each status category (literal class names so Tailwind's scanner picks them up). */
const CATEGORY_DOT = {
  todo: 'bg-foreground/40',
  active: 'bg-focus',
  done: 'bg-selected'
}

/** The placement to show: the one for the group being viewed, otherwise the task's first board. */
export function taskPlacementFor (post, groupId) {
  const placements = (post?.taskPlacements || []).filter(p => p.taskStatusId)
  return placements.find(p => String(p.groupId) === String(groupId)) || placements[0] || null
}

/**
 * A task's status: the name of the column it is in on a group's Tasks board. People who can
 * edit the task get a menu of that board's columns and can move it from wherever the post is shown.
 */
export default function TaskStatusChip ({ post, groupId, canEdit, className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [statuses, setStatuses] = useState(null)
  const [saving, setSaving] = useState(false)
  const placement = taskPlacementFor(post, groupId)

  const handleOpenChange = useCallback(async (open) => {
    if (!open || statuses || !placement) return
    const result = await dispatch(fetchTaskStatuses(placement.groupId))
    setStatuses(result?.payload?.data?.group?.taskStatuses || [])
  }, [dispatch, placement, statuses])

  const handleSelect = useCallback(async (status) => {
    if (!placement || String(status.id) === String(placement.taskStatusId)) return
    setSaving(true)
    try {
      await dispatch(moveTask({ postId: post.id, groupId: placement.groupId, taskStatusId: status.id }))
    } finally {
      setSaving(false)
    }
  }, [dispatch, placement, post?.id])

  if (!placement) return null

  const chip = (
    <span
      data-testid='task-status-chip'
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-foreground/20 bg-background text-xs font-bold text-foreground whitespace-nowrap',
        { 'opacity-60': saving },
        className
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', CATEGORY_DOT[placement.statusCategory] || CATEGORY_DOT.active)} />
      {placement.statusName}
      {canEdit && <ChevronDown className='w-3 h-3 text-foreground/60' />}
    </span>
  )

  if (!canEdit) return chip

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          aria-label={t('Change status')}
          onClick={e => e.stopPropagation()}
          className='border-none bg-transparent p-0 cursor-pointer focus:outline-none'
        >
          {chip}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' onClick={e => e.stopPropagation()}>
        {!statuses && <DropdownMenuItem disabled>{t('Loading...')}</DropdownMenuItem>}
        {(statuses || []).map(status => (
          <DropdownMenuItem
            key={status.id}
            data-testid='task-status-option'
            onSelect={() => handleSelect(status)}
            className='flex items-center gap-2'
          >
            <span className={cn('w-2 h-2 rounded-full shrink-0', CATEGORY_DOT[status.category] || CATEGORY_DOT.active)} />
            <span className='flex-1'>{status.name}</span>
            {String(status.id) === String(placement.taskStatusId) && <Check className='w-3 h-3' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
