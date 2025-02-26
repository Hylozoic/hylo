import React from 'react'
import { cn } from 'util/index'
import Pill from 'components/Pill'

import classes from './EmojiPill.module.scss'

export default function EmojiPill ({ emojiFull, onClick = () => {}, count, userList, selected, toolTip }) {
  console.log('Classes:', {
    tagPill: classes.tagPill,
    selected: classes.selected,
    selectedProp: selected,
    finalClassName: cn(classes.tagPill, { [classes.selected]: selected })
  })
  return (
    <div data-tooltip-content={toolTip}>
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
