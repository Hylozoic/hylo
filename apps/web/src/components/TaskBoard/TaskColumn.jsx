import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Check, MoreHorizontal, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { cn } from 'util/index'
import TaskCard from './TaskCard'

/** Dot colour for each status category (literal class names so Tailwind's scanner picks them up). */
const CATEGORY_DOT = {
  todo: 'bg-foreground/40',
  active: 'bg-focus',
  done: 'bg-selected'
}

const CATEGORY_OPTIONS = [
  ['todo', 'Not started'],
  ['active', 'In progress'],
  ['done', 'Done']
]

/** Prefix for a column's droppable id, so it can't collide with a task id. */
export const COLUMN_DROP_PREFIX = 'column-'

/** The column's name; people who manage the board can rename it in place. */
function ColumnTitle ({ column, editing, setEditing, canManage, onRename }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(column.name)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editing) return
    setValue(column.name)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing, column.name])

  const commit = () => {
    const name = value.trim()
    if (name && name !== column.name) onRename(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-testid='task-column-name-input'
        value={value}
        maxLength={80}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        className='flex-1 min-w-0 h-6 px-1.5 rounded border border-selected bg-background text-sm font-bold text-foreground outline-none'
      />
    )
  }

  return (
    <span
      data-testid='task-column-name'
      onDoubleClick={canManage ? () => setEditing(true) : undefined}
      title={canManage ? t('Double-click to rename') : undefined}
      className={cn('text-sm font-bold text-foreground truncate', canManage && 'cursor-text')}
    >
      {column.name}
    </span>
  )
}

/** "Add task" at the foot of a column: a title and Enter is all it takes. */
function AddTaskInline ({ onAdd }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const submit = async () => {
    const value = title.trim()
    if (!value || saving) return
    setSaving(true)
    try {
      await onAdd(value)
      setTitle('')
    } finally {
      setSaving(false)
      inputRef.current?.focus()
    }
  }

  if (!open) {
    return (
      <button
        type='button'
        data-testid='task-column-add'
        onClick={() => setOpen(true)}
        className='flex items-center gap-1.5 w-full h-8 px-2 rounded-md border-none bg-transparent text-xs font-bold text-foreground/60 hover:text-foreground hover:bg-foreground/10 cursor-pointer'
      >
        <Plus className='w-3.5 h-3.5' />{t('Add task')}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      data-testid='task-column-add-input'
      value={title}
      disabled={saving}
      placeholder={t('What needs doing?')}
      onChange={e => setTitle(e.target.value)}
      onBlur={() => { if (!title.trim()) setOpen(false) }}
      onKeyDown={e => {
        if (e.key === 'Enter') submit()
        if (e.key === 'Escape') { setTitle(''); setOpen(false) }
      }}
      className='w-full h-9 px-2 rounded-md border border-selected bg-background text-sm text-foreground outline-none placeholder:text-foreground/40'
    />
  )
}

/** One column of the board: header, droppable list of cards, and the add-task row. */
export default function TaskColumn ({
  column,
  canManage,
  canDelete,
  canChangeCategory,
  canAdd,
  onRename,
  onSetCategory,
  onDelete,
  onAddTask,
  onOpenTask,
  onToggleDone
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_DROP_PREFIX + column.id })
  const isDone = column.category === 'done'
  const hiddenCount = Math.max(0, (column.tasksTotal || 0) - column.tasks.length)

  return (
    <div
      data-testid='task-column'
      data-column-name={column.name}
      className='flex flex-col w-[272px] shrink-0 max-h-full rounded-xl bg-foreground/5 border border-foreground/10'
    >
      <div className='flex items-center gap-2 px-3 pt-2.5 pb-2'>
        <span className={cn('w-2 h-2 rounded-full shrink-0', CATEGORY_DOT[column.category] || CATEGORY_DOT.active)} />
        <ColumnTitle column={column} editing={editing} setEditing={setEditing} canManage={canManage} onRename={onRename} />
        <span data-testid='task-column-count' className='text-xs font-bold text-foreground/50'>{column.tasksTotal ?? column.tasks.length}</span>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                data-testid='task-column-menu'
                aria-label={t('Column options')}
                className='ml-auto w-6 h-6 grid place-items-center rounded border-none bg-transparent text-foreground/60 hover:bg-foreground/10 cursor-pointer'
              >
                <MoreHorizontal className='w-4 h-4' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem data-testid='task-column-rename' onSelect={() => setTimeout(() => setEditing(true), 0)}>{t('Rename')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className='text-xs text-foreground/60'>{t('Tasks in this column are')}</DropdownMenuLabel>
              {CATEGORY_OPTIONS.map(([category, label]) => (
                <DropdownMenuItem
                  key={category}
                  disabled={!canChangeCategory && category !== column.category}
                  onSelect={() => { if (category !== column.category) onSetCategory(category) }}
                  className='flex items-center gap-2'
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', CATEGORY_DOT[category])} />
                  <span className='flex-1'>{t(label)}</span>
                  {category === column.category && <Check className='w-3 h-3' />}
                </DropdownMenuItem>
              ))}
              {isDone && (
                <div className='px-2 pb-1 text-[11px] text-foreground/50 max-w-[220px]'>
                  {t('Tasks moved here count as completed.')}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid='task-column-delete' disabled={!canDelete} onSelect={onDelete} className='text-destructive'>
                {t('Delete column')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn('flex flex-col gap-2 px-2 pb-2 min-h-[48px] overflow-y-auto rounded-b-xl transition-colors', isOver && 'bg-selected/10')}
      >
        <SortableContext items={column.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isDone={isDone}
              onOpen={() => onOpenTask(task)}
              onToggleDone={() => onToggleDone(task)}
            />
          ))}
        </SortableContext>
        {hiddenCount > 0 && (
          <div className='text-xs text-foreground/50 text-center py-1'>{t('{{count}} more not shown', { count: hiddenCount })}</div>
        )}
        {canAdd && <AddTaskInline onAdd={onAddTask} />}
      </div>
    </div>
  )
}
