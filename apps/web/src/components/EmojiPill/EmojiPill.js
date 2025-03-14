import React from 'react'
import { cn } from 'util/index'
import Pill from 'components/Pill'

import classes from './EmojiPill.module.scss'

export default function EmojiPill ({ emojiFull, onClick = () => {}, count, userList, selected, toolTip }) {
  return (
    <div data-tooltip-content={toolTip} data-tooltip-id={`${emojiFull}-emoji`}>
      <Pill
        darkText
        id={emojiFull}
        key={emojiFull}
        label={`${emojiFull} ${count}`}
        onClick={onClick ? () => onClick(emojiFull) : null}
        className={cn(classes.tagPill, {
          'bg-selected': selected
        })}
        tooltipContent={toolTip}
      />
    </div>
  )
}
