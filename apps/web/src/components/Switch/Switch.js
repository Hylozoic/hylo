import React from 'react'
import { cn } from 'util/index'
import classes from './Switch.module.scss'

export default function Switch ({
  value,
  onClick,
  className
}) {
  return (
    <div className={cn(className, classes.switchContainer)} onClick={onClick}>
      <div className={classes.circleGray1} />
      <div className={classes.connectGray} />
      <div className={classes.circleGray2} />
      <div className={cn(classes[value ? 'switchOn' : 'switchOff'])} />
    </div>
  )
}
