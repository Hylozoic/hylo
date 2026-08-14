import { any, arrayOf, func, object, shape, string, number } from 'prop-types'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PeopleListItem from '../PeopleListItem'
import classes from './PeopleList.module.scss'

export default function PeopleList ({ currentMatch, onClick, onMouseOver, people, selectedIndex, inputElement }) {
  const containerRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  // Mount portal on client side only
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate position for portal rendering (fixed positioning uses viewport coordinates)
  useEffect(() => {
    if (inputElement) {
      const updatePosition = () => {
        const rect = inputElement.getBoundingClientRect()
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        })
      }

      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      // Adding pills reflows the input inside its row — track it, not just the window
      const observer = new ResizeObserver(updatePosition)
      observer.observe(inputElement)
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
        observer.disconnect()
      }
    }
  }, [inputElement, people])

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

  // Phones get the input's full width; desktop keeps the compact 320px list
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640
  const dropdownContent = (
    <div
      ref={containerRef}
      className='w-full max-h-[400px] overflow-y-auto overflow-x-clip bg-card shadow-xl rounded-lg'
      tabIndex='-1'
      style={{ pointerEvents: 'auto' }}
    >
      {people && people.length > 0 &&
        <ul className={classes.peopleList} tabIndex='-1'>
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

  // Use portal to render outside overflow container if inputElement is provided (non-mobile)
  // Otherwise use normal absolute positioning (mobile)
  if (mounted && inputElement && typeof document !== 'undefined') {
    return createPortal(
      <div
        data-people-selector-dropdown=''
        className='fixed z-[100]'
        // Narrow screens: span the viewport (small gutter) rather than the input,
        // which shares its row with the back chevron
        style={narrow
          ? { top: `${position.top}px`, left: '8px', width: 'calc(100vw - 16px)' }
          : { top: `${position.top}px`, left: `${position.left}px`, width: '320px' }}
      >
        {dropdownContent}
      </div>,
      document.body
    )
  }

  // Mobile: use absolute positioning relative to parent
  return (
    <div data-people-selector-dropdown='' className='absolute top-12 z-[100] left-0 right-0'>
      {dropdownContent}
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
