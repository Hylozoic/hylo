import React, { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Info, Loader2, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'

import LucideIcon from 'components/LucideIcon/LucideIcon'
import TruncatedText from 'components/TruncatedText'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import useAppearance from 'hooks/useAppearance'
import { DEFAULT_BANNER } from 'store/models/Group'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { bgImageStyle, cn } from 'util/index'

import CardIconField from './CardIconField'
import GroupViewIcon from './GroupViewIcon'
import {
  viewCardColor,
  eventStartForView,
  inkOn,
  cardGradient,
  cardFieldTint,
  cardHoverRing,
  cardRestRing,
  cardNeutralBg,
  cardFadeGradient,
  cardChrome,
  cardHoverShadow,
  cardRestShadow,
  CARD_CLASS,
  CARD_FADE_CLASS,
  CARD_FILL_CLASS,
  CARD_TITLE_CLASS,
  CARD_W,
  CARD_H
} from './viewCardTheme'

// cursor-pointer is explicit because the toolbar can sit inside a drag handle,
// where it would otherwise inherit the grab cursor.
const CARD_ACTION_BTN = 'p-1.5 rounded-md bg-background/90 text-foreground/60 hover:text-foreground pointer-events-auto cursor-pointer'

/**
 * Edit-mode toolbar in the top-right of a card: +, gear, pencil (spaces), delete.
 * Stops pointerdown so that when the card itself is a drag handle, pressing a
 * button doesn't begin a drag instead of clicking.
 */
export function CardEditActions ({ onAddToMenu, onOpenSettings, onEditMenu, onDelete, addLabel, settingsLabel, editMenuLabel, deleteLabel }) {
  return (
    <div
      className='absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'
      onPointerDown={(e) => e.stopPropagation()}
    >
      {onAddToMenu && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onAddToMenu()
              }}
              className={CARD_ACTION_BTN}
              aria-label={addLabel}
            >
              <Plus className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{addLabel}</TooltipContent>
        </Tooltip>
      )}
      {onOpenSettings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onOpenSettings()
              }}
              className={CARD_ACTION_BTN}
              aria-label={settingsLabel}
            >
              <Settings className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{settingsLabel}</TooltipContent>
        </Tooltip>
      )}
      {onEditMenu && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onEditMenu()
              }}
              className={CARD_ACTION_BTN}
              aria-label={editMenuLabel}
            >
              <Pencil className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{editMenuLabel}</TooltipContent>
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className={cn(CARD_ACTION_BTN, 'text-destructive hover:text-destructive')}
              aria-label={deleteLabel}
            >
              <Trash2 className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          {/* Red label rather than a red surface — TooltipArrow is fixed to
              fill-popover, so a recoloured background would leave the arrow behind. */}
          <TooltipContent className='text-destructive font-semibold'>{deleteLabel}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

/**
 * Card-shaped add affordance, sized from CARD_CLASS so it sits in a card grid as
 * one more tile. Dashed and unfilled so it reads as a slot rather than a view.
 *
 * Forwards its ref and spreads the rest so it can be a Radix `asChild` trigger.
 */
export const AddCard = React.forwardRef(function AddCard ({ onClick, label, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type='button'
      onClick={onClick}
      className={cn(
        CARD_CLASS,
        'border-2 border-dashed border-foreground/[0.12] hover:border-foreground/30 bg-transparent shadow-none hover:shadow-none items-center justify-center gap-2 text-foreground/50 hover:text-foreground/80',
        className
      )}
      {...props}
    >
      {/* The tile keeps its weight so the target still reads while the card outline recedes */}
      <span className='w-14 h-14 rounded-[15px] grid place-items-center border-2 border-dashed border-foreground/25'>
        <Plus className='w-6 h-6' />
      </span>
      <span className={cn(CARD_TITLE_CLASS, 'px-3')}>{label}</span>
    </button>
  )
})

/** Event post cards replace the tile icon with a month / date / day / time stack. */
export function EventDateStack ({ start }) {
  return (
    <span className='flex flex-col items-center justify-center text-white leading-none'>
      {/* leading-none per line: text-lg's own line-height otherwise inflates
          the stack past the 56px tile and clips the bottom row */}
      <span className='text-[9px] leading-none font-bold uppercase tracking-wide'>{start.toFormat('MMM')}</span>
      <span className='text-xl leading-none font-bold mt-px'>{start.toFormat('d')}</span>
      <span className='text-[9px] leading-none font-bold uppercase mt-px'>{start.toFormat('ccc')}</span>
    </span>
  )
}

/** Card for a GroupView, themed by its postType color. */
function GroupViewCard ({ view, isEditing, onAddToMenu, onOpen, onOpenSettings, onDelete, renderEditActions = true }) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const [hover, setHover] = useState(false)
  const presented = useMemo(() => GroupViewPresenter(view), [view])
  const title = displayNameForView(presented, t)
  const col = viewCardColor(presented)
  const tint = cardFieldTint(col, effectiveColorScheme)
  const ink = inkOn(col)
  // Views backed by a group (spaces, groups, members) show that group's banner as
  // the card when one is set — even without a custom avatar — matching the
  // one-column grid; icon views keep the tinted gradient and wallpaper.
  const linkedGroupBanner = presented.linkedGroup?.bannerUrl && presented.linkedGroup.bannerUrl !== DEFAULT_BANNER
    ? presented.linkedGroup.bannerUrl
    : null
  const bgImageUrl = linkedGroupBanner || presented.avatarUrl || null
  const onPhoto = Boolean(bgImageUrl)
  const eventStart = eventStartForView(presented)
  const liveSpaceGroup = useSelector(state =>
    presented.type === 'space' && presented.linkedGroup?.slug
      ? getGroupForSlug(state, presented.linkedGroup.slug)
      : null
  )
  const showJoinRequestDot = presented.type === 'space' && (
    (liveSpaceGroup?.openJoinRequestCount || presented.linkedGroup?.openJoinRequestCount || 0) > 0
  )

  const handleOpen = () => {
    if (isEditing) return
    onOpen?.(view)
  }

  return (
    <div
      // renderEditActions false means a wrapper owns the edit chrome and the drag
      // listeners. cursor is an inherited property, but CARD_CLASS sets
      // cursor-pointer here, and the cursor comes from the element under the
      // pointer — so it has to be handed back explicitly for the wrapper's
      // grab/grabbing states to show over the card.
      className={cn(
        CARD_CLASS,
        cardChrome(isDark),
        // Editing means the card is a thing you pick up — grab, and grabbing while held.
        // The sortable wrapper case inherits so dnd-kit's isDragging cursor wins.
        isEditing && (renderEditActions ? 'cursor-grab active:cursor-grabbing' : 'cursor-[inherit]'),
        // The wrapper owns the footprint in that case; fill it rather than sizing
        // against a parent that is sizing itself to this card.
        !renderEditActions && CARD_FILL_CLASS
      )}
      style={{
        background: onPhoto ? cardNeutralBg(effectiveColorScheme) : cardGradient(col, effectiveColorScheme),
        // Light mode: border takes the view color — faint at rest, full on hover.
        // Photo-backed cards read better with a soft white edge than a dark hairline.
        ...(!isDark
          ? onPhoto
            ? { borderColor: `hsl(0 0% 100% / ${hover && !isEditing ? 0.55 : 0.25})` }
            : { borderColor: hover && !isEditing ? col : `${col}33` }
          : {}),
        boxShadow: hover && !isEditing
          ? `${cardHoverShadow(isDark)}, ${onPhoto ? cardRestRing(col) : cardHoverRing(col)}`
          : `${cardRestShadow(isDark)}, ${cardRestRing(col)}`
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? undefined : 0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (isEditing) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(view)
        }
      }}
    >
      {onPhoto
        ? (
          <>
            <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
            <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
          </>
          )
        : (
          <>
            <CardIconField view={presented} tint={tint} w={CARD_W} h={CARD_H} />
            <div className={CARD_FADE_CLASS} style={{ background: cardFadeGradient(effectiveColorScheme) }} />
          </>
          )}
      {showJoinRequestDot && !isEditing && (
        <span className='absolute -top-1.5 -right-1.5 z-10 w-3 h-3 rounded-full bg-orange-500 border-2 border-background' />
      )}
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className='w-14 h-14 rounded-[15px] overflow-hidden grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
            style={presented.avatarUrl
              ? { border: '1px solid hsl(0 0% 100% / 0.28)' }
              // Frosted glass over a banner photo, matching the one-column grid tile
              : onPhoto
                ? { background: 'hsl(0 0% 100% / 0.16)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid hsl(0 0% 100% / 0.28)' }
                : { background: col, color: ink, border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
          >
            {/* An avatar fills the tile — RoundImage hard-codes its own small size,
                so it can't be scaled up through GroupViewIcon's className. */}
            {presented.avatarUrl
              ? <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(presented.avatarUrl)} />
              : eventStart
                ? <EventDateStack start={eventStart} />
                : (
                  <span className='flex items-center justify-center w-[26px] h-[26px] [&>svg]:!w-full [&>svg]:!h-full [&>img]:!w-full [&>img]:!h-full [&>span]:!text-[26px] [&>span]:!leading-none'>
                    <GroupViewIcon view={presented} className='!w-[26px] !h-[26px] !mr-0' />
                  </span>
                  )}
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <TruncatedText
            as='h3'
            className={cn(
              CARD_TITLE_CLASS,
              (isDark || onPhoto) ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground'
            )}
            text={title}
          />
        </div>
      </div>
      {/* A sortable wrapper renders the toolbar itself, outside the drag listeners */}
      {isEditing && renderEditActions && (
        <CardEditActions
          onAddToMenu={onAddToMenu ? () => onAddToMenu(view) : null}
          onOpenSettings={onOpenSettings ? () => onOpenSettings(view) : null}
          onDelete={onDelete ? () => onDelete(view) : null}
          addLabel={t('Add to Menu')}
          settingsLabel={t('Settings')}
          deleteLabel={t('Delete')}
        />
      )}
    </div>
  )
}

/** Card for an off-menu space: banner image + scrim with a frosted-glass tile. */
export function SpaceViewCard ({ space, isEditing, isDeleting = false, onOpen, onOpenAbout, onAddToMenu, onOpenSettings, onDelete }) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const bgImageUrl = (space.bannerUrl && space.bannerUrl !== DEFAULT_BANNER ? space.bannerUrl : null) || space.avatarUrl || null
  const onLightSurface = !isDark && !bgImageUrl
  const liveSpaceGroup = useSelector(state => space?.slug ? getGroupForSlug(state, space.slug) : null)
  const showJoinRequestDot = (
    (liveSpaceGroup?.openJoinRequestCount || space?.openJoinRequestCount || 0) > 0
  )

  return (
    <div
      className={cn(
        CARD_CLASS,
        cardChrome(isDark),
        isEditing && 'cursor-grab active:cursor-grabbing',
        isDeleting && 'pointer-events-none opacity-50'
      )}
      style={{
        background: cardNeutralBg(effectiveColorScheme),
        // Photo-backed cards read better with a soft white edge than a dark hairline
        ...(!isDark && bgImageUrl ? { borderColor: 'hsl(0 0% 100% / 0.25)' } : {})
      }}
      aria-busy={isDeleting || undefined}
      role={isEditing || isDeleting ? undefined : 'button'}
      tabIndex={isEditing || isDeleting ? undefined : 0}
      onClick={() => {
        if (isEditing || isDeleting) return
        onOpen?.(space)
      }}
      onKeyDown={(e) => {
        if (isEditing || isDeleting) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(space)
        }
      }}
    >
      {bgImageUrl && (
        <>
          <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
          <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
        </>
      )}
      {showJoinRequestDot && !isEditing && !isDeleting && (
        <span className='absolute -top-1.5 -right-1.5 z-10 w-3 h-3 rounded-full bg-orange-500 border-2 border-background' />
      )}
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className={cn('w-14 h-14 rounded-[15px] overflow-hidden grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]', onLightSurface ? 'text-foreground/80' : 'text-white')}
            style={space.avatarUrl
              ? { border: '1px solid hsl(0 0% 100% / 0.28)' }
              : onLightSurface
                ? { background: 'hsl(0 0% 0% / 0.06)', border: '1px solid hsl(0 0% 0% / 0.15)' }
                : { background: 'hsl(0 0% 100% / 0.16)', backdropFilter: 'blur(4px)', border: '1px solid hsl(0 0% 100% / 0.28)' }}
          >
            {/* The avatar fills the tile rather than floating inside it */}
            {space.avatarUrl
              ? <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(space.avatarUrl)} />
              : space.icon
                ? <LucideIcon name={space.icon} className='w-7 h-7' />
                : <div className={cn('w-7 h-7 rounded-full', onLightSurface ? 'bg-black/15' : 'bg-white/20')} />}
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <TruncatedText as='h3' className={cn(CARD_TITLE_CLASS, onLightSurface ? 'text-foreground' : 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]')} text={space.name} />
          {space.isDraft && (
            <span className={cn('text-[10.5px] font-semibold mt-1', onLightSurface ? 'text-foreground/60' : 'text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]')}>{t('Draft')}</span>
          )}
        </div>
      </div>
      {isDeleting && (
        <div className='absolute inset-0 z-20 grid place-items-center bg-background/40 rounded-[inherit]'>
          <Loader2 className='w-7 h-7 animate-spin text-foreground/70' aria-label={t('Deleting')} />
        </div>
      )}
      {/* Reachable without opening the space — the card is otherwise the only way in,
          and a space's description is exactly what you want before deciding to enter.
          Hidden while editing so it can't collide with the edit toolbar, and while
          deleting so it can't sit under the spinner. */}
      {onOpenAbout && !isEditing && !isDeleting && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onOpenAbout(space)
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className='absolute top-2 right-2 z-10 p-1 rounded-md text-white/70 hover:text-white bg-black/25 hover:bg-black/45 backdrop-blur-sm transition-colors'
          aria-label={t('About')}
          title={t('About')}
        >
          <Info className='w-4 h-4' />
        </button>
      )}
      {isEditing && !isDeleting && (
        <CardEditActions
          onAddToMenu={onAddToMenu ? () => onAddToMenu(space) : null}
          onOpenSettings={onOpenSettings ? () => onOpenSettings(space) : null}
          onDelete={onDelete ? () => onDelete(space) : null}
          addLabel={t('Add to Menu')}
          settingsLabel={t('Settings')}
          deleteLabel={t('Delete Space')}
        />
      )}
    </div>
  )
}

// Memoised so reordering the grid re-renders only the cards that actually changed
export default React.memo(GroupViewCard)
