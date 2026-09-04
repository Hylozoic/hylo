import PropTypes from 'prop-types'
import React, { useState, forwardRef, useRef, useImperativeHandle } from 'react'
import { differenceBy } from 'lodash'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import RoundImage from 'components/RoundImage'
import TagInput from 'components/TagInput'
import styles from './ToField.module.scss'

// Escape user input for use in a RegExp
const escapeRegExp = (text) => text?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') ?? ''

/** Renders a To-field suggestion: group avatar + name, or Group / Space with space icon. */
function renderToSuggestion ({ item, handleChoice }) {
  const spaceName = item.isSpace
    ? (item.group?.name || item.name?.split(' / ').slice(1).join(' / '))
    : null
  const parentName = item.isSpace
    ? (item.parentGroup?.name || item.name?.split(' / ')[0])
    : item.name

  return (
    <li key={item.id || 'blank'} className='m-0 list-none'>
      <a
        className={`flex items-center gap-2 text-foreground hover:text-foreground ${item.isSpace ? 'pl-4' : ''}`}
        onClick={event => handleChoice(item, event)}
      >
        {item.avatarUrl && (
          <RoundImage url={item.avatarUrl} small className='shrink-0' />
        )}
        {item.isSpace
          ? (
            <span className='flex min-w-0 items-center gap-1.5'>
              <span className='truncate'>{parentName}</span>
              <span className='text-foreground/50 shrink-0'>/</span>
              {item.icon && (
                <LucideIcon name={item.icon} className='h-3.5 w-3.5 shrink-0' />
              )}
              <span className='truncate'>{spaceName}</span>
            </span>
            )
          : (
            <span className='truncate'>{item.name}</span>
            )}
      </a>
    </li>
  )
}

const ToField = forwardRef(({
  placeholder: placeholderProp,
  selected = [],
  options = [],
  onChange,
  onDelete, // Optional custom delete handler - receives (deletedOption, allSelected) and should return the new selected array
  readOnly,
  groupSettings,
  onFocus,
  onBlur,
  backgroundClassName,
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
      const safe = escapeRegExp(searchText)
      const pattern = new RegExp(safe, 'i')
      newSuggestions = differenceBy(options, selected, 'id')
        .filter(o => pattern.test(o.name) || pattern.test(o.group?.name || ''))
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
    // If a custom onDelete handler is provided, use it
    if (onDelete) {
      const newSelected = onDelete(option, selected)
      onChange(newSelected)
      return
    }

    // Default behavior: remove by destination group/space id
    onChange(selected.filter(o => o.group?.id !== option.group?.id && o.id !== option.id))
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
      backgroundClassName={backgroundClassName}
      ref={tagInputRef}
      onFocus={onFocus} // Pass through to parent
      onBlur={onBlur} // Pass through to parent
      tabChooses={false}
      spaceChooses={false}
      renderSuggestion={renderToSuggestion}
    />
  )
})

ToField.propTypes = {
  placeholder: PropTypes.string,
  selected: PropTypes.array,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func,
  onDelete: PropTypes.func
}

export default ToField
