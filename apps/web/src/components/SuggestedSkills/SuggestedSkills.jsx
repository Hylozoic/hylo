import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { map } from 'lodash'
import Pillbox from '../Pillbox'
import { addSkill, removeSkill } from 'components/SkillsSection/SkillsSection.store'

import styles from './SuggestedSkills.module.scss'

export default function SuggestedSkills ({ currentUser, group }) {
  const dispatch = useDispatch()
  const [selectedSkills, setSelectedSkills] = useState(currentUser?.skills ? currentUser.skills.toRefArray().map(s => s.id) : [])
  const { t } = useTranslation()

  const pills = map(group.suggestedSkills, skill => ({
    ...skill,
    label: skill.name,
    className: selectedSkills.find(s => s === skill.id) ? styles.selectedSkill : '',
    tooltipContent: ''
  }))

  /** Toggle a suggested skill on the current user's profile. */
  const handleClick = (skillId) => {
    const hasSkill = selectedSkills.includes(skillId)
    if (hasSkill) {
      dispatch(removeSkill(skillId))
      setSelectedSkills(selectedSkills.filter(s => s !== skillId))
    } else {
      const skill = group.suggestedSkills.find(s => s.id === skillId)
      if (!skill) return
      dispatch(addSkill(skill.name))
      setSelectedSkills(selectedSkills.concat(skillId))
    }
  }

  return (
    <div className='skillPills bg-muted border border-background rounded p-4 w-full my-3'>
      <h4 className='text-muted-foreground'>{t('{{group.name}} wants to know which skills and interests are relevant to you?', { group })}</h4>
      <div className='flex flex-wrap gap-2'>
        <Pillbox
          pills={pills}
          handleClick={handleClick}
          editable={false}
        />
      </div>
    </div>
  )
}
