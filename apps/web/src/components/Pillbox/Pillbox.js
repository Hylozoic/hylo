import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { TransitionGroup, CSSTransition } from 'react-transition-group'
import { debounce, includes, isEmpty, delay } from 'lodash'
import { getKeyCode, keyMap } from 'util/textInput'

import Button from 'components/ui/button'
import KeyControlledItemList from 'components/KeyControlledList/KeyControlledItemList'
import Pill from 'components/Pill'

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
      if (keyCode === keyMap.ESC) {
        this.resetInput()
        return
      }

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
      <div className='relative w-full'>
        <div className='flex flex-wrap gap-2 min-h-[2.5rem]'>
          <TransitionGroup className='flex flex-wrap gap-2'>
            {pills.map(pill =>
              <CSSTransition
                key={pill.id}
                classNames={{
                  enter: 'opacity-0 scale-95',
                  enterActive: 'opacity-100 scale-100 transition-all duration-300',
                  exit: 'opacity-100 scale-100',
                  exitActive: 'opacity-0 scale-95 transition-all duration-200'
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
          {editable && !adding && (
            <Button
              variant='outline'
              onClick={addOnClick}
              className='text-foreground/60 hover:text-foreground/100 b transition-colors p-2 border-2 border-foreground/20 rounded-lg'
            >
              {addLabel}
            </Button>
          )}
        </div>
        {adding && (
          <div className='relative z-10 w-full mt-1'>
            <div className='relative'>
              <input
                ref={this.input}
                type='text'
                className='bg-darkening/20 rounded-lg text-foreground placeholder-foreground/40  w-full p-4 outline-none focus:outline-focus focus:outline-2'
                maxLength='30'
                placeholder={placeholder}
                spellCheck={false}
                onChange={event => this.handleChange(event.target.value)}
                onKeyDown={this.handleKeys}
              />
              <button
                className='absolute right-2 top-1/2 -translate-y-1/2 text-foreground/60 hover:text-foreground/80 p-1'
                onClick={reset}
                type='reset'
              >
                <svg xmlns='http://www.w3.org/2000/svg' className='h-4 w-4' viewBox='0 0 20 20' fill='currentColor'>
                  <path fillRule='evenodd' d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z' clipRule='evenodd' />
                </svg>
              </button>
            </div>
            {!isEmpty(suggestions) && (
              <div className='absolute z-10 w-full mt-1'>
                <KeyControlledItemList
                  spaceChooses={false}
                  items={suggestions}
                  theme={{
                    items: 'mt-1 py-1 bg-background border border-border rounded-lg shadow-lg overflow-auto max-h-60',
                    item: 'px-3 py-2 text-sm text-foreground/80 hover:bg-card/50 cursor-pointer [&_a]:text-foreground/100',
                    itemActive: 'bg-primary/10'
                  }}
                  onChange={this.select}
                  ref={this.list}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
}

export default withTranslation()(Pillbox)
