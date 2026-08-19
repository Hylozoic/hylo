import React from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, LayoutGrid, Plus } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { cn } from 'util/index'

import { AddCard } from './GroupViewCard'

/**
 * Trigger for list contexts (the drill-down menu) rather than card grids —
 * keeps the dashed add affordance that menu already used, now as one control
 * instead of a separate button per kind.
 */
export const AddViewOrSpaceButton = React.forwardRef(({ className, ...props }, ref) => {
  const { t } = useTranslation()
  return (
    <button
      ref={ref}
      type='button'
      className={cn(
        'flex items-center gap-2 w-full text-base text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 rounded-md p-2 pl-2 mb-2 transition-all opacity-85 hover:opacity-100',
        className
      )}
      {...props}
    >
      <Plus className='w-4 h-4' />
      <span>{t('Add')}</span>
    </button>
  )
})
AddViewOrSpaceButton.displayName = 'AddViewOrSpaceButton'

/**
 * The single Add slot in a card grid, and the menu it opens. Anchored to the
 * card rather than thrown up as a modal — adding a view is a small choice, not
 * something worth taking over the screen for.
 *
 * Each option carries a line explaining what it is, because the view/space
 * distinction is the part people get wrong.
 */
export default function AddViewOrSpaceMenu ({ onChooseView, onChooseSpace, canAddSpace = true, trigger }) {
  const { t } = useTranslation()

  const options = [
    onChooseView && {
      key: 'view',
      Icon: LayoutGrid,
      title: t('Add View'),
      description: t('Show your group\'s content - activity streams, curated lists, links and other ways to surface what should be seen.'),
      onChoose: onChooseView
    },
    canAddSpace && onChooseSpace && {
      key: 'space',
      Icon: Layers,
      title: t('Add Space'),
      description: t('A distinct space with its own members and content - chats, working groups, cohorts, resource libraries, teams'),
      onChoose: onChooseSpace
    }
  ].filter(Boolean)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {trigger || <AddCard label={t('Add')} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        // Above the trigger: the Add control sits at the foot of these menus, so a
        // downward menu lands under the editing bar or off the bottom of the screen
        side='top'
        align='start'
        // The mobile drawer is z-[101]; default menu content is z-50 and opens
        // behind it. modal={false} keeps the same tap from dismissing instantly.
        className={cn(
          'z-[200] max-w-[calc(100vw-2rem)] p-1',
          // In the drill-down menu the trigger is a full-width row, so the menu
          // matches it rather than jutting out past the control that opened it.
          // The card-grid trigger is card-sized, where a fixed width reads better.
          trigger ? 'w-[var(--radix-dropdown-menu-trigger-width)]' : 'w-[320px]'
        )}
      >
        {options.map(({ key, Icon, title, description, onChoose }) => (
          <DropdownMenuItem
            key={key}
            onSelect={onChoose}
            // Same hover wash as the global + create menu's rows
            className='flex items-start gap-2.5 p-2.5 cursor-pointer rounded-lg focus:bg-foreground/10 focus:text-foreground'
          >
            <Icon className='w-4 h-4 shrink-0 mt-0.5 text-foreground/70' />
            <span className='flex flex-col gap-0.5 min-w-0'>
              <span className='text-sm font-semibold text-foreground'>{title}</span>
              <span className='text-xs text-foreground/70 leading-snug whitespace-normal'>{description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
