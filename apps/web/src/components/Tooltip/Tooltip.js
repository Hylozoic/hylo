import { cn } from 'util/index'
import React from 'react'
import { Tooltip as ReactTooltip } from 'react-tooltip'

const Tooltip = (props) => {
  const { id, className, delay, position, place, content } = props
  return (
    <ReactTooltip
      id={id}
      content={content}
      delayShow={delay || 500}
      className={cn('p-2 rounded-md text-xs z-50', className)}
      place={place || position}
    />
  )
}

export default Tooltip
