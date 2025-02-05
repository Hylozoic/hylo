import PropTypes from 'prop-types'
import React from 'react'
import { cn } from 'util/index'
import classes from './component.module.scss'

const { string, bool } = PropTypes

export default function SkillLabel ({ children, label, color = 'dark', active, className }) {
  const labelClasses = cn(classes.label, classes[color], { [classes.active]: active })
  return (
    <div className={cn(labelClasses, className)}>
      {label || children}
    </div>
  )
}
SkillLabel.propTypes = {
  label: string,
  color: string,
  active: bool,
  className: string
}
