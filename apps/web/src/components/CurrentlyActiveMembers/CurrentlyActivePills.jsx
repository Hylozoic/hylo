import React from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { bgImageStyle, cn, isRecentlyActive } from 'util/index'

/** Chat strip and the members page preview. */
export const DEFAULT_ACTIVE_MAX = 5
/** Sidebar / one-column menu strip — a bit more room than chat. */
export const MENU_ACTIVE_MAX = 8

/**
 * Overlapping avatar strip for currently-active members. Newest on the left.
 * A green dot marks anyone live in the room (presenceMap, chat only) or active
 * within the recently-active window. The typing pulse replaces the dot.
 */
export default function CurrentlyActivePills ({
  members = [],
  max,
  onPersonClick,
  typingIds = [],
  presenceMap = {},
  interactive = true
}) {
  const { t } = useTranslation()
  const now = Date.now()
  const shown = max != null ? members.slice(0, max) : members
  if (shown.length === 0) return null

  return (
    <div className='flex items-center shrink-0'>
      {shown.map((person, i) => {
        const typing = typingIds.includes(String(person.id))
        const present = Boolean(presenceMap[String(person.id)]) || isRecentlyActive(person, now)
        const label = typing ? `${person.name} ${t('is typing...')}` : person.name
        const z = typing ? shown.length + 2 : shown.length - i
        return (
          <Tooltip key={person.id}>
            <TooltipTrigger asChild>
              <button
                type='button'
                disabled={!interactive}
                onClick={(e) => {
                  e.stopPropagation()
                  interactive && onPersonClick?.(person)
                }}
                className={cn(
                  'relative block transition-all',
                  interactive && 'hover:scale-110 hover:!z-20',
                  !interactive && 'cursor-inherit',
                  i > 0 && '-ml-2'
                )}
                style={{ zIndex: z }}
                aria-label={label}
              >
                <span
                  className='block w-[30px] h-[30px] rounded-full bg-cover bg-center bg-midground border-2 border-background'
                  style={person.avatarUrl ? bgImageStyle(person.avatarUrl) : undefined}
                />
                {typing
                  ? (
                    <span className='absolute -bottom-1 -right-0.5 inline-flex items-center gap-[3px] px-[5px] py-[3px] rounded-md bg-background' aria-hidden='true'>
                      {[0, 1, 2].map(d => (
                        <span key={d} className='w-[5px] h-[5px] rounded-full bg-foreground animate-typing-dot' style={{ animationDelay: `${d * 160}ms` }} />
                      ))}
                    </span>
                    )
                  : present
                    ? (
                      <span className='absolute bottom-0 -right-px w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background' aria-hidden='true' />
                      )
                    : null}
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
