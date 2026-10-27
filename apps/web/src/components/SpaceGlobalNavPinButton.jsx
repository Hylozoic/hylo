import React from 'react'
import { Pin, PinOff } from 'lucide-react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { pinGroup, unpinGroup } from 'store/actions/pinGroup'
import { cn } from 'util/index'

/** Pins or unpins a space membership in the user's global navigation. Lives at the bottom of the space's About page. */
export default function SpaceGlobalNavPinButton ({ membership, className }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()

  if (!membership) return null

  const isPinned = membership.navOrder != null
  const label = isPinned ? t('Unpin space from global navigation') : t('Pin space to global navigation')
  const PinIcon = isPinned ? PinOff : Pin

  return (
    <Button
      type='button'
      variant='outline'
      onClick={() => dispatch(isPinned ? unpinGroup(membership.group.id) : pinGroup(membership.group.id))}
      aria-pressed={isPinned}
      data-testid='space-global-nav-pin'
      className={cn('flex items-center gap-2 h-auto max-w-full min-w-0 whitespace-normal', className)}
    >
      <PinIcon className='w-4 h-4 shrink-0' />
      <span className='text-left break-words'>{label}</span>
    </Button>
  )
}
