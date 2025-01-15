import React, { useState } from 'react'
import { isEmpty, sortBy } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import AsyncCreatableSelect from 'react-select/async-creatable'
import { Validators } from '@hylo/shared'
import Icon from 'components/Icon'
import findTopics from 'store/actions/findTopics'
import getDefaultTopics from 'store/selectors/getDefaultTopics'

import classes from './TopicSelector.module.scss'

const inputStyles = {
  container: styles => ({
    ...styles,
    cursor: 'text',
    fontFamily: 'Circular Book, sans-serif'
  }),
  control: styles => ({
    ...styles,
    minWidth: '200px',
    border: 'none',
    boxShadow: 0,
    cursor: 'text'
  }),
  multiValue: styles => ({ ...styles, backgroundColor: 'transparent' }),
  multiValueRemove: styles => ({ ...styles, cursor: 'pointer' }),
  clearIndicator: styles => ({ ...styles, cursor: 'pointer' }),
  dropdownIndicator: styles => ({ display: 'none' }),
  indicatorSeparator: styles => ({ display: 'none' }),
  placeholder: styles => ({ ...styles, color: 'rgb(192, 197, 205)' })
}

function SingleTopicSelector ({ currentGroup = null, forGroups = [], onSelectTopic }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [value, setValue] = useState(null)
  const defaultTopics = useSelector(state => getDefaultTopics(state, { groups: forGroups }))

  const handleInputChange = async (value) => {
    setValue(value)
    if (!isEmpty(value)) {
      const results = await dispatch(findTopics({ autocomplete: value }))
      const topicResults = (results.payload?.data?.groupTopics?.items || []).map(t => (t.topic))
      const sortedTopics = sortBy([t => t.name === value ? -1 : 1, 'followersTotal', 'postsTotal'], topicResults)
      return defaultTopics ? [{ label: currentGroup.name + ' topics', options: defaultTopics }, { label: 'All Topics', options: sortedTopics }] : sortedTopics
    } else {
      setValue(null)
      return []
    }
  }

  const handleSelectTopic = newTopic => {
    const topic = Validators.validateTopicName(newTopic) ? newTopic : ''

    if (onSelectTopic) {
      onSelectTopic(topic)
      setValue(null)
      return
    }
    setValue(topic)
  }

  const defaultsToShow = defaultTopics ? [{ label: t('{{currentGroup.name}} topics', { currentGroup }), options: defaultTopics }] : []

  return (
    <AsyncCreatableSelect
      placeholder={t('Find/add a topic')}
      name='topic-selector'
      value={value}
      isClearable
      classNamePrefix='topic-selector'
      defaultOptions={defaultsToShow}
      styles={inputStyles}
      loadOptions={handleInputChange}
      onChange={handleSelectTopic}
      getNewOptionData={(inputValue, optionLabel) => ({ name: inputValue, label: inputValue, value: inputValue, __isNew__: true })}
      noOptionsMessage={() => {
        return t('Start typing to find/create a topic to add')
      }}
      isOptionDisabled={option => option.__isNew__ && option.value.length < 3}
      formatOptionLabel={(item, { context, inputValue, selectValue }) => {
        if (context === 'value') {
          return <div className={classes.topicLabel}>#{item.label}</div>
        }
        if (item.__isNew__) {
          return <div>{item.value.length < 3 ? t('Topics must be longer than 2 characters') : t('Create topic "{{item.value}}"', { item })}</div>
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
              <span className={classes.column}><Icon name='Star' className={classes.icon} />{formatCount(followersTotal)} {t('subscribers')}</span>
              <span className={classes.column}><Icon name='Events' className={classes.icon} />{formatCount(postsTotal)} {t('posts')}</span>
            </div>
          </div>
        )
      }}
    />
  )
}

export default SingleTopicSelector
