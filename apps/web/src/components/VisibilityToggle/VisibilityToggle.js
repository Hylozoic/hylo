import React from 'react'
import { cn } from 'util/index'
import classes from './VisibilityToggle.module.scss'
import Icon from 'components/Icon'

function VisibilityToggle ({
  id,
  onChange = () => {},
  checked = false,
  disabled = false,
  backgroundColor,
  name
}) {
  const handleToggle = () => {
    onChange({ id, isVisible: checked, name })
  }
  return (
    <div className={cn(classes.container, { [classes.containerDisabled]: disabled, [classes.visible]: checked })} onClick={disabled ? null : handleToggle}>
      <input type='hidden' name={name} defaultChecked={checked} />
      <span className={classes.track} />
      <span className={cn(classes.button, { [classes.buttonChecked]: checked })} />
      <Icon name='Eye' className={classes.visibleIcon} />
      <Icon name='Hidden' className={classes.hiddenIcon} />
    </div>
  )
}

export default VisibilityToggle
