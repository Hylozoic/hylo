import { cn } from 'util/index'
import PropTypes from 'prop-types'
import React from 'react'

import Icon from 'components/Icon'

const { bool, string, func } = PropTypes

export default function CheckBox ({ checked, onChange, className, label, labelClass, labelLeft = false, noInput, disabled = false }) {
  const iconName = checked ? 'Checkmark' : 'Empty'

  return (
    <label className={cn('cursor-pointer mb-0 align-middle', labelClass)}>
      {labelLeft && label}
      <Icon name={iconName} className={cn('align-middle pr-2 text-selected border-primary-foreground/80', { 'pl-2': labelLeft, 'text-primary-foreground/50': !checked })} dataTestId={`icon-${iconName}`} />
      {!noInput &&
        <input
          type='checkbox'
          className={cn('hidden w-0', className)}
          checked={!!checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
        />}
      {!labelLeft && label}
    </label>
  )
}

CheckBox.propTypes = {
  checked: bool,
  className: string,
  disabled: bool,
  label: string,
  labelLeft: bool,
  onChange: func,
  noInput: bool
}
