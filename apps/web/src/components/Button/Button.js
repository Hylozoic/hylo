import PropTypes from 'prop-types'
import React from 'react'
import { cn } from 'util/index'
import classes from './Button.module.scss'

const { string, bool, func, object, oneOfType, node } = PropTypes

export default function Button ({
  active,
  borderRadius = 'auto',
  children,
  className,
  color = 'green',
  dataTestId,
  dataTip,
  dataTipHtml,
  dataFor,
  disabled = false,
  hover,
  label,
  name,
  narrow,
  noDefaultStyles,
  onClick,
  small,
  tabIndex = 0
}) {
  const combinedClassName = cn(
    classes[color.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())],
    {
      [classes.button]: !noDefaultStyles,
      [classes.hover]: hover,
      [classes.active]: active,
      [classes.narrow]: narrow,
      [classes.small]: small,
      [classes.disabled]: disabled
    },
    className
  )

  return (
    <div
      role='button'
      tabIndex={tabIndex}
      className={combinedClassName}
      style={{ borderRadius }}
      onClick={!disabled ? onClick : undefined}
      data-tooltip-content={dataTip}
      data-tooltip-html={dataTipHtml}
      data-tooltip-id={dataFor}
      data-testid={dataTestId}
      aria-label={name || label}
    >
      {label || children}
    </div>
  )
}
Button.propTypes = {
  label: oneOfType([
    string,
    object
  ]),
  color: string,
  hover: bool,
  active: bool,
  narrow: bool,
  small: bool,
  children: node,
  noDefaultStyles: bool,
  onClick: func,
  disabled: bool,
  className: string
}
