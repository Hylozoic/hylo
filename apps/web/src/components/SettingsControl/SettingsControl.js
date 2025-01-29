import React from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import LocationInput from 'components/LocationInput'
import IconSelector from 'components/IconSelector'
import { cn } from 'util/index'
import classes from './SettingsControl.module.scss'

export default function SettingsControl (props) {
  const { id, helpText, label, value = '', onChange, renderControl, type, error, controlClass, inputStyle, ...otherProps } = props
  let control

  if (renderControl) {
    control = renderControl(props)
  } else {
    switch (type) {
      case 'textarea':
        control = (
          <div>
          <TextareaAutosize
            id={id}
            minRows={1}
            maxRows={100}
            onChange={onChange}
            readOnly={!onChange}
            className='bg-black/20 rounded-lg text-foreground w-full p-4 outline-none focus:outline-focus focus:outline-2'
            value={value}
            {...otherProps}
          /></div>
        )
        break
      case 'icon-selector':
        control = (
          <IconSelector
            selectedIcon={value}
            updateIcon={onChange}
            {...otherProps}
          />
        )
        break
      case 'password':
        control = (
          <input
            id={id}
            autoComplete='new-password'
            autoCorrect='off'
            onChange={onChange}
            spellCheck='off'
            className='bg-black/20 rounded-lg text-foreground w-full p-4 outline-none focus:outline-focus focus:outline-2'
            type='password'
            value={value}
            readOnly={!onChange}
            {...otherProps}
          />
        )
        break
      case 'location':
        control = (
          <LocationInput
            id={id}
            onChange={onChange}
            readOnly={!onChange}
            className='bg-black/20 rounded-lg text-foreground placeholder-foreground/40 w-full p-4 outline-none focus:outline-focus focus:outline-2'
            saveLocationToDB
            {...otherProps}
          />
        )
        break
      default:
        control = (
          <input
            id={id}
            onChange={onChange}
            readOnly={!onChange}
            className='bg-black/20 rounded-lg text-foreground placeholder-foreground/40  w-full p-4 outline-none focus:outline-focus focus:outline-2'
            type='text'
            style={inputStyle}
            value={value}
            {...otherProps}
          />
        )
        break
    }
  }

  return (
    <div className={cn('w-full bg-transparent text-foreground', { [classes.error]: error }, controlClass)}>
      <label className={cn('w-full text-foreground/50 text-sm mb-2 block', { [classes.error]: error })} htmlFor={id}>
        {label}
        {helpText
          ? <div className={classes.help}>?<div className={classes.helpTooltip}>{helpText}</div></div>
          : ''}
      </label>

      {control}
    </div>
  )
}
