import React from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, LayoutGrid } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'

import { AddCard } from './GroupViewCard'

/**
 * The single Add slot in a card grid, and the menu it opens. Anchored to the
 * card rather than thrown up as a modal — adding a view is a small choice, not
 * something worth taking over the screen for.
 *
 * Each option carries a line explaining what it is, because the view/space
 * distinction is the part people get wrong.
 */
export default function AddViewOrSpaceMenu ({ onChooseView, onChooseSpace, canAddSpace = true }) {
  const { t } = useTranslation()

  const options = [
    {
      key: 'view',
      Icon: LayoutGrid,
      title: t('Add View'),
      description: t('A view is a lens on your group\'s content — a stream of posts, a filtered list, a link, or another way of surfacing what you want members to see.'),
      onChoose: onChooseView
    },
    canAddSpace && {
      key: 'space',
      Icon: Layers,
      title: t('Add Space'),
      description: t('A space is a part of your group with its own members and content — a working group, a cohort, a resource library, or anywhere that membership and focus matter.'),
      onChoose: onChooseSpace
    }
  ].filter(Boolean)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AddCard label={t('Add')} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='start'
        className='w-[320px] max-w-[calc(100vw-2rem)] p-1'
      >
        {options.map(({ key, Icon, title, description, onChoose }) => (
          <DropdownMenuItem
            key={key}
            onSelect={onChoose}
            className='flex items-start gap-2.5 p-2.5 cursor-pointer'
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
