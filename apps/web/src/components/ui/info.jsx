import React, { useState } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'
import { cn } from 'util/index'

export default function InfoButton ({ className, content }) {
  const [isTooltipVisible, setTooltipVisible] = useState(false)

  const handleMouseEnter = () => {
    setTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setTooltipVisible(false)
  }

  const handleToggleTooltip = () => {
    setTooltipVisible(!isTooltipVisible)
  }

  return (
    <Tooltip open={isTooltipVisible}>
      <TooltipTrigger
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleToggleTooltip}
      >
        <Info className={cn('w-4 h-4 inline-block', className)} />
      </TooltipTrigger>
      <TooltipContent>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
