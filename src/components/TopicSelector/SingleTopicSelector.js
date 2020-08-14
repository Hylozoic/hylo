import React, { Component } from 'react'
import AsyncCreatableSelect from 'react-select/async-creatable'
import styles from './TopicSelector.scss'
import { isEmpty, sortBy } from 'lodash/fp'
import { validateTopicName } from 'hylo-utils/validators'
import Icon from 'components/Icon'
import connector from './TopicSelector.connector'

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
  placeholder: styles => ({ color: 'rgb(192, 197, 205)' })
}

class SingleTopicSelector extends Component {
  static defaultProps = {
    currentCommunity: null,
    defaultTopics: [],
    placeholder: 'Find/add a topic'
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
      await this.props.findTopics(value)
      const { currentCommunity, defaultTopics, topicResults } = this.props
      const sortedTopics = sortBy([t => t.name === value ? -1 : 1, 'followersTotal', 'postsTotal'], topicResults)
      return defaultTopics ? [ { label: currentCommunity.name + ' topics', options: defaultTopics }, { label: 'All Topics', options: sortedTopics } ] : sortedTopics
    } else {
      this.setState({ value: null })
      return []
    }
  }

  handleSelectTopic = (newTopic, action) => {
    const topic = validateTopicName(newTopic) ? newTopic : ''

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
    const { currentCommunity, defaultTopics, placeholder } = this.props
    const { value } = this.state

    const defaultsToShow = defaultTopics ? [ { label: currentCommunity.name + ' topics', options: defaultTopics } ] : []

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
          return 'Start typing to find/create a topic to add'
        }}
        isOptionDisabled={option => option.__isNew__ && option.value.length < 3}
        formatOptionLabel={(item, { context, inputValue, selectValue }) => {
          if (context === 'value') {
            return <div styleName='topicLabel'>#{item.label}</div>
          }
          if (item.__isNew__) {
            return <div>{item.value.length < 3 ? 'Topics must be longer than 2 characters' : `Create topic "${item.value}"`}</div>
          }
          const { name, postsTotal, followersTotal } = item
          const formatCount = count => isNaN(count)
            ? 0
            : count < 1000
              ? count
              : (count / 1000).toFixed(1) + 'k'

          return <div className={styles.item}>
            <div styleName='menuTopicLabel'>#{name}</div>
            <div styleName='suggestionMeta'>
              <span styleName='column'><Icon name='Star' styleName='icon' />{formatCount(followersTotal)} subscribers</span>
              <span styleName='column'><Icon name='Events' styleName='icon' />{formatCount(postsTotal)} posts</span>
            </div>
          </div>
        }}
      />
    )
  }
}

export default connector(SingleTopicSelector)
