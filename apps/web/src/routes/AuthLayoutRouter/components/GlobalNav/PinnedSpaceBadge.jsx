import React, { useMemo } from 'react'
import { Shapes } from 'lucide-react'
import GroupViewPresenter from '@hylo/presenters/GroupViewPresenter'
import GroupViewIcon from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewIcon'

/**
 * Corner badge for a pinned space in the global nav. The nav item itself shows
 * the parent group's avatar full-frame; this small tile in its bottom-right
 * corner says which space it opens: the space's custom avatar, else its icon,
 * else the default space glyph (the one the space's About banner uses).
 */
export default function PinnedSpaceBadge ({ space }) {
  const presentedSpace = useMemo(() => GroupViewPresenter({
    type: 'space',
    name: space.name,
    icon: space.icon,
    linkedGroup: space
  }), [space])
  const hasIcon = Boolean(presentedSpace.lucideIcon || presentedSpace.iconName)

  return (
    <div
      className='grid place-items-center w-6 h-6 rounded-md overflow-hidden bg-[hsl(0_0%_17%)] text-white shadow-md border-2 border-background'
      data-testid={`pinned-space-badge-${space.id}`}
      aria-hidden='true'
    >
      {presentedSpace.avatarUrl
        ? (
          <div
            className='w-full h-full bg-cover bg-center'
            style={{ backgroundImage: `url(${presentedSpace.avatarUrl})` }}
            data-testid={`pinned-space-avatar-${space.id}`}
          />
          )
        : hasIcon
          ? <GroupViewIcon view={presentedSpace} className='!m-0 !h-3.5 !w-3.5 shrink-0 text-sm leading-none' />
          : <Shapes className='h-3.5 w-3.5 shrink-0' data-testid={`pinned-space-default-icon-${space.id}`} />}
    </div>
  )
}
