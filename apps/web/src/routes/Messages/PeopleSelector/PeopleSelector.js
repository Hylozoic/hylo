import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { debounce, throttle } from 'lodash/fp'
import Loading from 'components/Loading'
import PeopleList from './PeopleList'
import MatchingPeopleListItem from './MatchingPeopleListItem'
import { cn } from 'util/index'
import { MAX_MESSAGE_THREAD_PARTICIPANTS } from '../messageThreadLimits'

const invalidPersonName = /[^a-z '-]+/gi

export default function PeopleSelector (props) {
  const [currentMatch, setCurrentMatch] = useState(null)
  const [currentText, setCurrentText] = useState('')
  const internalInputRef = useRef(null)
  const autocompleteInput = props.inputRef || internalInputRef
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(-1) // -1 means input is focused

  const {
    people,
    setPeopleSearch,
    selectedPeople,
    peopleSelectorOpen,
    maxParticipantsReached
  } = props

  useEffect(() => {
    props.fetchDefaultList()
  }, [])

  useMemo(() => {
    if (!people || people.length === 0) {
      setCurrentMatch(null)
      return
    }

    if (people.find(m => currentMatch && m.id === currentMatch.id)) return
    setCurrentMatch(people[0])
  }, [people])

  // exclude selected people from people list
  const finalPeopleList = useMemo(() => {
    if (!people) return []
    if (!selectedPeople || selectedPeople.length === 0) return people
    const selectedPeopleIds = selectedPeople.map(p => p.id)
    return people.filter(c => !selectedPeopleIds.includes(c.id))
  }, [people, selectedPeople])

  // Refocusing after a selection must not count as a fresh focus (which would
  // reopen the dropdown) — the flag suppresses exactly that one focus event.
  const justSelectedRef = useRef(false)

  const selectPerson = (person) => {
    if (!person || maxParticipantsReached) return
    justSelectedRef.current = true
    setTimeout(() => { justSelectedRef.current = false }, 150)
    autocompleteInput.current.focus()
    if (selectedPeople.find(p => p.id === person.id)) return
    setPeopleSearch(null)
    setCurrentMatch(null)
    setCurrentText('')
    props.selectPerson(person)
    props.onPersonSelected?.()
  }

  const removePerson = (person) => {
    props.removePerson(person)
  }

  const autocompleteSearch = throttle(1000, props.fetchPeople)
  const updatePeopleSearch = debounce(200, setPeopleSearch)

  const onChange = (e) => {
    const val = e.target.value
    // Typing (re)opens the dropdown after a selection closed it
    props.onTyping?.()
    if (!invalidPersonName.exec(val)) {
      setCurrentText(val)
      autocompleteSearch(val)
      return updatePeopleSearch(val)
    }
    setCurrentText(val.replace(invalidPersonName, ''))
  }

  const handleKeyDown = (evt) => {
    if (!finalPeopleList.length) return

    switch (evt.key) {
      case 'ArrowDown':
        evt.preventDefault()
        setSelectedIndex(prev => {
          const nextIndex = prev + 1
          // Don't go past the end of the list
          return Math.min(nextIndex, finalPeopleList.length - 1)
        })
        setCurrentMatch(finalPeopleList[selectedIndex + 1])
        break

      case 'ArrowUp':
        evt.preventDefault()
        setSelectedIndex(prev => {
          const nextIndex = prev - 1
          // -1 means focus back to input
          return Math.max(nextIndex, -1)
        })
        setCurrentMatch(selectedIndex > 0 ? finalPeopleList[selectedIndex - 1] : null)
        break

      case 'Enter':
        evt.preventDefault()
        if (selectedIndex >= 0 && finalPeopleList[selectedIndex]) {
          selectPerson(finalPeopleList[selectedIndex])
          setSelectedIndex(-1)
        }
        break

      default:
        // Reset selection when typing
        setSelectedIndex(-1)
        break
    }
  }

  // No recipients yet: invite starting the message. With recipients: offer more.
  const inputPlaceholder = props.placeholder || (
    maxParticipantsReached
      ? t('Group limit reached')
      : selectedPeople?.length > 0
        ? t('+ Add someone...')
        : t('Send a new message to...')
  )

  return (
    <div className='w-full relative' tabIndex='0'>
      <div className='w-full relative flex flex-wrap gap-1'>
        {selectedPeople && selectedPeople.map(person =>
          <MatchingPeopleListItem
            avatarUrl={person.avatarUrl}
            name={person.name}
            onClick={() => removePerson(person)}
            key={person.id}
          />
        )}
        <div className='relative flex-1 min-w-[150px] sm:max-w-[320px]'>
          <input
            className={cn(
              'w-full bg-darkening/20 focus:bg-input rounded p-2 text-foreground placeholder:text-foreground/50 border-2 border-transparent focus:border-focus transition-all outline-none',
              props.loading && 'pr-9'
            )}
            ref={autocompleteInput}
            type='text'
            spellCheck={false}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            disabled={maxParticipantsReached}
            onFocus={(e) => {
              setSelectedIndex(-1)
              if (justSelectedRef.current) {
                justSelectedRef.current = false
                return
              }
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              // Delay so a mousedown on the dropdown can select before we close
              const related = e.relatedTarget
              setTimeout(() => {
                if (justSelectedRef.current) return
                const dropdown = document.querySelector('[data-people-selector-dropdown]')
                if (dropdown?.contains(document.activeElement) || dropdown?.contains(related)) return
                if (document.activeElement === autocompleteInput.current) return
                props.onBlur?.(e)
              }, 0)
            }}
            value={currentText}
            autoFocus={props.autoFocus}
          />
          {props.loading && (
            <div className='absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none'>
              <Loading type='inline' size={18} />
            </div>
          )}

          {peopleSelectorOpen
            ? <PeopleList
                people={finalPeopleList}
                currentMatch={currentMatch}
                onClick={selectPerson}
                onMouseOver={(person) => {
                  setCurrentMatch(person)
                  setSelectedIndex(finalPeopleList.findIndex(p => p.id === person.id))
                }}
                selectedIndex={selectedIndex}
                inputElement={autocompleteInput.current}
                dropdownClassName={props.dropdownClassName}
                hasMore={props.hasMore}
                onLoadMore={props.onLoadMore}
              />
            : ''}
        </div>
      </div>
      {maxParticipantsReached && (
        <p className='text-xs text-foreground/60 mt-1 px-2'>
          {t('Group messages are limited to {{count}} people', { count: MAX_MESSAGE_THREAD_PARTICIPANTS })}
        </p>
      )}
    </div>
  )
}

PeopleSelector.propTypes = {
  people: PropTypes.array,
  fetchPeople: PropTypes.func,
  fetchDefaultList: PropTypes.func,
  setPeopleSearch: PropTypes.func,
  selectedPeople: PropTypes.array,
  selectPerson: PropTypes.func.isRequired,
  removePerson: PropTypes.func,
  inputRef: PropTypes.object,
  autoFocus: PropTypes.bool,
  maxParticipantsReached: PropTypes.bool,
  placeholder: PropTypes.string,
  dropdownClassName: PropTypes.string,
  loading: PropTypes.bool,
  hasMore: PropTypes.bool,
  onLoadMore: PropTypes.func
}
