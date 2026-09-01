import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import Badge from 'components/Badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from 'components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import { useNavigate } from 'react-router-dom'
import useRouteParams from 'hooks/useRouteParams'
import { DEFAULT_AVATAR } from 'store/models/Group'
import { cn } from 'util/index'
import { baseUrl, myHomeLandingUrl, isMyHomeContext } from '@hylo/navigation'

/**
 * GlobalNavItem component renders a navigation item with tooltip and hover animations
 * @param {ReactNode} children - Content to render inside the nav item
 * @param {string} className - Additional CSS classes
 * @param {string} badgeCount - Number to show in badge (if > 0)
 * @param {string} img - URL of image to show as background
 * @param {string} tooltip - Text to show in tooltip
 * @param {string} url - URL to navigate to when clicked
 * @param {boolean} showTooltip - Whether parent is triggering tooltip cascade
 * @param {number} index - Position in nav list for staggered animations
 * @param {Array} childGroups - Subgroups; when present the item shows a stack of avatars and opens a dropdown on click
 */
export default function GlobalNavItem ({
  children,
  className,
  badgeCount = 0,
  // System buttons (create, notifications, messages, commons) keep the dark-mode
  // tile in both schemes — the light tiles read as too loud on the rail
  darkTile = false,
  img,
  tooltip,
  url,
  showTooltip: parentShowTooltip,
  index = 0,
  isPinned = false,
  childGroups = [],
  dataTour
}) {
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const hasChildren = childGroups && childGroups.length > 0
  // A stack is selected when its parent group is active OR when one of its stacked subgroups is the active group.
  const selected = url === myHomeLandingUrl()
    ? isMyHomeContext(routeParams.context)
    : (
        baseUrl({ context: routeParams.context, groupSlug: routeParams.groupSlug }) === url ||
        (hasChildren && childGroups.some(child => child.slug === routeParams.groupSlug))
      )
  const [isHovered, setIsHovered] = useState(false)
  const [open, setOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const itemRef = useRef(null)
  const suppressHoverRef = useRef(false)
  const [isInViewport, setIsInViewport] = useState(true)
  const [anySubmenuOpen, setAnySubmenuOpen] = useState(false)
  const hasShownInSessionRef = useRef(false)

  /**
   * Checks if the tooltip would appear below the maximum allowed Y position
   */
  const checkPosition = useCallback(() => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect()
      const maxAllowedY = window.innerHeight * 0.85 // 85% of viewport height
      setIsInViewport(rect.top < maxAllowedY && rect.bottom > 0)
    }
  }, [])

  /**
   * Handles tooltip visibility and animation states
   * - Immediate show on direct hover
   * - Staggered show when parent first triggers cascade
   * - Immediate restore if already shown in this hover session
   *   (prevents stagger timer reset when scrolling toggles isInViewport)
   * - Hide when neither condition is true
   *
   * Direct hover is suppressed while any stack's submenu is open. GlobalNav
   * already withholds the cascade then, but a direct hover ignored that and put
   * a single label over the submenu — the submenu is a deliberate, click-driven
   * state, so an ambient hover affordance yields to it rather than the reverse.
   */
  useEffect(() => {
    if (isHovered && !anySubmenuOpen) {
      setOpen(true)
      setShouldAnimate(true)
      hasShownInSessionRef.current = true
    } else if (parentShowTooltip && isInViewport) {
      if (hasShownInSessionRef.current) {
        // Already shown in this cascade — restore immediately (no re-stagger)
        setOpen(true)
        setShouldAnimate(true)
      } else {
        const timer = setTimeout(() => {
          setOpen(true)
          setShouldAnimate(true)
          hasShownInSessionRef.current = true
        }, 300 + (index * 100))
        return () => clearTimeout(timer)
      }
    } else if (!parentShowTooltip) {
      setOpen(false)
      setShouldAnimate(false)
      hasShownInSessionRef.current = false
    } else {
      // parentShowTooltip is true but item is out of viewport
      setOpen(false)
    }
  }, [parentShowTooltip, isHovered, index, isInViewport, anySubmenuOpen])

  // Listen for the custom navScroll event from parent
  useEffect(() => {
    window.addEventListener('navScroll', checkPosition)
    window.addEventListener('resize', checkPosition)

    // Initial position check
    checkPosition()

    return () => {
      window.removeEventListener('navScroll', checkPosition)
      window.removeEventListener('resize', checkPosition)
    }
  }, [checkPosition])

  // Tell GlobalNav when this stack's submenu opens or closes, so the rail can put
  // its labels away and leave the screen to the submenu.
  useEffect(() => {
    if (!hasChildren) return
    window.dispatchEvent(new CustomEvent('navSubmenuToggle', { detail: popoverOpen }))
  }, [popoverOpen, hasChildren])

  // Scrolling the rail behind an open submenu dismisses it. Radix focuses the
  // content on open, which can itself nudge a scroll, so ignore the first moment.
  useEffect(() => {
    if (!popoverOpen) return
    let settled = false
    const settleTimer = setTimeout(() => { settled = true }, 300)
    const handleClose = () => {
      if (settled) setPopoverOpen(false)
    }
    window.addEventListener('navSubmenuClose', handleClose)
    return () => {
      clearTimeout(settleTimer)
      window.removeEventListener('navSubmenuClose', handleClose)
    }
  }, [popoverOpen])

  // Any stack's submenu being open silences this item's own hover label. Read from
  // the event GlobalNav already broadcasts rather than threading a prop through
  // every call site.
  useEffect(() => {
    const handleSubmenuToggle = (e) => setAnySubmenuOpen(Boolean(e.detail))
    window.addEventListener('navSubmenuToggle', handleSubmenuToggle)
    return () => window.removeEventListener('navSubmenuToggle', handleSubmenuToggle)
  }, [])

  // Listen for hover suppression from GlobalNav (fired when nav opens on mobile)
  // Blocks ALL hover events regardless of pointerType during the grace period
  useEffect(() => {
    const handleSuppress = (e) => {
      suppressHoverRef.current = e.detail
      if (e.detail) setIsHovered(false)
    }
    window.addEventListener('navHoverSuppress', handleSuppress)
    return () => window.removeEventListener('navHoverSuppress', handleSuppress)
  }, [])

  // Reset local hover state when parent stops showing tooltips
  // This prevents "sticky" tooltips on mobile where mouseleave doesn't fire reliably
  useEffect(() => {
    if (!parentShowTooltip) {
      setIsHovered(false)
    }
  }, [parentShowTooltip])

  const handleClick = useCallback(() => {
    setIsHovered(false)
    // Groups with subgroups open a dropdown (handled by the Popover) instead of navigating.
    if (hasChildren) return
    if (url) {
      navigate(url)
    }
  }, [url, navigate, hasChildren])

  const handleNavigateTo = useCallback((to) => () => {
    setIsHovered(false)
    setPopoverOpen(false)
    navigate(to)
  }, [navigate])

  const handlePointerEnter = useCallback((e) => {
    // Ignore touch-originated pointer events and suppress during nav open grace period
    if (e.pointerType === 'touch' || suppressHoverRef.current) return
    setIsHovered(true)
  }, [])

  const handlePointerLeave = useCallback((e) => {
    if (e.pointerType === 'touch') return
    setIsHovered(false)
  }, [])

  const isDefaultAvatar = img === DEFAULT_AVATAR

  const style = useMemo(() => {
    // When showing a stack of subgroups, the avatars render as layered children
    // rather than as the tile's background image.
    if (hasChildren || !img || isDefaultAvatar) return {}
    return {
      backgroundImage: `url(${img})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }, [img, isDefaultAvatar, hasChildren])

  // Parent first, then up to two subgroups, layered into the tile to read as a stack.
  const stackItems = hasChildren
    ? [{ avatarUrl: img, name: tooltip }, ...childGroups].slice(0, 3)
    : []

  const tile = (
    <div
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={cn(
        'relative transition-all ease-in-out duration-250 overflow-visible',
        'flex flex-col items-center justify-center w-14 h-14 min-h-10',
        // Resting icons sat far enough back to read as disabled rather than merely
        // unselected; selection is carried by the ring and scale, not by dimming.
        'rounded-lg opacity-85 hover:opacity-100',
        'scale-90 hover:scale-100 text-3xl',
        // Stacks read like the TopNav tabs: no tile background or shadow, just the layered avatars.
        !hasChildren && cn('drop-shadow-md hover:drop-shadow-lg', darkTile ? 'bg-[hsl(0_0%_17%)] text-white' : 'bg-primary'),
        {
          'border-3 border-selected opacity-100 scale-110 hover:scale-110': selected,
          'border-3 border-accent opacity-100 scale-100 hover:scale-105': badgeCount > 0 || badgeCount === '!' || badgeCount === '-',
          'bg-darkening': isDefaultAvatar && !hasChildren
        },
        className
      )}
      style={{
        ...style,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        msUserSelect: 'none'
      }}
      role='button'
      data-tour={dataTour}
    >
      {hasChildren
        ? (
          <div
            className='relative'
            style={{ width: 32 + (stackItems.length - 1) * 8, height: 32 + (stackItems.length - 1) * 8 }}
          >
            {stackItems.map((item, i) => (
              <div
                key={i}
                className='absolute w-[32px] h-[32px] rounded-md bg-cover bg-center bg-primary'
                style={{
                  top: i * 8,
                  left: i * 8,
                  zIndex: stackItems.length - i,
                  backgroundImage: `url(${item.avatarUrl})`,
                  // Layers separate by shadow rather than an outline (the old border read
                  // as white on light themes). Each tile's shadow falls on the one behind
                  // it, and deeper tiles carry more of it so the stack reads as depth.
                  boxShadow: `0 ${1 + i}px ${4 + i * 2}px rgba(0,0,0,${Math.min(0.5, 0.3 + i * 0.07)})`
                }}
              />
            ))}
          </div>
          )
        : (
          <>
            {isDefaultAvatar && (
              <div
                className='absolute inset-0 opacity-80 rounded-md overflow-hidden'
                style={{
                  background: 'linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))'
                }}
              />
            )}
            {children}
            {isDefaultAvatar && <span className='GlobalNavItemDefaultAvatarText relative z-10 text-center text-white text-2xl drop-shadow-md'>{tooltip?.split(' ').slice(0, 2).map(word => word[0]?.toUpperCase()).join('')}</span>}
          </>
          )}
      {badgeCount > 0 && <Badge number={badgeCount} className='absolute -top-3 -left-3' expanded />}
      {badgeCount === '-' && <Badge number='-' className='absolute -top-3 -left-3 scale-[70%]' expanded />}
    </div>
  )

  const content = (
    <Tooltip open={open}>
      <div className='GlobalNavItem mb-4 z-10 relative' ref={itemRef}>
        <TooltipTrigger asChild>
          {hasChildren ? <PopoverTrigger asChild>{tile}</PopoverTrigger> : tile}
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent
            side='right'
            className={cn(
              // font-semibold matches the context menu's row labels. Set here rather
              // than on the shared TooltipContent so other tooltips are unaffected.
              'font-semibold transition-all duration-100 ease-out transform',
              {
                'opacity-80 translate-x-0 scale-80': parentShowTooltip && !isHovered && shouldAnimate,
                'opacity-100 translate-x-0 scale-110': isHovered,
                'opacity-0 -translate-x-2': !shouldAnimate
              }
            )}
            style={{
              // Only apply transition delay for parent hover cascade
              transitionDelay: !isHovered && parentShowTooltip ? `${index * 100}ms` : '0ms',
              // Ensure tooltip doesn't appear too low
              maxHeight: 'calc(85vh)',
              bottom: 'auto'
            }}
          >
            <span className='flex items-center gap-1.5'>
              <span>{tooltip}</span>
              {/* A stack's label says how many groups are folded into it */}
              {hasChildren && (
                <span className='rounded-full bg-foreground/10 px-1.5 text-xs font-semibold text-foreground/70 leading-5'>
                  +{childGroups.length}
                </span>
              )}
            </span>
          </TooltipContent>
        )}
      </div>
    </Tooltip>
  )

  if (!hasChildren) return content

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      {content}
      {/* Reads as the rail continuing outward rather than a panel laid over it:
          no surface of its own, group tiles at rail size, and names on the same
          pills the rail uses for its hover labels. */}
      {/* A group with many children runs past the fold, so the list is bounded by
          the space Radix reports it has and scrolls within it. overflow-x is hidden
          rather than visible because a scrolling box cannot have one axis visible —
          pr-6 leaves the hover-scaled labels room so they aren't clipped. */}
      {/* Width matches the ContextMenu next door so the submenu never reaches
          further across the screen than the panel it stands in for. */}
      {/* Radix portals this, but React still bubbles its events up the component
          tree to the rail's touch handlers — which would read a scroll in here as a
          tap on the rail and pop the labels open. Stop them at the boundary. */}
      <PopoverContent
        side='right'
        align='start'
        arrow={false}
        collisionPadding={12}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        className='w-auto max-w-[260px] sm:max-w-[300px] bg-transparent border-none shadow-none p-0 pl-1 pr-6 z-[110] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overflow-x-hidden overscroll-contain'
      >
        <div className='flex flex-col gap-2 py-1'>
          {[{ id: 'parent', name: tooltip, avatarUrl: img, to: url }, ...childGroups.map(child => ({
            id: child.id,
            name: child.name,
            avatarUrl: child.avatarUrl,
            to: `/groups/${child.slug}`
          }))].map(item => (
            <div
              key={item.id}
              onClick={handleNavigateTo(item.to)}
              className='flex items-center gap-2 cursor-pointer group/stacked min-w-0'
              role='button'
              tabIndex={0}
            >
              {/* Tile and label both grow on hover, and on the same 100ms ease-out
                  the rail uses — hovering here should feel like hovering the rail.
                  The label grows from its left edge so it opens away from the tile. */}
              <div
                className='w-14 h-14 shrink-0 rounded-lg bg-cover bg-center bg-primary drop-shadow-md scale-90 group-hover/stacked:scale-100 transition-all duration-100 ease-out'
                style={{ backgroundImage: `url(${item.avatarUrl})` }}
              />
              {/* min-w-0 lets the label shrink inside the flex row so truncate has
                  something to act on — without it the pill would push past the cap. */}
              <span className='rounded-md bg-popover text-popover-foreground shadow-md px-3 py-1.5 text-sm font-semibold min-w-0 truncate origin-left transition-all duration-100 ease-out transform group-hover/stacked:scale-110'>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
