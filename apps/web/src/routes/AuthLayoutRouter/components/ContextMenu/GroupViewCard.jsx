import React, { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, Boxes, ExternalLink, Info, Loader2, Pencil, Plus, Settings, Trash2, Users, X } from 'lucide-react'
import { localSpaceSlug, spaceUrl } from '@hylo/navigation'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'

import CurrentlyActiveMembers, { DEFAULT_ACTIVE_MAX } from 'components/CurrentlyActiveMembers'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import TruncatedText from 'components/TruncatedText'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import useAppearance from 'hooks/useAppearance'
import { DEFAULT_BANNER } from 'store/models/Group'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { collectionsWithoutSpace } from 'util/spaceCollection'
import { viewShowsUnreadDot, viewUnreadBadgeCount } from 'util/viewUnreadBadges'
import { bgImageStyle, cn } from 'util/index'

import CardIconField from './CardIconField'
import GroupViewIcon from './GroupViewIcon'
import { externalLinkHref, menuViewUrl } from './groupViewMenuUrl'
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
  CARD_TILE_CLASS,
  CARD_LABEL_TOP_CLASS,
  CARD_W,
  CARD_H
} from './viewCardTheme'

// cursor-pointer is explicit because the toolbar can sit inside a drag handle,
// where it would otherwise inherit the grab cursor.
const CARD_ACTION_BTN = 'p-1.5 rounded-md bg-background/90 text-foreground/60 hover:text-foreground pointer-events-auto cursor-pointer'

/**
 * Members count or Join pill in the upper-left of a space card.
 * Join matches the two-column menu row so non-members see the same invite.
 */
export function SpaceCardMembershipPill ({ isMember, memberCount, lightSurfaceLabels }) {
  const { t } = useTranslation()
  if (!(typeof memberCount === 'number' || !isMember)) return null

  return (
    <span
      className={cn(
        'absolute top-1.5 left-1.5 z-10 inline-flex items-center gap-0.5 text-xs leading-none rounded-full px-1.5 py-1',
        lightSurfaceLabels
          ? 'bg-black/10 text-foreground/60'
          : 'bg-black/30 text-white/90 backdrop-blur-sm'
      )}
      aria-label={isMember ? t('{{count}} Members', { count: memberCount }) : t('Join')}
    >
      {isMember
        ? (
          <>
            <Users className='w-3 h-3' aria-hidden='true' />
            {memberCount}
          </>
          )
        : <span className='uppercase text-[10px] font-semibold tracking-wide'>+ {t('Join')}</span>}
    </span>
  )
}

/** About shortcut — members only. Sits in the top-right cluster. */
export function SpaceCardAboutButton ({ onOpenAbout, space, lightSurfaceLabels }) {
  const { t } = useTranslation()
  if (!onOpenAbout) return null

  return (
    <button
      type='button'
      onClick={(e) => {
        e.stopPropagation()
        onOpenAbout(space)
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        'p-1 rounded-md backdrop-blur-sm transition-colors',
        lightSurfaceLabels
          ? 'text-foreground/50 hover:text-foreground bg-black/10 hover:bg-black/20'
          : 'text-white/70 hover:text-white bg-black/25 hover:bg-black/45'
      )}
      aria-label={t('About')}
      title={t('About')}
    >
      <Info className='w-4 h-4' />
    </button>
  )
}

/**
 * Top-right cluster: About (i), then a notification badge if present.
 * The badge keeps the outer corner; the (i) sits to its left.
 */
export function SpaceCardTopRight ({ about, badge }) {
  if (!about && !badge) return null

  return (
    <div className='absolute top-1.5 right-1.5 z-10 flex items-center gap-1'>
      {about}
      {badge}
    </div>
  )
}

/**
 * Edit-mode toolbar in the top-right of a card: +, gear, X (spaces), pencil, delete.
 * Stops pointerdown so that when the card itself is a drag handle, pressing a
 * button doesn't begin a drag instead of clicking.
 */
export function CardEditActions ({
  onAddToMenu,
  onOpenSettings,
  onHide,
  onEditMenu,
  onArchive,
  onDelete,
  addLabel,
  settingsLabel,
  hideLabel,
  editMenuLabel,
  archiveLabel,
  deleteLabel,
  collectionViews,
  onAddToCollection,
  addToCollectionLabel
}) {
  return (
    <div
      className='absolute top-2 right-2 z-10 flex items-center gap-1 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity pointer-events-none'
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
      {onAddToCollection && collectionViews?.length > 0 && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type='button'
                  onClick={(e) => e.stopPropagation()}
                  className={CARD_ACTION_BTN}
                  aria-label={addToCollectionLabel}
                >
                  <Boxes className='w-4 h-4' />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{addToCollectionLabel}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align='end' onClick={(e) => e.stopPropagation()}>
            {collectionViews.map(collectionView => (
              <DropdownMenuItem
                key={collectionView.id}
                onSelect={() => onAddToCollection(collectionView)}
              >
                {collectionView.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
      {onHide && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onHide()
              }}
              className={cn(CARD_ACTION_BTN, 'hover:text-destructive')}
              aria-label={hideLabel}
            >
              <X className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{hideLabel}</TooltipContent>
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
      {onArchive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onArchive()
              }}
              className={CARD_ACTION_BTN}
              aria-label={archiveLabel}
            >
              <Archive className='w-4 h-4' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{archiveLabel}</TooltipContent>
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
      <span className={cn(CARD_TILE_CLASS, 'grid place-items-center border-2 border-dashed border-foreground/25')}>
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

/** Card for a GroupView on the one-column grid, themed by its postType color. */
function GroupViewCard ({
  view,
  isEditing,
  onOpen,
  onOpenAbout,
  group = null,
  spaceGroup = null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const [hover, setHover] = useState(false)
  const presented = useMemo(() => GroupViewPresenter(view), [view])
  const title = displayNameForView(presented, t, { spaceGroup })
  const externalHref = externalLinkHref(presented)
  const col = viewCardColor(presented)
  const tint = cardFieldTint(col, effectiveColorScheme)
  const ink = inkOn(col)
  // Views backed by a group (spaces, groups, members) show that group's banner as
  // the card when one is set — even without a custom avatar — matching the
  // one-column grid; icon views keep the tinted gradient and wallpaper.
  const linkedGroup = presented.linkedGroup
  const linkedGroupBanner = linkedGroup?.bannerUrl && linkedGroup.bannerUrl !== DEFAULT_BANNER
    ? linkedGroup.bannerUrl
    : null
  const bgImageUrl = linkedGroupBanner || presented.avatarUrl || null
  const onPhoto = Boolean(bgImageUrl)
  const lightSurfaceLabels = !isDark && !onPhoto
  const eventStart = eventStartForView(presented)
  const isSpace = presented.type === 'space'
  const isWelcome = presented.type === 'welcome'
  const welcomeText = !isEditing && isWelcome && (presented.pageContent || group?.welcomePage)
    ? (presented.pageContent || group.welcomePage).replace(/<[^>]*>/g, '').trim()
    : null
  const hasExtraContent = Boolean(welcomeText)
  const liveSpaceGroup = useSelector(state =>
    isSpace && linkedGroup?.slug
      ? getGroupForSlug(state, linkedGroup.slug)
      : null
  )
  const showJoinRequestDot = isSpace && (
    (liveSpaceGroup?.openJoinRequestCount || linkedGroup?.openJoinRequestCount || 0) > 0
  )
  const chatBadgeCount = viewUnreadBadgeCount(presented)
  const showUnreadDot = viewShowsUnreadDot(presented)
  const myMemberships = useSelector(getMyMemberships)
  const isSpaceMember = Boolean(
    isSpace && linkedGroup &&
    myMemberships.some(m => String(m.group.id) === String(linkedGroup.id))
  )
  const spaceMemberCount = isSpace
    ? (liveSpaceGroup?.memberCount ?? linkedGroup?.memberCount ?? null)
    : null
  const isMembers = presented.type === 'members'
  const inviteGroup = spaceGroup || group
  const membersUrl = isMembers && group?.slug
    ? menuViewUrl(group.slug, presented, spaceGroup)
    : null

  const handleOpen = () => {
    if (isEditing) return
    if (externalHref) {
      window.open(externalHref, '_blank', 'noopener,noreferrer')
      return
    }
    onOpen?.(view)
  }

  const iconTile = (
    <div
      className={cn(CARD_TILE_CLASS, 'overflow-hidden grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]')}
      style={presented.avatarUrl
        ? { border: '1px solid hsl(0 0% 100% / 0.28)' }
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
  )

  const label = (
    <span className='inline-flex items-center justify-center gap-1 max-w-full'>
      <TruncatedText
        as='h3'
        className={cn(
          CARD_TITLE_CLASS,
          'w-fit min-w-0',
          lightSurfaceLabels ? 'text-foreground' : 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]'
        )}
        text={title}
      />
      {externalHref && (
        <ExternalLink
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            lightSurfaceLabels ? 'text-foreground/70' : 'text-white [filter:drop-shadow(0_1px_4px_rgba(0,0,0,0.7))]'
          )}
          aria-hidden='true'
        />
      )}
    </span>
  )

  const handleOpenAbout = () => {
    if (onOpenAbout && linkedGroup) {
      onOpenAbout(linkedGroup)
      return
    }
    if (!group?.slug || !linkedGroup?.slug) return
    const local = localSpaceSlug(group.slug, linkedGroup.slug)
    navigate(spaceUrl(group.slug, local, '/about'))
  }

  const spacePill = !isEditing && isSpace
    ? (
      <SpaceCardMembershipPill
        isMember={isSpaceMember}
        memberCount={spaceMemberCount}
        lightSurfaceLabels={lightSurfaceLabels}
      />
      )
    : null

  let cardBody
  if (hasExtraContent) {
    cardBody = (
      <div className='relative h-full flex flex-col p-2 sm:p-3'>
        <div className='flex-1 flex flex-col items-center justify-center gap-1.5 text-center'>
          {iconTile}
          {label}
        </div>
        <p className={cn(
          'm-0 px-1 text-xs line-clamp-2 leading-relaxed',
          lightSurfaceLabels ? 'text-foreground/70' : 'text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]'
        )}
        >{welcomeText}
        </p>
      </div>
    )
  } else if (isMembers) {
    cardBody = (
      <div className='relative h-full flex flex-col p-2 sm:p-3'>
        <div className='text-center shrink-0 pt-0.5'>
          {label}
        </div>
        <div
          className='flex-1 flex items-center min-w-0 mt-1'
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CurrentlyActiveMembers
            group={inviteGroup}
            max={DEFAULT_ACTIVE_MAX}
            membersUrl={isEditing ? undefined : membersUrl}
            profileGroupSlug={group?.slug}
            showInvite={false}
            stacked
            interactive={!isEditing}
            className='w-full'
          />
        </div>
      </div>
    )
  } else {
    cardBody = (
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          {iconTile}
        </div>
        <div className={cn(CARD_LABEL_TOP_CLASS, 'absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center text-center px-3')}>
          {label}
        </div>
      </div>
    )
  }

  return (
    <div
      // SortableViewsGrid owns the edit chrome and drag listeners. cursor is
      // inherited, but CARD_CLASS sets cursor-pointer here, so it has to be
      // handed back for the wrapper's grab/grabbing states to show over the card.
      className={cn(
        CARD_CLASS,
        cardChrome(isDark),
        isEditing && 'cursor-[inherit]',
        // The wrapper owns the footprint; fill it rather than sizing against a
        // parent that is sizing itself to this card.
        isEditing && CARD_FILL_CLASS
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
          handleOpen()
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
      {spacePill}
      {!isEditing && (
        <SpaceCardTopRight
          about={isSpace && isSpaceMember
            ? (
              <SpaceCardAboutButton
                onOpenAbout={handleOpenAbout}
                space={linkedGroup}
                lightSurfaceLabels={lightSurfaceLabels}
              />
              )
            : null}
          badge={chatBadgeCount != null
            ? (
              <span className='min-w-5 h-5 px-1 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center border-2 border-background'>
                {chatBadgeCount}
              </span>
              )
            : (showUnreadDot || showJoinRequestDot)
                ? <span className='w-3 h-3 rounded-full bg-orange-500 border-2 border-background' />
                : null}
        />
      )}
      {cardBody}
    </div>
  )
}

/** Card for an off-menu space: banner image + scrim with a frosted-glass tile. */
export function SpaceViewCard ({
  space,
  isEditing,
  isDeleting = false,
  onOpen,
  onOpenAbout,
  onAddToMenu,
  onOpenSettings,
  onDelete,
  onArchive,
  onHide,
  hideLabel,
  collectionViews,
  onAddToCollection
}) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const bgImageUrl = (space.bannerUrl && space.bannerUrl !== DEFAULT_BANNER ? space.bannerUrl : null) || space.avatarUrl || null
  const onLightSurface = !isDark && !bgImageUrl
  const liveSpaceGroup = useSelector(state => space?.slug ? getGroupForSlug(state, space.slug) : null)
  const myMemberships = useSelector(getMyMemberships)
  const isSpaceMember = Boolean(
    space && myMemberships.some(m => String(m.group.id) === String(space.id))
  )
  const spaceMemberCount = space?.memberCount ?? liveSpaceGroup?.memberCount ?? null
  const showJoinRequestDot = (
    (liveSpaceGroup?.openJoinRequestCount || space?.openJoinRequestCount || 0) > 0
  )

  return (
    <div
      className={cn(
        CARD_CLASS,
        cardChrome(isDark),
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
      {!isEditing && !isDeleting && (
        <SpaceCardMembershipPill
          isMember={isSpaceMember}
          memberCount={spaceMemberCount}
          lightSurfaceLabels={onLightSurface}
        />
      )}
      {!isEditing && !isDeleting && (
        <SpaceCardTopRight
          about={onOpenAbout && isSpaceMember
            ? (
              <SpaceCardAboutButton
                onOpenAbout={onOpenAbout}
                space={space}
                lightSurfaceLabels={onLightSurface}
              />
              )
            : null}
          badge={showJoinRequestDot
            ? <span className='w-3 h-3 rounded-full bg-orange-500 border-2 border-background' />
            : null}
        />
      )}
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className={cn(CARD_TILE_CLASS, 'overflow-hidden grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]', onLightSurface ? 'text-foreground/80' : 'text-white')}
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
        <div className={cn(CARD_LABEL_TOP_CLASS, 'absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center text-center px-3')}>
          <TruncatedText as='h3' className={cn(CARD_TITLE_CLASS, onLightSurface ? 'text-foreground' : 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]')} text={space.name} />
          {(space.isDraft || space.status === 'draft') && (
            <span className={cn('text-[10.5px] font-semibold mt-1', onLightSurface ? 'text-foreground/60' : 'text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]')}>{t('Draft')}</span>
          )}
          {space.status === 'archived' && (
            <span className={cn('text-[10.5px] font-semibold mt-1', onLightSurface ? 'text-foreground/60' : 'text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]')}>{t('Archived')}</span>
          )}
        </div>
      </div>
      {isDeleting && (
        <div className='absolute inset-0 z-20 grid place-items-center bg-background/40 rounded-[inherit]'>
          <Loader2 className='w-7 h-7 animate-spin text-foreground/70' aria-label={t('Deleting')} />
        </div>
      )}
      {isEditing && !isDeleting && (
        <CardEditActions
          onAddToMenu={onAddToMenu ? () => onAddToMenu(space) : null}
          onOpenSettings={onOpenSettings ? () => onOpenSettings(space) : null}
          onDelete={onDelete ? () => onDelete(space) : null}
          onArchive={onArchive ? () => onArchive(space) : null}
          onHide={onHide ? () => onHide(space) : null}
          hideLabel={hideLabel}
          collectionViews={collectionsWithoutSpace(collectionViews, space.id)}
          onAddToCollection={onAddToCollection ? (collectionView) => onAddToCollection(space, collectionView) : null}
          addToCollectionLabel={t('Add to Collection')}
          addLabel={t('Add to Menu')}
          settingsLabel={t('Settings')}
          archiveLabel={t('Archive')}
          deleteLabel={t('Delete Space')}
        />
      )}
    </div>
  )
}

// Memoised so reordering the grid re-renders only the cards that actually changed
export default React.memo(GroupViewCard)
