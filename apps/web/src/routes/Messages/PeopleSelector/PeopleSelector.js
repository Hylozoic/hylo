import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'
import { debounce, throttle } from 'lodash/fp'
import PeopleList from './PeopleList'
import MatchingPeopleListItem from './MatchingPeopleListItem'

const invalidPersonName = /[^a-z '-]+/gi

export default function PeopleSelector (props) {
  const [currentMatch, setCurrentMatch] = useState(null)
  const [currentText, setCurrentText] = useState('')
  const autocompleteInput = useRef(null)
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(-1) // -1 means input is focused

  const {
    people,
    setPeopleSearch,
    selectedPeople,
    peopleSelectorOpen
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

  const selectPerson = (person) => {
    if (!person) return
    autocompleteInput.current.focus()
    if (selectedPeople.find(p => p.id === person.id)) return
    setPeopleSearch(null)
    setCurrentMatch(null)
    setCurrentText('')
    props.selectPerson(person)
  }

  const removePerson = (person) => {
    props.removePerson(person)
  }

  const autocompleteSearch = throttle(1000, props.fetchPeople)
  const updatePeopleSearch = debounce(200, setPeopleSearch)

  const onChange = (e) => {
    const val = e.target.value
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

  return (
    <div className='w-full relative' tabIndex='0'>
      <div className='w-full relative flex flex-wrap gap-1'>
        <span className='p-2'>{t('New Message With')}:</span>
        {selectedPeople && selectedPeople.map(person =>
          <MatchingPeopleListItem
            avatarUrl={person.avatarUrl}
            name={person.name}
            onClick={() => removePerson(person)}
            key={person.id}
          />
        )}
        <div className='relative'>
          <input
            className='w-[150px] bg-darkening/20 focus:bg-theme-background rounded p-2 text-foreground placeholder:text-foreground/50 border-2 border-transparent focus:border-focus transition-all outline-none'
            ref={autocompleteInput}
            type='text'
            spellCheck={false}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder={`+ ${t('Add someone')}`}
            onFocus={(e) => {
              setSelectedIndex(-1)
              props.onFocus?.(e)
            }}
            value={currentText}
            autoFocus={props.autoFocus}
          />

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
              />
            : ''}
        </div>
      </div>
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
  removePerson: PropTypes.func
}
