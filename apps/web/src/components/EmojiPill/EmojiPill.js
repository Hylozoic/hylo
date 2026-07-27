import React from 'react'
import { cn } from 'util/index'
import Pill from 'components/Pill'

export default function EmojiPill ({ emojiFull, onClick = () => {}, count, userList, selected, toolTip, className }) {
  return (
    <div data-tooltip-content={toolTip} data-tooltip-id={`${emojiFull}-emoji`}>
      <Pill
        darkText
        id={emojiFull}
        key={emojiFull}
        label={
          <span className='inline-flex items-center gap-1'>
            <span className='text-[1.25em] leading-none'>{emojiFull}</span>
            <span>{count}</span>
          </span>
        }
        onClick={onClick ? () => onClick(emojiFull) : null}
        className={cn('mb-1', {
          'bg-selected text-foreground': selected
        }, className)}
        tooltipContent={toolTip}
      />
    </div>
  )
}
