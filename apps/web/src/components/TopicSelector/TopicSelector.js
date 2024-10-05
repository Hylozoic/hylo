import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import AsyncCreatableSelect from 'react-select/async-creatable'
import styles from './TopicSelector.module.scss'
import { isEmpty, isEqual, uniqBy, orderBy, get, includes } from 'lodash/fp'
import { Validators } from 'hylo-shared'
import Icon from 'components/Icon'

/*

`TopicSelector`

  * Don't be mislead by `forGroups`, only the first in that array will be used.
    The implemenation here is mostly ready to handle fetching and presenting
    default topics for multiple groups (i.e. when a Post is posted to multiple
    groups), but the backend endpoint to `fetchDefaultTopics` needs to be
    updated to allow the query of multiple groups. Alternatively separately fetch
    for each group in the list, but deciding against that for now.

  * TODO: Topic name selection should be confined some `MAX_TOPIC_NAME_LENGTH`

*/

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
  multiValueRemove: styles => ({ ...styles, cursor: 'pointer' }),
  clearIndicator: styles => ({ ...styles, cursor: 'pointer' }),
  placeholder: styles => ({ ...styles, color: 'rgb(192, 197, 205)' }),
  dropdownIndicator: styles => ({ display: 'none' }),
  indicatorSeparator: styles => ({ display: 'none' })
}

class TopicSelector extends Component {
  static defaultProps = {
    forGroups: [],
    defaultTopics: [],
    selectedTopics: []
  }

  static defaultState = {
    selected: [],
    topicsEdited: false
  }

  constructor (props) {
    super(props)
    this.state = TopicSelector.defaultState
  }

  componentDidMount () {
    this.updateSelected()
    this.props.fetchDefaultTopics({ groupSlug: get('forGroups[0].slug', this.props) })
  }

  componentDidUpdate (prevProps) {
    if (prevProps.selectedTopics !== this.props.selectedTopics) {
      this.updateSelected()
    }

    if (!isEqual(this.props.forGroups, prevProps.forGroups)) {
      this.props.fetchDefaultTopics({ groupSlug: get('forGroups[0].slug', this.props) })
    }
  }

  updateSelected () {
    if (this.state.topicsEdited) return

    const selected = uniqBy(
      t => t.name,
      this.state.selected.concat(this.props.selectedTopics)
    ).slice(0, MAX_TOPICS)

    this.setState({ selected })
  }

  getSelected = () => {
    return this.state.selected
  }

  reset = () => {
    this.setState(TopicSelector.defaultState)
  }

  formatGroupTopicSuggestions = groupTopics => {
    if (!groupTopics) return

    const { forGroups } = this.props
    const { selected } = this.state

    // Note: `forGroups` handling is staged here for a backend change which will allow
    //        return of multiple default group topics...
    return groupTopics.length > 0 && selected.length < MAX_TOPICS && (
      [{
        label: forGroups && forGroups.length > 0
          ? forGroups[0].name
          : this.props.t('Default Topics'),
        options: groupTopics
      }]
    )
  }

  loadOptions = async input => {
    input = input.charAt(0) === '#' ? input.slice(1) : input

    if (this.state.selected.length >= MAX_TOPICS || isEmpty(input)) return []

    const { findTopics, defaultTopics } = this.props
    const response = await findTopics({ autocomplete: input })
    const topicResults = response.payload.getData().items.map(get('topic'))
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
      ...this.formatGroupTopicSuggestions(filteredDefaultTopics) || [],
      {
        label: this.props.t('All Topics'),
        options: sortedTopicResults
      }
    ]
  }

  handleTopicsChange = newTopics => {
    const topics = newTopics.filter(t => !Validators.validateTopicName(t.name))

    if (topics.length <= MAX_TOPICS) {
      this.setState({
        selected: topics || [],
        topicsEdited: true
      })
    }

    this.props.onChange && this.props.onChange(topics)
  }

  render () {
    const { placeholder = this.props.t('Enter up to three topics...'), defaultTopics: providedDefaultTopics, t } = this.props
    const { selected } = this.state
    const defaultTopics = this.formatGroupTopicSuggestions(providedDefaultTopics) || []

    return (
      <AsyncCreatableSelect
        isMulti
        placeholder={placeholder}
        name='topics'
        value={selected}
        classNamePrefix='topic-selector'
        defaultOptions={defaultTopics}
        styles={inputStyles}
        loadOptions={this.loadOptions}
        onChange={this.handleTopicsChange}
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
            ? t(`You can only select up to {{MAX_TOPICS}} topics`, { MAX_TOPICS })
            : t('Start typing to add a topic')
        }}
        formatOptionLabel={(item, { context }) => {
          if (context === 'value') {
            return <div className={classes.topicLabel}>#{item.name}</div>
          }

          if (item.__isNew__) {
            const validationMessage = Validators.validateTopicName(item.value)
            return <div>{validationMessage || t('Create topic "#{{item.value}}"', { item })}</div>
          } // TODO: i18n, figure out with hylo-shared

          const { name, postsTotal, followersTotal } = item
          const formatCount = count => isNaN(count)
            ? 0
            : count < 1000
              ? count
              : (count / 1000).toFixed(1) + 'k'

          return (
            <div className={styles.item}>
              <div className={classes.menuTopicLabel}>#{name}</div>
              <div className={classes.suggestionMeta}>
                <span className={cx(classes.column, classes.icon)}><Icon name='Star' className={classes.icon} />{formatCount(followersTotal)} {t('subscribers')}</span>
                <span className={cx(classes.column, classes.icon)}><Icon name='Events' className={classes.icon} />{formatCount(postsTotal)} {t('posts')}</span>
              </div>
            </div>
          )
        }}
      />
    )
  }
}

export default withTranslation()(TopicSelector)
