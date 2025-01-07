import { cn } from 'util/index'
import React from 'react'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import classes from './Tooltip.module.scss'

const Tooltip = (props) => {
  const { id, className, delay, position, content } = props
  return (
    <ReactTooltip
      id={id}
      content={content}
      delayShow={delay || 500}
      className={cn(classes.tooltip, className)}
      place={position}
    />
  )
}

export default Tooltip
