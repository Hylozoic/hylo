import { cn } from 'util/index'
import { find, sortBy } from 'lodash/fp'
import React from 'react'
import { useTranslation } from 'react-i18next'

import RoundImageRow from 'components/RoundImageRow'

import classes from './PeopleInfo.module.scss'

export default function PeopleInfo ({
  className,
  constrained,
  people,
  peopleTotal,
  excludePersonId,
  phrases,
  onClick,
  small,
  tiny
}) {
  const { t } = useTranslation()

  const defaultPhrases = {
    emptyMessage: t('Be the first to comment'),
    phraseSingular: t('commented'),
    mePhraseSingular: t('commented'),
    pluralPhrase: t('commentedPlural')
  }

  const mergedPhrases = { ...defaultPhrases, ...phrases }

  const currentUserIsMember = find(c => c.id === excludePersonId, people)
  const sortedPeople = currentUserIsMember && people.length === 2
    ? sortBy(c => c.id !== excludePersonId, people) // me first
    : sortBy(c => c.id === excludePersonId, people) // me last
  const firstName = person => person.id === excludePersonId ? t('You') : person.name.split(' ')[0]
  const {
    emptyMessage,
    phraseSingular,
    mePhraseSingular,
    pluralPhrase
  } = mergedPhrases
  let names = ''
  let phrase = pluralPhrase

  let caption, avatarUrls
  if (sortedPeople.length === 0) {
    caption = emptyMessage
    avatarUrls = []
  } else {
    if (sortedPeople.length === 1) {
      phrase = currentUserIsMember ? mePhraseSingular : phraseSingular
      names = firstName(sortedPeople[0])
    } else if (sortedPeople.length === 2) {
      names = t('{{personOne}} and {{personTwo}}', { personOne: firstName(sortedPeople[0]), personTwo: firstName(sortedPeople[1]) })
    } else {
      names = t(`{{personOne}}, {{personTwo}} and {{othersTotal}} other${peopleTotal - 2 > 1 ? '_plural' : ''}`, { personOne: firstName(sortedPeople[0]), personTwo: firstName(sortedPeople[1]), othersTotal: peopleTotal - 2 })
    }
    caption = `${names} ${phrase}`
    avatarUrls = people.map(p => p.avatarUrl)
  }
  return (
    <div className={cn('flex items-center gap-2 rounded-lg transition-all', classes.peopleContainer, { [classes.constrained]: constrained }, className)}>
      <RoundImageRow imageUrls={avatarUrls.slice(0, 3)} className={classes.people} onClick={onClick} small={small} tiny={tiny} />
      <span className={cn('text-foreground text-sm')} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'inherit' }}>
        {caption}
      </span>
    </div>
  )
}
