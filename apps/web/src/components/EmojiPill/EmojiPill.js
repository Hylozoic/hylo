import React from 'react'
import { cn } from 'util/index'
import Pill from 'components/Pill'

export default function EmojiPill ({ emojiFull, onClick = () => {}, count, userList, selected, toolTip }) {
  return (
    <div data-tooltip-content={toolTip} data-tooltip-id={`${emojiFull}-emoji`}>
      <Pill
        darkText
        id={emojiFull}
        key={emojiFull}
        label={`${emojiFull} ${count}`}
        onClick={onClick ? () => onClick(emojiFull) : null}
        className={cn('mb-1', {
          'bg-selected text-foreground': selected
        })}
        tooltipContent={toolTip}
      />
    </div>
  )
}
