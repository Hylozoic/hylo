import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import SwitchStyled from 'components/SwitchStyled'

/** Lets a group admin allow the other admins (Manage Content) of the post's single group to edit it (#1727). */
export default function GroupAdminsCanEditToggle ({ groupAdminsCanEdit = false, toggleGroupAdminsCanEdit, groupName }) {
  const { t } = useTranslation()
  return (
    <div
      className={cn('w-full flex gap-2 text-xs cursor-pointer rounded', groupAdminsCanEdit ? 'text-foreground' : 'text-foreground/50 hover:text-foreground')}
      onClick={toggleGroupAdminsCanEdit}
      role='switch'
      aria-checked={groupAdminsCanEdit}
      data-testid='post-editor-group-admins-can-edit'
    >
      <SwitchStyled
        checked={groupAdminsCanEdit}
        onChange={toggleGroupAdminsCanEdit}
        backgroundColor={groupAdminsCanEdit ? 'hsl(var(--selected))' : 'hsl(var(--foreground))'}
      />
      <span>
        {groupAdminsCanEdit
          ? t('Group admins can edit - Members who manage content in {{groupName}} can also edit this post.', { groupName })
          : t('Let group admins edit - Allow members who manage content in {{groupName}} to edit this post.', { groupName })}
      </span>
    </div>
  )
}
