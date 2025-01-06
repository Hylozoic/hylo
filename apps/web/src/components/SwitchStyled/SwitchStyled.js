import React from 'react'
import { cn } from 'util/index'
import classes from './SwitchStyled.module.scss'

function SwitchStyled ({
  onChange = (checked, name) => { },
  checked = false,
  disabled = false,
  backgroundColor = '#ff44ff',
  name
}) {
  const handleToggle = () => {
    onChange(checked, name)
  }
  return (
    <div className={cn(classes.container, { [classes.containerDisabled]: disabled })} onClick={disabled ? null : handleToggle}>
      <input type='hidden' name={name} defaultChecked={checked} />
      <span className={classes.track} style={{ backgroundColor, opacity: checked ? 1 : 0.4 }} />
      <span className={cn(classes.button, { [classes.buttonChecked]: checked })} />
    </div>
  )
}

export default SwitchStyled
