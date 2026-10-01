import React, { useMemo } from 'react'
import GroupViewPresenter from '@hylo/presenters/GroupViewPresenter'
import GroupViewIcon from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewIcon'
import { DEFAULT_AVATAR } from 'store/models/Group'

/** Visual-only space/parent avatar stack used by a pinned-space nav destination. */
export default function PinnedSpace ({ space, parentGroup }) {
  const presentedSpace = useMemo(() => GroupViewPresenter({
    type: 'space',
    name: space.name,
    icon: space.icon,
    linkedGroup: space
  }), [space])

  const avatarItems = [space, parentGroup]

  return (
    <div
      className='relative w-10 h-10 shrink-0'
      data-testid={`pinned-space-stack-${space.id}`}
      aria-hidden='true'
    >
      {avatarItems.map((group, index) => {
        const hasAvatar = index === 0
          ? Boolean(
            group?.avatarUrl &&
            group.avatarUrl !== DEFAULT_AVATAR &&
            !group.avatarUrl.endsWith('/default-group-avatar.svg')
          )
          : Boolean(group?.avatarUrl)
        return (
          <div
            key={group?.id || index}
            className='absolute w-8 h-8 rounded-md bg-transparent bg-cover bg-center shadow-sm'
            style={{
              top: index * 8,
              left: index * 8,
              zIndex: avatarItems.length - index,
              backgroundImage: hasAvatar
                ? `url(${group.avatarUrl})`
                : 'linear-gradient(to bottom right, hsl(var(--focus) / 0.2), hsl(var(--selected) / 0.2))'
            }}
            data-testid={index === 0
              ? `pinned-space-space-avatar-${space.id}`
              : `pinned-space-parent-avatar-${space.id}`}
          />
        )
      })}
      <div
        className='absolute top-1 left-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-[hsl(0_0%_17%)] text-white shadow-md'
        data-testid={`pinned-space-icon-${space.id}`}
      >
        <GroupViewIcon view={presentedSpace} className='!m-0 !h-4 !w-4' />
      </div>
    </div>
  )
}
