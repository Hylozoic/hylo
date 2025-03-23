import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { map } from 'lodash'
import Pillbox from '../Pillbox'

import styles from './SuggestedSkills.module.scss'

export default function SuggestedSkills ({ addSkill, currentUser, group, removeSkill }) {
  const [selectedSkills, setSelectedSkills] = useState(currentUser.skills ? currentUser.skills.toRefArray().map(s => s.id) : [])
  const { t } = useTranslation()

  const pills = map(group.suggestedSkills, skill => ({
    ...skill,
    label: skill.name,
    className: selectedSkills.find(s => s === skill.id) ? styles.selectedSkill : '',
    tooltipContent: ''
  }))

  const handleClick = (skillId) => {
    const hasSkill = selectedSkills.includes(skillId)
    if (hasSkill) {
      removeSkill(skillId)
      setSelectedSkills(selectedSkills.filter(s => s !== skillId))
    } else {
      addSkill(group.suggestedSkills.find(s => s.id === skillId).name)
      setSelectedSkills(selectedSkills.concat(skillId))
    }
  }

  return (
    <div className='skillPills bg-muted border border-background rounded p-4 w-full my-3'>
      <h4 className='text-muted-foreground'>{t('Which of the following skills & interests are relevant to you?')}</h4>
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
