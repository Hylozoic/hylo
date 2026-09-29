import React from 'react'
import { Pin } from 'lucide-react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { pinGroup, unpinGroup } from 'store/actions/pinGroup'
import { cn } from 'util/index'

/** Pin or unpin a space membership in the user's global navigation. */
export default function SpaceGlobalNavPinButton ({ membership, className }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()

  if (!membership) return null

  const isPinned = membership.navOrder != null
  const label = t(isPinned ? 'Unpin space from global navigation' : 'Pin space to global navigation')

  return (
    <button
      type='button'
      onClick={() => dispatch(isPinned ? unpinGroup(membership.group.id) : pinGroup(membership.group.id))}
      aria-label={label}
      aria-pressed={isPinned}
      title={label}
      data-testid='space-global-nav-pin'
      className={cn('shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-selected focus-visible:ring-offset-2', className)}
    >
      <Pin className={cn('w-4 h-4', isPinned && 'fill-current')} />
    </button>
  )
}
