import isMobile from 'ismobilejs'
import { uniqueId } from 'lodash'
import React, { forwardRef, useState } from 'react'
import { Tooltip } from 'react-tooltip'
import Icon from 'components/Icon'
import classes from './Pill.module.scss'
import { cn } from 'util/index'

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
  const deletePill = () => {
    if (editable && onRemove) {
      if (removing) {
        onRemove(id, label)
      } else {
        setRemoving(true)
      }
    }
  }
  const providedOnClick = onClick ? (e) => { e.stopPropagation(); e.preventDefault(); onClick(id, label) } : null
  const mouseOut = () => setRemoving(false)

  const tooltipId = uniqueId(`pill-label-${id}-`)

  return (
    <div
      className={cn(
        'text-foreground text-baseline bg-black/10 rounded-lg inline-block m-1 py-2 px-3 h-[40px] items-center justify-center flex opacity-100 hover:opacity-100 scale-100 hover:scale-105 transition-all hover:cursor-pointer hover:bg-selected/50 z-0 hover:z-50',
        className
      )}
      onMouseLeave={mouseOut}
      ref={ref}
    >
      <span
        data-tooltip-html={tooltipContent}
        data-tooltip-id={tooltipId}
        className={classes.displayLabel}
        onClick={providedOnClick}
      >
        {label}
      </span>
      {editable &&
        <Icon
          className={classes.removeLabel}
          tooltipContent='Double click to delete'
          tooltipId={tooltipId}
          name='Ex'
          onClick={deletePill}
          dataTestId='pill-remove-icon'
        />}
      {!isMobile.any && (
        <Tooltip
          place='top'
          type='dark'
          id={tooltipId}
          effect='solid'
          disable={!editable}
          delayShow={200}
          multiline
          style={{ zIndex: 1000 }}
        />
      )}
    </div>
  )
})

export default Pill
