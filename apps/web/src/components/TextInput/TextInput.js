import { cn } from 'util/index'
import { omit } from 'lodash/fp'
import React, { useState, forwardRef, useEffect, useRef } from 'react'
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
  doCheckAutofill = false,
  inputRef,
  className,
  inputClassName,
  noClearButton,
  loading,
  label,
  internalLabel,
  ...props
}, ref) => {
  const onKeyDown = props.onEnter ? onEnter(props.onEnter) : () => {}
  const onBlur = () => { props.onBlur && props.onBlur(); setActive(false) }
  const onFocus = () => { props.onFocus && props.onFocus(); setActive(true) }

  const otherProps = omit(['onEnter', 'onBlur', 'onFocus'], props)
  const clear = () => onChange && onChange({ target: { name, value: '' } })

  const [active, setActive] = useState(false)
  const inputEl = useRef(null)

  // Combine forwarded ref and local ref
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(inputEl.current)
      } else {
        ref.current = inputEl.current
      }
    }
  }, [ref])

  // Check for autofill after mount
  useEffect(() => {
    if (!doCheckAutofill) return
    const checkAutofill = () => {
      if (inputEl.current && inputEl.current.value) {
        setActive(true)
      }
    }
    checkAutofill()
    const timeout = setTimeout(checkAutofill, 500) // 500ms after mount
    return () => clearTimeout(timeout)
  }, [])

  const handleAnimation = (e) => {
    setActive(e.animationName === 'onAutoFillStart')
  }

  return (

    <div
      className={cn(
        'flex items-center relative rounded bg-input text-foreground h-fit',
        theme.wrapper,
        className
      )}
    >
      <input
        ref={inputEl}
        value={value}
        type={props.type || 'text'}
        className={cn(
          inputClassName || (styles[theme.inputStyle] || 'bg-input p-4 rounded-md w-full text-foreground text-sm sm:text-base placeholder:text-muted-foreground'),
          theme.input
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
        <label
          htmlFor={id}
          className={cn(
            'block absolute left-[18px] top-3 text-foreground/60 text-base transition-all duration-200',
            (active || (value && value.length > 0)) && 'text-[10px] top-[3px] left-[14px]'
          )}
        >
          {internalLabel}
        </label>
      )}

      {value && !noClearButton &&
        <div
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer mr-2 transition-colors text-foreground/60 hover:text-foreground/100'
          )}
          onClick={clear}
          role='button'
        >
          <Icon name='Ex' />
        </div>}
      {loading && <Loading type='inline' className={styles.loading} />}
    </div>
  )
})

TextInput.displayName = 'TextInput'

export default TextInput
