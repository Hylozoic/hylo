import PropTypes from 'prop-types'
import React, { Component, forwardRef, useImperativeHandle } from 'react'
import { debounce, includes, isEmpty } from 'lodash'
import { uniqBy } from 'lodash/fp'
import { cn } from 'util/index'
import { getKeyCode, keyMap } from 'util/textInput'
import Icon from 'components/Icon'
import KeyControlledItemList from 'components/KeyControlledList/KeyControlledItemList'
import RoundImage from 'components/RoundImage'
import { accessibilityIcon, visibilityIcon, accessibilityString, accessibilityDescription, visibilityString, visibilityDescription } from 'store/models/Group'
import styles from './TagInput.module.scss'

const { object, array, bool, string, func } = PropTypes

// keys that can be pressed to create a new tag
const creationKeyCodes = [keyMap.ENTER, keyMap.SPACE, keyMap.COMMA]

class TagInput extends Component {
  static propTypes = {
    tags: array,
    suggestions: array,
    handleInputChange: func.isRequired,
    handleAddition: func,
    handleDelete: func,
    allowNewTags: bool,
    placeholder: string,
    filter: func,
    readOnly: bool,
    className: string,
    theme: object,
    addLeadingHashtag: bool,
    renderSuggestion: func,
    tabChooses: bool,
    backgroundClassName: string
  }

  static defaultProps = {
    theme: {
      root: 'root',
      selected: 'selected',
      selectedTag: 'selectedTag',
      selectedTagName: 'selectedTagName',
      selectedTagRemove: 'selectedTagRemove',
      search: 'search',
      searchInput: 'searchInput',
      suggestions: 'suggestions',
      suggestionsList: 'suggestionsList',
      suggestion: 'suggestion',
      readOnly: 'readOnly',
      tabChooses: true
    }
  }

  constructor (props) {
    super(props)

    this.input = React.createRef()
    this.list = React.createRef()
  }

  input = React.createRef()
  focus = () => {
    if (this.input.current && !this.props.readOnly) {
      this.input.current.focus()
    }
  }

  resetInput = () => {
    if (this.input.current) this.input.current.value = ''
    this.props.handleInputChange('')
  }

  handleKeys = event => {
    const { allowNewTags, handleAddition, handleInputChange, filter } = this.props
    const keyCode = getKeyCode(event)
    const keyWasHandled = this.list.current && this.list.current.handleKeys(event)

    if (!keyWasHandled && allowNewTags) {
      // if the current input has matching search results, you can press Escape
      // to clear the results.
      if (keyCode === keyMap.ESC) {
        handleInputChange('')
        return
      }

      // if there are no matches, or there are matches but none has been
      // selected yet, you can also press any key listed in creationKeyCodes to
      // create a tag based on what you've typed so far.
      if (includes(creationKeyCodes, keyCode)) {
        const { value } = event.target
        if (!value) return
        handleAddition({ id: value, name: value })
        this.resetInput()
        event.preventDefault()
        return
      }
    }

    if (filter) filter(event)
  }

  select = choice => {
    this.props.handleAddition(choice)
    this.resetInput()
  }

  remove = tag => event => {
    this.props.handleDelete(tag)
    event.preventDefault()
  }

  handleContainerClick = () => {
    // Only focus if we're not in readOnly mode
    if (!this.props.readOnly) {
      this.focus()
    }
  }

  handleFocus = (e) => {
    this.handleChange('')
    this.props.onFocus?.(e) // Propagate focus up
  }

  handleBlur = (e) => {
    this.input.current.value = ''
    this.handleChange(null)
    this.props.onBlur?.(e) // Propagate blur up
  }

  handleChange = debounce(value => {
    let strippedValue = value
    if (value) {
      strippedValue = this.props.stripInputHashtag ? value.replace(/^#/, '') : value
    }
    this.props.handleInputChange(strippedValue)
  }, 200)

  render () {
    const { tags = [], placeholder = this.props.t('Type...'), suggestions, className, theme, readOnly, maxTags, addLeadingHashtag, renderSuggestion, tagType } = this.props
    const optionalHashtag = addLeadingHashtag ? '#' : ''

    const selectedItems = uniqBy('id', tags).map(t =>
      <li key={t.id} className='inline-flex items-center relative top-[2px] mr-2'>
        {t.avatarUrl && <RoundImage url={t.avatarUrl} small className={theme.selectedTagImage} />}
        <span className='text-foreground'>
          {optionalHashtag}{t.label || t.name}
          {tagType && tagType === 'groups' && this.props.groupSettings && (
            <span>
              <span className={styles.privacyIcon}>
                <Icon name={accessibilityIcon(t.accessibility)} className={styles.tagInputPrivacyIcon} />
                <div className={styles.privacyTooltip}>
                  <div><strong>{this.props.t(accessibilityString(t.accessibility))}</strong> - {this.props.t(accessibilityDescription(t.accessibility))}</div>
                </div>
              </span>
              <span className={styles.privacyIcon}>
                <Icon name={visibilityIcon(t.visibility)} className={styles.tagInputPrivacyIcon} />
                <div className={styles.privacyTooltip}>
                  <div><strong>{this.props.t(visibilityString(t.visibility))}</strong> - {this.props.t(visibilityDescription(t.visibility))}</div>
                </div>
              </span>
            </span>
          )}
        </span>
        <a onClick={!readOnly ? this.remove(t) : undefined} className={theme.selectedTagRemove}>&times;</a>
      </li>
    )

    const maxReached = maxTags && selectedItems.length >= maxTags

    // this is so the suggestion list can do double duty as an error message
    const suggestionsOrError = maxReached
      ? isEmpty(this.input.current.value)
        ? []
        : [{ name: this.props.t('no more than {{maxTags}} allowed', { maxTags }), isError: true }]
      : suggestions
    return (
      <div className={cn('TagInput-container w-full relative h-full', { [theme.readOnly]: readOnly }, className)} onClick={this.handleContainerClick}>
        <ul className={theme.selected}>
          {selectedItems}

          <li className={cn('text-foreground bg-transparent inline-flex', theme.searchInputContainer, { tagsEmpty: selectedItems.length === 0 })}>
            <div className={cn('relative', theme.searchInputContainer)}>
              <input
                className={cn('text-foreground bg-transparent inline outline-none pr-1 placeholder:text-foreground/50',
                  theme.searchInput,
                  { error: maxReached, tagsEmpty: selectedItems.length === 0 }
                )}
                ref={this.input}
                type='text'
                placeholder={placeholder}
                spellCheck={false}
                onFocus={this.handleFocus}
                onBlur={this.handleBlur}
                onChange={event => this.handleChange(event.target.value)}
                onKeyDown={this.handleKeys}
                disabled={readOnly}
                aria-label='tagInput'
              />
            </div>
            {!isEmpty(suggestionsOrError) &&
              <div className='TagInput-suggestions absolute top-full left-0 w-full z-10'>
                <KeyControlledItemList
                  items={suggestionsOrError}
                  tagType={tagType}
                  renderListItem={renderSuggestion}
                  onChange={maxReached ? this.resetInput : this.select}
                  theme={{
                    items: 'p-0 m-0 text-foreground',
                    item: cn('TagInput-KeyControlledList-item p-2 hover:bg-selected/100 text-foreground m-0 hover:text-foreground rounded-md', { [styles.error]: maxReached }),
                    itemActive: 'text-foreground',
                    itemLink: 'TagInput-KeyControlledList-itemLink text-foreground hover:text-foreground'
                  }}
                  ref={this.list}
                  tabChooses={this.props.tabChooses}
                  backgroundClassName={this.props.backgroundClassName || 'bg-primary'}
                />
              </div>}
          </li>
        </ul>

      </div>
    )
  }
}
export default forwardRef((props, ref) => {
  const component = React.createRef()

  useImperativeHandle(ref, () => ({
    focus: () => component.current?.focus()
  }))

  return <TagInput {...props} ref={component} />
})
