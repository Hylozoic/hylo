import React from 'react'
import { useTranslation } from 'react-i18next'

import SwitchStyled from 'components/SwitchStyled'

/** Toggle for adding current and future group members to a space. */
export default function AutoAddMembersSetting ({ checked, onChange }) {
  const { t } = useTranslation()

  return (
    <div className='flex items-start gap-2'>
      <SwitchStyled
        checked={checked}
        onChange={() => onChange(!checked)}
        backgroundColor={checked ? 'hsl(var(--selected))' : 'rgba(0 0 0 / .6)'}
      />
      <span className='text-sm text-foreground/80'>
        {t('Add everyone currently in this group, and anyone who joins later. People who leave this space will not be added again.')}
      </span>
    </div>
  )
}
