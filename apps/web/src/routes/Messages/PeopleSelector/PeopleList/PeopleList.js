import { any, arrayOf, func, object, shape, string } from 'prop-types'
import React from 'react'
import PeopleListItem from '../PeopleListItem'
import classes from './PeopleList.module.scss'

export default function PeopleList ({ currentMatch, onClick, onMouseOver, people }) {
  return (
    <div className='w-[320px] max-h-[400px] overflow-y-auto overflow-x-clip absolute top-12 bg-theme-background shadow-xl rounded-lg'>
      {people && people.length > 0 &&
        <ul className={classes.peopleList}>
          {people.map(person =>
            <PeopleListItem
              key={person.id}
              active={currentMatch && person.id === currentMatch.id}
              person={person}
              onClick={() => onClick(person)}
              onMouseOver={() => onMouseOver(person)}
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
  people: arrayOf(personType)
}
