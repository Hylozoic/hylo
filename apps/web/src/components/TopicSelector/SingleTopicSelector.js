import { isEmpty, sortBy } from 'lodash/fp'
import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import AsyncCreatableSelect from 'react-select/async-creatable'
import { Validators } from '@hylo/shared'
import Icon from 'components/Icon'
import connector from './TopicSelector.connector'

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

class SingleTopicSelector extends Component {
  static defaultProps = {
    currentGroup: null,
    defaultTopics: []
  }

  static defaultState = {
    value: null
  }

  constructor (props) {
    super(props)
    this.state = SingleTopicSelector.defaultState
  }

  handleInputChange = async (value) => {
    this.setState({ value })
    if (!isEmpty(value)) {
      const results = await this.props.findTopics({ autocomplete: value })
      const { currentGroup, defaultTopics } = this.props
      const topicResults = (results.payload?.data?.groupTopics?.items || []).map(t => (t.topic))
      const sortedTopics = sortBy([t => t.name === value ? -1 : 1, 'followersTotal', 'postsTotal'], topicResults)
      return defaultTopics ? [{ label: currentGroup.name + ' topics', options: defaultTopics }, { label: 'All Topics', options: sortedTopics }] : sortedTopics
    } else {
      this.setState({ value: null })
      return []
    }
  }

  handleSelectTopic = newTopic => {
    const topic = Validators.validateTopicName(newTopic) ? newTopic : ''

    if (this.props.onSelectTopic) {
      this.props.onSelectTopic(topic)
      this.setState({ value: null })
      return
    }
    this.setState({
      value: topic
    })
  }

  render () {
    const { currentGroup, defaultTopics, placeholder = this.props.t('Find/add a topic'), t } = this.props
    const { value } = this.state

    const defaultsToShow = defaultTopics ? [{ label: t('{{currentGroup.name}} topics', { currentGroup }), options: defaultTopics }] : []

    return (
      <AsyncCreatableSelect
        placeholder={placeholder}
        name='topic-selector'
        value={value}
        isClearable
        classNamePrefix='topic-selector'
        defaultOptions={defaultsToShow}
        styles={inputStyles}
        loadOptions={this.handleInputChange}
        onChange={this.handleSelectTopic}
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
}

export default withTranslation()(connector(SingleTopicSelector))
