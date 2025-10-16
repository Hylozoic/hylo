import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { get, isEmpty } from 'lodash/fp'
import { cn } from 'util/index'
import { Link } from 'react-router-dom'
import { groupUrl } from '@hylo/navigation'
import GroupsList from 'components/GroupsList'
import Icon from 'components/Icon'
import classes from './PostGroups.module.scss'

function PostGroups ({ groups = [], isPublic, constrained, slug, showBottomBorder }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const groupsWithPublic = useMemo(() => {
    if (isPublic) {
      return [{ name: 'Public', id: 'public', avatarUrl: '/public-icon.svg', slug: 'public' }, ...groups]
    }
    return groups
  }, [groups, isPublic])

  const toggleExpanded = () => setExpanded(prev => !prev)

  // don't show if there are no groups or this isn't cross posted
  if (isEmpty(groupsWithPublic) || (groupsWithPublic.length === 1 && get('0.slug', groupsWithPublic) === slug)) return null

  return (
    <div className={cn('rounded-t-lg bg-darkening/10 p-2 mx-[8px] rounded-lg mt-2 mb-2', { [classes.constrained]: constrained, [classes.expanded]: expanded, [classes.bottomBorder]: showBottomBorder })}>
      <div className={classes.row}>
        <span className={classes.label}>{`${t('To')}:`}&nbsp;</span>
        {!expanded &&
          <LinkedGroupNameList t={t} groups={groupsWithPublic} maxShown={2} expandFunc={toggleExpanded} />}
        <a onClick={toggleExpanded} className={classes.expandLink} role='button' aria-label={expanded ? 'collapse' : 'expand'}>
          <Icon name={expanded ? 'ArrowUp' : 'ArrowDown'} className='text-foreground/60 hover:text-foreground' />
        </a>
      </div>

      {expanded && <GroupsList groups={groupsWithPublic} />}
    </div>
  )
}

export function LinkedGroupNameList ({ groups, maxShown = 2, expandFunc, t }) {
  const groupsToDisplay = (maxShown && maxShown <= groups.length)
    ? groups.slice(0, maxShown)
    : groups
  const othersCount = groups.length - groupsToDisplay.length

  return (
    <span className={classes.groupList}>
      {groupsToDisplay.map((group, i) =>
        <LinkedGroupName group={group} key={i}>
          <Separator currentIndex={i} displayCount={groupsToDisplay.length} t={t} othersCount={othersCount} />
        </LinkedGroupName>)}
      {othersCount > 0 &&
        <Others othersCount={othersCount} expandFunc={expandFunc} />}
    </span>
  )
}

export function LinkedGroupName ({ group, children }) {
  return (
    <span key={group.id}>
      <Link to={groupUrl(group.slug)} className='text-foreground/80 hover:text-selected font-bold group transition-all hover:scale-110'>{group.name === 'Public' && <Icon name='Public' className='text-foreground/80 group-hover:text-selected transition-all' dataTestId='icon-Public' />} {group.name}</Link>
      {children}
    </span>
  )
}

export function Separator ({ currentIndex, displayCount, othersCount, t }) {
  const isLastEntry = currentIndex === displayCount - 1
  const isNextToLastEntry = currentIndex === Math.max(0, displayCount - 2)
  const hasOthers = othersCount > 0

  if (isLastEntry) return null
  if (!hasOthers && isNextToLastEntry) return <span key='and'> {t('and')} </span>

  return <span>, </span>
}

export function Others ({ othersCount, expandFunc }) {
  const { t } = useTranslation()
  if (othersCount < 0) return null

  const phrase = othersCount === 1 ? t('1 other') : t('{{othersCount}} others', { othersCount })

  return (
    <>
      <span key='and'> {t('and')} </span>
      <a key='others' className='text-foreground/80 hover:text-selected font-bold transition-all hover:scale-105' onClick={expandFunc}>{phrase}</a>
    </>
  )
}

export default PostGroups
