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
import { baseUrl } from '@hylo/navigation'

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
  img,
  tooltip,
  url,
  showTooltip: parentShowTooltip,
  index = 0,
  isPinned = false,
  childGroups = []
}) {
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const hasChildren = childGroups && childGroups.length > 0
  // A stack is selected when its parent group is active OR when one of its stacked subgroups is the active group.
  const selected = baseUrl({ context: routeParams.context, groupSlug: routeParams.groupSlug }) === url ||
    (hasChildren && childGroups.some(child => child.slug === routeParams.groupSlug))
  const [isHovered, setIsHovered] = useState(false)
  const [open, setOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const itemRef = useRef(null)
  const suppressHoverRef = useRef(false)
  const [isInViewport, setIsInViewport] = useState(true)
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
   */
  useEffect(() => {
    if (isHovered) {
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
  }, [parentShowTooltip, isHovered, index, isInViewport])

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
        'rounded-lg opacity-60 hover:opacity-100',
        'scale-90 hover:scale-100 text-3xl',
        // Stacks read like the TopNav tabs: no tile background or shadow, just the layered avatars.
        !hasChildren && 'bg-primary drop-shadow-md hover:drop-shadow-lg',
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
                className='absolute w-[32px] h-[32px] rounded-md bg-cover bg-center bg-primary border-2 border-primary shadow-sm'
                style={{
                  top: i * 8,
                  left: i * 8,
                  zIndex: stackItems.length - i,
                  backgroundImage: `url(${item.avatarUrl})`
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
              'transition-all duration-100 ease-out transform',
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
            {tooltip}
          </TooltipContent>
        )}
      </div>
    </Tooltip>
  )

  if (!hasChildren) return content

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      {content}
      <PopoverContent side='right' align='start' className='w-56 p-1 z-[110]'>
        <div
          onClick={handleNavigateTo(url)}
          className='flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 transition-colors font-medium'
        >
          <div className='w-5 h-5 rounded-sm bg-cover bg-center bg-primary shrink-0' style={{ backgroundImage: `url(${img})` }} />
          <span className='truncate text-sm'>{tooltip}</span>
        </div>
        {childGroups.map(child => (
          <div
            key={child.id}
            onClick={handleNavigateTo(`/groups/${child.slug}`)}
            className='flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 transition-colors'
          >
            <div className='w-[18px] h-[18px] rounded-sm bg-cover bg-center bg-primary shrink-0' style={{ backgroundImage: `url(${child.avatarUrl})` }} />
            <span className='truncate text-sm text-foreground/70'>{child.name}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
