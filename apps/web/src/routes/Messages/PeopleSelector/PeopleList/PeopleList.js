import { any, arrayOf, func, object, shape, string, number } from 'prop-types'
import React, { useEffect, useRef } from 'react'
import PeopleListItem from '../PeopleListItem'
import classes from './PeopleList.module.scss'

export default function PeopleList ({ currentMatch, onClick, onMouseOver, people, selectedIndex }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (selectedIndex >= 0 && containerRef.current) {
      const container = containerRef.current
      const itemHeight = 56 // height of each item including padding
      const selectedElement = container.children[0].children[selectedIndex]
      
      if (selectedElement) {
        const elementTop = selectedElement.offsetTop
        const elementBottom = elementTop + itemHeight
        const containerTop = container.scrollTop
        const containerBottom = containerTop + container.clientHeight
        
        if (elementTop < containerTop) {
          // Element is above viewport, scroll up
          container.scrollTo({
            top: elementTop,
            behavior: 'smooth'
          })
        } else if (elementBottom > containerBottom) {
          // Element is below viewport, scroll down
          container.scrollTo({
            top: elementBottom - container.clientHeight,
            behavior: 'smooth'
          })
        }
      }
    }
  }, [selectedIndex])

  return (
    <div 
      ref={containerRef}
      className='w-[320px] max-h-[400px] overflow-y-auto overflow-x-clip absolute top-12 bg-theme-background shadow-xl rounded-lg'
    >
      {people && people.length > 0 &&
        <ul className={classes.peopleList}>
          {people.map((person, index) =>
            <PeopleListItem
              key={person.id}
              active={currentMatch && person.id === currentMatch.id}
              person={person}
              onClick={() => onClick(person)}
              onMouseOver={() => onMouseOver(person)}
              className={index === selectedIndex ? 'bg-selected' : ''}
            />)}
        </ul>}
    </div>
  )
}

const personType = shape({
  id: any,
  name: string,
  avatarUrl: string,
  group: string
})

PeopleList.propTypes = {
  onClick: func,
  onMouseOver: func.isRequired,
  currentMatch: object,
  people: arrayOf(personType),
  selectedIndex: number
}
