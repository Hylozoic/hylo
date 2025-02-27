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
import { cx } from 'class-variance-authority'

// Add this at the top of your file
// This ensures the tooltip portal has a constrained height
const setupTooltipContainer = () => {
  useEffect(() => {
    // Function to find and modify the tooltip provider
    const modifyTooltipContainer = () => {
      // Look for the tooltip portal - this might need adjustment based on your DOM
      const tooltipPortals = document.querySelectorAll('[data-radix-portal]');
      
      tooltipPortals.forEach(portal => {
        // Set max height to end above the plus button
        // Adjust the value (85vh) as needed to position above the plus button
        portal.style.maxHeight = 'calc(85vh)';
        portal.style.overflow = 'hidden';
        
        // Add a bottom margin to ensure tooltips don't go too low
        const tooltips = portal.querySelectorAll('[role="tooltip"]');
        tooltips.forEach(tooltip => {
          tooltip.style.maxHeight = 'calc(85vh)';
          // Add a constraint to prevent tooltips from appearing too low
          tooltip.style.bottom = 'auto';
        });
      });
    };

    // Run immediately and also set up a mutation observer to catch dynamically added tooltips
    modifyTooltipContainer();
    
    // Create a mutation observer to watch for new tooltip portals
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          modifyTooltipContainer();
        }
      }
    });
    
    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      observer.disconnect();
    };
  }, []);
};

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
  
  // Setup tooltip container once
  setupTooltipContainer();

  useEffect(() => {
    if (isHovered) {
      // Immediate display for hovered item
      setOpen(true)
      setShouldAnimate(true)
    } else if (parentShowTooltip) {
      // Delayed cascade for parent hover
      const timer = setTimeout(() => {
        setOpen(true)
        setShouldAnimate(true)
      }, 300 + (index * 100)) // 300ms initial delay + 100ms per item

      return () => {
        clearTimeout(timer)
      }
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

// Add this component to your file
export function GlobalNavTooltipContainer({ children }) {
  return (
    <div className='relative h-full'>
      <div className='absolute inset-0 overflow-hidden'>
        {children}
      </div>
      <div className='absolute bottom-0 left-0 right-0 h-32 pointer-events-none' 
           style={{
             background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,1) 100%)'
           }} 
      />
    </div>
  );
}
