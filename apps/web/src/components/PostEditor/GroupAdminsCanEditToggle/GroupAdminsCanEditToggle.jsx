import React from 'react'
import { useTranslation } from 'react-i18next'
import { UserPen } from 'lucide-react'
import Tooltip from 'components/Tooltip'
import { cn } from 'util/index'

/**
 * PostEditor ActionsBar icon toggle: lets a group admin allow the other admins (Manage Content)
 * of the post's single group to edit it (#1727). Class names come from ActionsBar so it matches
 * the other action icons.
 */
export default function GroupAdminsCanEditToggle ({
  groupAdminsCanEdit = false,
  toggleGroupAdminsCanEdit,
  groupName,
  className,
  iconClassName,
  activeIconClassName
}) {
  const { t } = useTranslation()
  const label = t('Allow other members who can manage content in {{groupName}} to edit this post.', { groupName })
  return (
    <>
      <button
        type='button'
        className={className}
        onClick={toggleGroupAdminsCanEdit}
        aria-pressed={groupAdminsCanEdit}
        aria-label={label}
        data-tooltip-content={label}
        data-tooltip-id='group-admins-can-edit-tt'
        data-testid='post-editor-group-admins-can-edit'
      >
        <UserPen className={cn(iconClassName, { [activeIconClassName]: groupAdminsCanEdit })} aria-hidden='true' />
      </button>
      <Tooltip delay={10} id='group-admins-can-edit-tt' />
    </>
  )
}
