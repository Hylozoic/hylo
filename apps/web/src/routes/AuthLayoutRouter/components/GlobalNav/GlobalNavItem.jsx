import React, { useState, useCallback, useMemo, useEffect } from 'react'
import Badge from 'components/Badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from 'components/ui/tooltip'
import { useLocation, useNavigate } from 'react-router-dom'
import { DEFAULT_AVATAR } from 'store/models/Group'
import { cn } from 'util/index'

/**
 * GlobalNavItem component renders a navigation item with tooltip and hover animations
 * @param {ReactNode} children - Content to render inside the nav item
 * @param {string} className - Additional CSS classes
 * @param {number} badgeCount - Number to show in badge (if > 0)
 * @param {string} img - URL of image to show as background
 * @param {string} tooltip - Text to show in tooltip
 * @param {string} url - URL to navigate to when clicked
 * @param {boolean} showTooltip - Whether parent is triggering tooltip cascade
 * @param {number} index - Position in nav list for staggered animations
 */
export default function GlobalNavItem ({
  children,
  className,
  badgeCount = 0,
  img,
  tooltip,
  url,
  showTooltip: parentShowTooltip,
  index = 0
}) {
  const navigate = useNavigate()
  const selected = useLocation().pathname.startsWith(url)
  const [isHovered, setIsHovered] = useState(false)
  const [open, setOpen] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  /**
   * Handles tooltip visibility and animation states
   * - Immediate show on direct hover
   * - Staggered show when parent triggers cascade
   * - Hide when neither condition is true
   */
  useEffect(() => {
    if (isHovered) {
      setOpen(true)
      setShouldAnimate(true)
    } else if (parentShowTooltip) {
      const timer = setTimeout(() => {
        setOpen(true)
        setShouldAnimate(true)
      }, 300 + (index * 100))
      return () => clearTimeout(timer)
    } else {
      setOpen(false)
      setShouldAnimate(false)
    }
  }, [parentShowTooltip, isHovered, index])

  const handleClick = useCallback(() => {
    if (url) {
      navigate(url)
    }
  }, [url, navigate])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  const style = useMemo(() => {
    if (!img) return {}
    return {
      backgroundImage: `url(${img})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }, [img])

  return (
    <Tooltip open={open}>
      <div className='GlobalNavItem mb-4 z-10 relative'>
        <TooltipTrigger asChild>
          <div
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'bg-primary relative transition-all ease-in-out duration-250',
              'flex flex-col items-center justify-center w-14 h-14 min-h-10',
              'rounded-lg drop-shadow-md opacity-60 hover:opacity-100',
              'scale-90 hover:scale-125 hover:drop-shadow-lg hover:my-1 text-3xl',
              {
                'border-3 border-secondary opacity-100 scale-100 hover:scale-110': selected,
                'border-3 border-accent opacity-100 scale-100': badgeCount > 0
              },
              className
            )}
            style={style}
            role='button'
          >
            {children}
            {img === DEFAULT_AVATAR && <span className='GlobalNavItemDefaultAvatarText text-center text-foreground text-2xl drop-shadow-md'>{tooltip?.split(' ').slice(0, 2).map(word => word[0]?.toUpperCase()).join('')}</span>}
            {badgeCount > 0 && <Badge number={badgeCount} className='absolute -top-2 -left-2' expanded />}
          </div>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent
            side='right'
            className={cn(
              'transition-all duration-300 ease-out transform',
              {
                'opacity-60 translate-x-0 scale-80': parentShowTooltip && !isHovered && shouldAnimate,
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
}
