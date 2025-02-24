import { cn } from 'util/index'
import { omit } from 'lodash/fp'
import React, { useState, forwardRef } from 'react'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import { onEnter } from 'util/textInput'

import styles from './TextInput.module.scss'

// pass inputRef to this from a parent, with the same kind of callback you would
// pass to ref, if you want to have a reference to the input field, e.g. for
// focus.
//
// https://facebook.github.io/react/docs/refs-and-the-dom.html#exposing-dom-refs-to-parent-components
//

const TextInput = forwardRef(({
  id,
  theme = {},
  onChange,
  value,
  inputRef,
  className,
  inputClassName,
  noClearButton,
  loading,
  label,
  internalLabel,
  ...props
}, ref) => {
  const onKeyDown = onEnter ? onEnter(props.onEnter) : () => {}
  const onBlur = () => { props.onBlur && props.onBlur(); setActive(false) }
  const onFocus = () => { props.onFocus && props.onFocus(); setActive(true) }

  const otherProps = omit(['onEnter', 'onBlur', 'onFocus'], props)
  const clear = () => onChange && onChange({ target: { name, value: '' } })

  const [active, setActive] = useState(false)

  const handleAnimation = (e) => {
    setActive(e.animationName === 'onAutoFillStart')
  }

  return (
    <div className={cn(theme.wrapperStyle || styles.wrapper, theme.wrapper || className)}>
      <input
        ref={ref}
        type='text'
        className={cn(
          styles[theme.inputStyle] || styles.input,
          theme.input,
          inputClassName
        )}
        onAnimationStart={handleAnimation}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={onChange}
        aria-label={label || internalLabel}
        id={id}
        {...otherProps}
      />
      {internalLabel && (
        <label htmlFor={id} className={cn(styles.internalLabel, active || (value && value.length > 0) ? styles.active : '')}>{internalLabel}</label>
      )}

      {value && !noClearButton &&
        <div className={cn(styles.clear, theme.clear)} onClick={clear} role='button' aria-label='clear'>
          <Icon name='Ex' />
        </div>}
      {loading && <Loading type='inline' className={styles.loading} />}
    </div>
  )
})

TextInput.displayName = 'TextInput'

export default TextInput
