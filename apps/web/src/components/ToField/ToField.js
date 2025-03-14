import PropTypes from 'prop-types'
import React, { useState, forwardRef, useRef, useImperativeHandle } from 'react'
import { differenceBy } from 'lodash'
import TagInput from 'components/TagInput'
import styles from './ToField.module.scss'

const ToField = forwardRef(({
  placeholder: placeholderProp,
  selected = [],
  options = [],
  onChange,
  readOnly,
  groupSettings,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const [suggestions, setSuggestions] = useState([])
  const tagInputRef = useRef()

  useImperativeHandle(ref, () => ({
    reset: () => {
      setSuggestions([])
    },

    focus: () => tagInputRef.current?.focus()
  }))

  const findSuggestions = (searchText) => {
    let newSuggestions
    if (searchText && searchText.trim().length > 0) {
      newSuggestions = differenceBy(options, selected, 'id')
        .filter(o => o.name.match(new RegExp(searchText, 'i')))
      setSuggestions(newSuggestions)
    } else {
      newSuggestions = differenceBy(options, selected, 'id')
      setSuggestions(newSuggestions)
    }
  }

  const clearSuggestions = () =>
    setSuggestions([])

  const handleInputChange = (input) => {
    if (input === null) {
      clearSuggestions()
    } else {
      findSuggestions(input)
    }
  }

  const handleAddition = (groupOrGroups) => {
    clearSuggestions()
    onChange(selected.concat(groupOrGroups))
  }

  const handleDelete = (option) => {
    if (option.topic) {
      onChange(selected.filter(o => o.topic?.id !== option.topic?.id))
    } else {
      onChange(selected.filter(o => o.group.id !== option.group.id))
    }
  }

  return (
    <TagInput
      groupSettings={groupSettings}
      tags={selected}
      suggestions={suggestions}
      handleInputChange={handleInputChange}
      handleAddition={handleAddition}
      handleDelete={handleDelete}
      placeholder=''
      readOnly={readOnly}
      theme={styles}
      ref={tagInputRef}
      onFocus={onFocus} // Pass through to parent
      onBlur={onBlur} // Pass through to parent
      tabChooses={false}
    />
  )
})

ToField.propTypes = {
  placeholder: PropTypes.string,
  selected: PropTypes.array,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func
}

export default ToField
