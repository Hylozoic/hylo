import PropTypes from 'prop-types'
import React, { useState, forwardRef, useImperativeHandle } from 'react'
import { differenceBy } from 'lodash'
import TagInput from 'components/TagInput'
import styles from './GroupsSelector.module.scss'
import { useTranslation } from 'react-i18next'

const GroupsSelector = forwardRef(({
  placeholder: placeholderProp,
  selected = [],
  options = [],
  onChange,
  readOnly,
  groupSettings
}, ref) => {
  const { t } = useTranslation()
  const defaultState = { suggestions: [] }
  const [state, setState] = useState(defaultState)

  useImperativeHandle(ref, () => ({
    reset: () => {
      setState(defaultState)
    }
  }))

  const findSuggestions = (searchText) => {
    let newSuggestions
    if (searchText && searchText.trim().length > 0) {
      newSuggestions = differenceBy(options, selected, 'id')
        .filter(o => o.name.match(new RegExp(searchText, 'i')))
      setState({ suggestions: newSuggestions })
    } else {
      newSuggestions = differenceBy(options, selected, 'id')
      setState({ suggestions: newSuggestions })
    }
  }

  const clearSuggestions = () =>
    setState({ suggestions: defaultState.suggestions })

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

  const handleDelete = (group) => {
    onChange(selected.filter(c => c.id !== group.id))
  }

  const placeholder = placeholderProp || t('Type group name...')

  return (
    <TagInput
      t={t}
      groupSettings={groupSettings}
      placeholder={placeholder}
      tags={selected}
      suggestions={state.suggestions}
      handleInputChange={handleInputChange}
      handleAddition={handleAddition}
      handleDelete={handleDelete}
      readOnly={readOnly}
      tagType='groups'
      theme={styles}
    />
  )
})

GroupsSelector.propTypes = {
  placeholder: PropTypes.string,
  selected: PropTypes.array,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func
}

export default GroupsSelector
