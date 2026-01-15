import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AsyncCreatableSelect from 'react-select/async-creatable'
import { isEmpty, uniqBy, orderBy, get, includes } from 'lodash/fp'
import { Validators } from '@hylo/shared'
import Icon from 'components/Icon'
import { fetchDefaultTopics } from 'store/actions/fetchTopics'
import findTopics from 'store/actions/findTopics'
import getDefaultTopics from 'store/selectors/getDefaultTopics'

const MAX_TOPICS = 3
const inputStyles = {
  container: styles => ({
    ...styles,
    cursor: 'text',
    fontFamily: 'Onest, Circular Book, sans-serif',
    backgroundColor: 'hsl(var(--card))',
    width: '100%'
  }),
  valueContainer: styles => ({
    ...styles,
    padding: '0.5rem'
  }),
  control: styles => ({
    ...styles,
    minWidth: '200px',
    border: 'none',
    borderRadius: '0.5rem',
    backgroundColor: 'hsl(var(--background))',
    boxShadow: 'none',
    transition: 'all 0.2s ease-in-out',
    cursor: 'text',
    '&:hover': {
      border: '1px solid hsl(var(--border))'
    }
  }),
  input: styles => ({
    ...styles,
    color: 'hsl(var(--text-foreground))'
  }),
  multiValue: styles => ({
    ...styles,
    backgroundColor: 'hsl(var(--selected))',
    borderRadius: '0.25rem',
    padding: '0.125rem'
  }),
  multiValueLabel: styles => ({
    ...styles,
    color: 'hsl(var(--accent-foreground))'
  }),
  multiValueRemove: styles => ({
    ...styles,
    color: 'hsl(var(--selected-foreground))',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: 'hsl(var(--selected))',
      color: 'hsl(var(--selected-foreground))'
    }
  }),
  clearIndicator: styles => ({
    ...styles,
    cursor: 'pointer',
    color: 'hsl(var(--foreground))',
    '&:hover': {
      color: 'hsl(var(--foreground))'
    }
  }),
  placeholder: styles => ({
    ...styles,
    color: 'hsl(var(--foreground)/70)'
  }),
  dropdownIndicator: styles => ({ display: 'none' }),
  indicatorSeparator: styles => ({ display: 'none' }),
  menu: styles => ({
    ...styles,
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden'
  }),
  option: (styles, { isFocused, isSelected }) => ({
    ...styles,
    transition: 'all 0.2s ease-in-out',
    backgroundColor: isSelected
      ? 'hsl(var(--selected))'
      : isFocused
        ? 'hsl(var(--selected)/10)'
        : 'transparent',
    color: isSelected
      ? 'hsl(var(--accent-foreground))'
      : 'hsl(var(--foreground))',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'hsl(var(--selected)/10)'
    }
  })
}

function TopicSelector (props) {
  const { forGroups = [], selectedTopics = [], onChange } = props
  const { t } = useTranslation()
  const [selected, setSelected] = useState([])
  const [topicsEdited, setTopicsEdited] = useState(false)
  const dispatch = useDispatch()
  const defaultTopics = useSelector(state => getDefaultTopics(state, { groups: forGroups }))

  // Extract groupIds array from forGroups for scoping topic searches
  const groupIds = useMemo(() => {
    if (!forGroups || forGroups.length === 0) return undefined
    return forGroups.map(g => g?.id).filter(Boolean)
  }, [forGroups])

  // Keep slug for backward compatibility fallback
  const slug = useMemo(() => get('forGroups[0].slug', props), [forGroups])

  useEffect(() => {
    if (groupIds && groupIds.length > 0) {
      dispatch(fetchDefaultTopics({ groupIds }))
    } else if (slug) {
      dispatch(fetchDefaultTopics({ groupSlug: slug }))
    }
  }, [groupIds, slug, dispatch])

  useEffect(() => {
    if (topicsEdited) return

    const newSelected = uniqBy(
      t => t.name,
      selected.concat(selectedTopics)
    ).slice(0, MAX_TOPICS)

    setSelected(newSelected)
  }, [selectedTopics])

  const formatGroupTopicSuggestions = useCallback(groupTopics => {
    if (!groupTopics) return

    return groupTopics.length > 0 && selected.length < MAX_TOPICS && (
      [{
        label: forGroups && forGroups.length > 0
          ? forGroups.length === 1
            ? forGroups[0].name
            : t('Default Topics')
          : t('Default Topics'),
        options: groupTopics
      }]
    )
  }, [forGroups, selected, t])

  const loadOptions = useCallback(async (input) => {
    input = input.charAt(0) === '#' ? input.slice(1) : input

    if (selected.length >= MAX_TOPICS) return []

    // When search term is empty, return sorted default topics from all groups
    if (isEmpty(input)) {
      // Sort default topics from all groups together by name
      const sortedDefaultTopics = orderBy(
        [t => t.name],
        ['asc'],
        defaultTopics || []
      )
      return formatGroupTopicSuggestions(sortedDefaultTopics) || []
    }

    // Use groupIds if available, otherwise fallback to groupSlug for backward compatibility
    const response = await dispatch(findTopics({
      autocomplete: input,
      groupIds,
      groupSlug: groupIds ? undefined : slug,
      includeCounts: true
    }))
    const topicResults = response.payload.getData().items
    const sortedTopicResults = orderBy(
      [t => t.name === input ? -1 : 1, 'followersTotal', 'postsTotal'],
      ['asc', 'desc', 'desc'],
      uniqBy(t => t.name, topicResults.map(t => ({ ...t, value: t.name })))
    )
    const filteredDefaultTopics = defaultTopics.filter(topic => {
      return includes(
        input,
        topic.name && topic.name.toLowerCase()
      )
    })

    return [
      ...formatGroupTopicSuggestions(filteredDefaultTopics) || [],
      {
        label: t('All Topics'),
        options: sortedTopicResults
      }
    ]
  }, [defaultTopics, selected, groupIds, slug])

  const handleTopicsChange = useCallback(newTopics => {
    const topics = newTopics.filter(t => !Validators.validateTopicName(t.name))

    if (topics.length <= MAX_TOPICS) {
      setSelected(topics || [])
      setTopicsEdited(true)
    }

    onChange && onChange(topics)
  }, [onChange])

  return (
    <AsyncCreatableSelect
      isMulti
      placeholder={t('Enter up to three topics...')}
      name='topics'
      value={selected}
      classNamePrefix='topic-selector'
      defaultOptions={formatGroupTopicSuggestions(defaultTopics) || []}
      styles={inputStyles}
      loadOptions={loadOptions}
      onChange={handleTopicsChange}
      isValidNewOption={input => input && input.replace('#', '').length > 1}
      getNewOptionData={(inputValue, optionLabel) => {
        if (selected.length >= MAX_TOPICS) return null

        const sanitizedValue = inputValue.replace('#', '')

        return {
          name: sanitizedValue,
          value: sanitizedValue,
          __isNew__: true
        }
      }}
      noOptionsMessage={() => {
        return selected.length >= MAX_TOPICS
          ? t('You can only select up to {{MAX_TOPICS}} topics', { MAX_TOPICS })
          : t('Start typing to add a topic')
      }}
      formatOptionLabel={(item, { context }) => {
        if (context === 'value') {
          return <div className='text-accent-foreground'>{item.name}</div>
        }

        if (item.__isNew__) {
          const validationMessage = Validators.validateTopicName(item.value)
          return <div className='text-foreground'>{validationMessage || t('Create topic "#{{item.value}}"', { item })}</div>
        }

        const { name, postsTotal, followersTotal } = item
        const formatCount = count => isNaN(count)
          ? 0
          : count < 1000
            ? count
            : (count / 1000).toFixed(1) + 'k'

        return (
          <div className='flex flex-col gap-1 p-1'>
            <div className='text-foreground font-medium'>#{name}</div>
            <div className='flex text-xs text-foreground/70 gap-4'>
              <span className='flex items-center gap-1'>
                <Icon name='Star' className='w-4 h-4' />
                {formatCount(followersTotal)} {t('subscribers')}
              </span>
              <span className='flex items-center gap-1'>
                <Icon name='Events' className='w-4 h-4' />
                {formatCount(postsTotal)} {t('posts')}
              </span>
            </div>
          </div>
        )
      }}
    />
  )
}

export default TopicSelector
