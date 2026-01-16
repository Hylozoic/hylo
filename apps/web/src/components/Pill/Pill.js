import isMobile from 'ismobilejs'
import { uniqueId } from 'lodash'
import React, { forwardRef, useState, useRef, useCallback } from 'react'
import { Tooltip } from 'react-tooltip'
import Icon from 'components/Icon'
import { cn } from 'util/index'

// Renders a pill-style label that can be removed or tapped for search while showing a tooltip.
const Pill = forwardRef(({
  id,
  label,
  onRemove,
  className,
  editable,
  darkText = false,
  onClick,
  tooltipContent = 'Click to Search'
}, ref) => {
  const [removing, setRemoving] = useState(false)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const longPressTimerRef = useRef(null)
  const skipNextClickRef = useRef(false)

  const deletePill = () => {
    if (editable && onRemove) {
      if (removing) {
        onRemove(id, label)
      } else {
        setRemoving(true)
      }
    }
  }
  const providedOnClick = onClick
    ? (e) => {
        e.stopPropagation()
        e.preventDefault()

        if (skipNextClickRef.current) {
          skipNextClickRef.current = false
          return
        }

        onClick(id, label)
      }
    : null
  const mouseOut = () => setRemoving(false)

  const tooltipId = uniqueId(`pill-label-${id}-`)

  // Handle long press for mobile devices
  const handleTouchStart = useCallback(() => {
    if (isMobile.any) {
      skipNextClickRef.current = false
      longPressTimerRef.current = setTimeout(() => {
        skipNextClickRef.current = true
        setIsTooltipOpen(true)
      }, 500) // 500ms long press threshold
    }
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (skipNextClickRef.current) {
      e.preventDefault()
    }
    // Keep tooltip open for a bit before hiding
    if (isTooltipOpen) {
      setTimeout(() => {
        setIsTooltipOpen(false)
      }, 2000) // Hide after 2 seconds
    }
  }, [isTooltipOpen])

  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    skipNextClickRef.current = false
    setIsTooltipOpen(false)
  }, [])

  const rootClassName = cn(
    'relative select-none mr-2 mb-2 text-foreground text-baseline bg-darkening/10 rounded-lg m-1 py-1 px-3 items-center justify-center inline-flex opacity-100 hover:opacity-100 scale-100 transition-all hover:cursor-pointer hover:bg-selected/50 z-0 hover:z-50 group',
    className,
    editable && 'cursor-pointer pr-6',
    removing && 'border border-destructive bg-destructive text-destructive-foreground hover:bg-destructive hover:border-destructive'
  )

  const iconClassName = cn(
    'absolute right-[5px] top-[5px] text-[16px] font-bold p-1 rounded-sm align-top transition-colors cursor-pointer',
    removing ? 'text-destructive bg-destructive hover:text-destructive hover:bg-destructive' : 'text-transparent group-hover:text-foreground'
  )

  return (
    <div
      className={rootClassName}
      onMouseLeave={mouseOut}
      ref={ref}
    >
      <span
        data-tooltip-html={tooltipContent}
        data-tooltip-id={tooltipId}
        className='text-inherit'
        onClick={providedOnClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {label}
      </span>
      {editable &&
        <Icon
          className={iconClassName}
          tooltipContent='Double click to delete'
          tooltipId={tooltipId}
          name='Trash'
          onClick={deletePill}
          dataTestId='pill-remove-icon'
        />}
      <Tooltip
        place='top'
        type='dark'
        id={tooltipId}
        effect='solid'
        disable={!editable}
        delayShow={isMobile.any ? 0 : 200}
        isOpen={isMobile.any ? isTooltipOpen : undefined}
        multiline
        style={{ zIndex: 1000 }}
      />
    </div>
  )
})

export default Pill
