import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { TransitionGroup, CSSTransition } from 'react-transition-group'
import { debounce, includes, isEmpty, delay } from 'lodash'
import { getKeyCode, keyMap } from 'util/textInput'
import KeyControlledItemList from 'components/KeyControlledList/KeyControlledItemList'
import Pill from 'components/Pill'
import styles from './Pillbox.module.scss'

// keys that can be pressed to create a new pill
const creationKeyCodes = [keyMap.ENTER]

class Pillbox extends Component {
  constructor (props) {
    super(props)

    this.state = {
      adding: false
    }
    this.input = React.createRef()
    this.list = React.createRef()
    this.pillTransitionRef = React.createRef()
  }

  resetInput () {
    this.input.current.value = ''
    this.props.handleInputChange('')
    this.setState({ adding: false })
  }

  handleKeys = event => {
    const { handleAddition, filter } = this.props
    const keyCode = getKeyCode(event)
    const keyWasHandled = this.list.current && this.list.current.handleKeys(event)

    if (!keyWasHandled) {
      // if the current input has matching search results, you can press Escape
      // to clear the results.
      if (keyCode === keyMap.ESC) {
        this.resetInput()
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

  focus = () => delay(() => {
    this.input.current.focus()
  }, 10)

  handleChange = debounce(value => {
    this.props.handleInputChange(value)
  }, 200)

  render () {
    const { addLabel = this.props.t('Add'), editable, handleClick, handleDelete } = this.props

    const { pills, placeholder = this.props.t('type here'), suggestions } = this.props

    const { adding } = this.state

    const addOnClick = () => {
      this.setState({ adding: true })
      this.focus()
    }

    const reset = () => {
      this.resetInput()
    }

    return (
      <div className={styles.root}>
        <div className={styles.pillContainer}>
          <TransitionGroup>
            {pills.map(pill =>
              <CSSTransition
                key={pill.id}
                classNames={{
                  enter: styles.enter,
                  enterActive: styles.enterActive,
                  exit: styles.exit,
                  exitActive: styles.exitActive
                }}
                timeout={{ enter: 400, exit: 300 }}
                nodeRef={this.pillTransitionRef}
              >
                <Pill
                  key={pill.id}
                  {...pill}
                  onClick={handleClick}
                  editable={editable}
                  onRemove={handleDelete}
                  ref={this.pillTransitionRef}
                />
              </CSSTransition>
            )}
          </TransitionGroup>
          {editable && <span className={styles.addBtn} onClick={addOnClick}>{addLabel}</span>}
        </div>
        {adding && (
          <div className={styles.addingRoot}>
            <div className={styles.searchWrapper}>
              <input
                ref={this.input}
                type='text'
                className={styles.search}
                maxLength='30'
                placeholder={placeholder}
                spellCheck={false}
                onChange={event => this.handleChange(event.target.value)}
                onKeyDown={this.handleKeys}
              />
              <button className={styles.closeIcon} onClick={reset} type='reset' />
            </div>
            {!isEmpty(suggestions) &&
              <KeyControlledItemList
                spaceChooses={false}
                items={suggestions}
                theme={{
                  items: styles.suggestions,
                  item: styles.suggestion,
                  itemActive: styles.suggestionActive
                }}
                onChange={this.select}
                ref={this.list}
              />}
          </div>
        )}
      </div>
    )
  }
}
export default withTranslation()(Pillbox)
