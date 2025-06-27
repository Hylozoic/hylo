import React, { useCallback, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import AsyncCreatableSelect from 'react-select/async-creatable'
import { isEmpty, uniqBy, orderBy, get, includes } from 'lodash/fp'
import { Validators } from '@hylo/shared'
import Icon from 'components/Icon'
import { fetchDefaultTopics } from 'store/actions/fetchTopics'
import findTopics from 'store/actions/findTopics'
import getDefaultTopics from 'store/selectors/getDefaultTopics'
import { cn } from 'util/index'

import classes from './TopicSelector.module.scss'

const MAX_TOPICS = 3
const inputStyles = {
  container: styles => ({
    ...styles,
    cursor: 'text',
    fontFamily: 'Circular Book, sans-serif'
  }),
  valueContainer: styles => ({
    ...styles,
    padding: 0
  }),
  control: styles => ({
    ...styles,
    minWidth: '200px',
    border: 'none',
    boxShadow: 0,
    cursor: 'text'
  }),
  multiValue: styles => ({
    ...styles,
    backgroundColor: 'transparent'
  }),
  multiValueRemove: styles => ({ ...styles, color: 'black', cursor: 'pointer' }),
  clearIndicator: styles => ({ ...styles, cursor: 'pointer' }),
  placeholder: styles => ({ ...styles, color: 'rgb(192, 197, 205)' }),
  dropdownIndicator: styles => ({ display: 'none' }),
  indicatorSeparator: styles => ({ display: 'none' })
}

function TopicSelector (props) {
  const { forGroups = [], selectedTopics = [], onChange } = props
  const { t } = useTranslation()
  const [selected, setSelected] = useState([])
  const [topicsEdited, setTopicsEdited] = useState(false)
  const dispatch = useDispatch()
  const defaultTopics = useSelector(state => getDefaultTopics(state, { groups: forGroups }))

  const slug = get('forGroups[0].slug', props)

  useEffect(() => {
    slug && dispatch(fetchDefaultTopics({ groupSlug: slug }))
  }, [slug])

  useEffect(() => {
    if (topicsEdited) return

    const newSelected = uniqBy(
      t => t.name,
      selected.concat(selectedTopics)
    ).slice(0, MAX_TOPICS)

    setSelected(newSelected)
  }, [selectedTopics])

  const loadOptions = useCallback(async (input) => {
    input = input.charAt(0) === '#' ? input.slice(1) : input

    if (selected.length >= MAX_TOPICS || isEmpty(input)) return []

    const response = await dispatch(findTopics({ autocomplete: input, groupSlug: slug, includeCounts: true }))
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
  }, [defaultTopics, selected, slug])

  const handleTopicsChange = useCallback(newTopics => {
    const topics = newTopics.filter(t => !Validators.validateTopicName(t.name))

    if (topics.length <= MAX_TOPICS) {
      setSelected(topics || [])
      setTopicsEdited(true)
    }

    onChange && onChange(topics)
  }, [onChange])

  const formatGroupTopicSuggestions = useCallback(groupTopics => {
    if (!groupTopics) return

    return groupTopics.length > 0 && selected.length < MAX_TOPICS && (
      [{
        label: forGroups && forGroups.length > 0
          ? forGroups[0].name
          : t('Default Topics'),
        options: groupTopics
      }]
    )
  }, [forGroups, selected])

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
          return <div className={classes.topicLabel}>#{item.name}</div>
        }

        if (item.__isNew__) {
          const validationMessage = Validators.validateTopicName(item.value)
          return <div>{validationMessage || t('Create topic "#{{item.value}}"', { item })}</div>
        }

        const { name, postsTotal, followersTotal } = item
        const formatCount = count => isNaN(count)
          ? 0
          : count < 1000
            ? count
            : (count / 1000).toFixed(1) + 'k'

        return (
          <div className={classes.item}>
            <div className={classes.menuTopicLabel}>#{name}</div>
            <div className={classes.suggestionMeta}>
              <span className={cn(classes.column, classes.icon)}><Icon name='Star' className={classes.icon} />{formatCount(followersTotal)} {t('subscribers')}</span>
              <span className={cn(classes.column, classes.icon)}><Icon name='Events' className={classes.icon} />{formatCount(postsTotal)} {t('posts')}</span>
            </div>
          </div>
        )
      }}
    />
  )
}

export default TopicSelector
