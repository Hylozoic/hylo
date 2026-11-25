import React from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'

import { INPUT_CLASS } from 'components/ui/form-field'
import { cn } from 'util/index'

/** The columns a new project's board starts with. They can all be changed on the board later. */
export const DEFAULT_PROJECT_COLUMNS = [
  { key: 'todo', name: 'To do', category: 'todo' },
  { key: 'active', name: 'In progress', category: 'active' },
  { key: 'review', name: 'Ready for review', category: 'active' },
  { key: 'done', name: 'Complete', category: 'done' }
]

export const MAX_PROJECT_COLUMNS = 12

const CATEGORY_OPTIONS = [
  { value: 'todo', labelKey: 'Not started' },
  { value: 'active', labelKey: 'In progress' },
  { value: 'done', labelKey: 'Done' }
]

const CATEGORY_DOT = {
  todo: 'bg-foreground/40',
  active: 'bg-accent',
  done: 'bg-selected'
}

/** Translated starting columns, each with a stable key for the editor's rows. */
export function defaultProjectColumns (t) {
  return DEFAULT_PROJECT_COLUMNS.map(column => ({ ...column, name: t(column.name) }))
}

/** The columns to send when creating the space: named ones only, in order. */
export function projectColumnsForCreate (columns) {
  return columns
    .map(column => ({ name: column.name.trim(), category: column.category }))
    .filter(column => column.name)
}

/** True when the list can make a board: at least one named column that counts as done. */
export function projectColumnsValid (columns) {
  return projectColumnsForCreate(columns).some(column => column.category === 'done')
}

/** Starting-columns editor shown when creating a Project space. */
/**
 * A project space is a space whose home view is Tasks (Q-78): the backend takes the home
 * from the first view, so Tasks always goes first, even if the menu was reordered or Tasks removed.
 */
export function projectSpaceViewTypes (viewTypes) {
  return ['tasks', ...(viewTypes || []).filter(type => type !== 'tasks')]
}

export default function ProjectColumnsFields ({ columns, onChange }) {
  const { t } = useTranslation()
  const doneCount = columns.filter(column => column.category === 'done').length

  const update = (key, changes) =>
    onChange(columns.map(column => column.key === key ? { ...column, ...changes } : column))

  const remove = key => onChange(columns.filter(column => column.key !== key))

  /** New columns go in front of the first done column, where work in progress belongs. */
  const add = () => {
    const column = { key: `column-${Date.now()}`, name: '', category: 'active' }
    const firstDone = columns.findIndex(c => c.category === 'done')
    const at = firstDone < 0 ? columns.length : firstDone
    onChange([...columns.slice(0, at), column, ...columns.slice(at)])
  }

  return (
    <div className='flex flex-col gap-2 border-t-2 border-foreground/10 pt-3 mt-1' data-testid='project-columns'>
      <div>
        <h3 className='text-base font-semibold m-0'>{t('Board columns')}</h3>
        <p className='text-xs text-foreground/60 mt-0.5 mb-0'>
          {t('Each column is a status a task can have. You can rename, add and remove columns on the board later.')}
        </p>
      </div>

      {columns.map(column => {
        const isLastDone = column.category === 'done' && doneCount === 1
        return (
          <div key={column.key} className='flex items-center gap-2' data-testid='project-column-row'>
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', CATEGORY_DOT[column.category])} />
            <input
              type='text'
              data-testid='project-column-name'
              className={cn(INPUT_CLASS, 'flex-1 min-w-0')}
              value={column.name}
              maxLength={80}
              placeholder={t('Column name')}
              onChange={event => update(column.key, { name: event.target.value })}
            />
            <select
              data-testid='project-column-category'
              aria-label={t('Counts as')}
              className={cn(INPUT_CLASS, 'w-auto shrink-0')}
              value={column.category}
              disabled={isLastDone}
              onChange={event => update(column.key, { category: event.target.value })}
            >
              {CATEGORY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>
            <button
              type='button'
              data-testid='project-column-remove'
              aria-label={t('Remove column')}
              disabled={isLastDone || columns.length === 1}
              onClick={() => remove(column.key)}
              className='shrink-0 p-1 rounded-md border-none bg-transparent text-foreground/60 hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-default'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        )
      })}

      {columns.length < MAX_PROJECT_COLUMNS && (
        <button
          type='button'
          data-testid='project-column-add'
          onClick={add}
          className='self-start flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-foreground/30 bg-transparent text-sm font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/60 cursor-pointer'
        >
          <Plus className='w-4 h-4' />{t('Add column')}
        </button>
      )}
    </div>
  )
}
