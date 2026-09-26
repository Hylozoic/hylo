import { ShieldCheck, UserCheck, Users } from 'lucide-react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SettingSelectRow from 'components/SettingSelectRow/SettingSelectRow'
import Checkbox from 'components/ui/checkbox'
import { Label } from 'components/ui/label'
import { INVITE_POLICY, RESP_ADD_MEMBERS } from 'store/constants'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'
import { groupRolesForPicker } from '@hylo/hooks/groupRoleHelpers'
import { cn } from 'util/index'

// Built-in roles whose fixed responsibilities include Add Members
const ADD_MEMBERS_SYSTEM_ROLES = ['Administrator', 'Host']

function invitePolicyOptions (needsApproval) {
  return [
    {
      value: INVITE_POLICY.everyone,
      icon: Users,
      title: 'Everyone in the group',
      description: needsApproval
        ? 'Every member can send personal email invitations. A steward approves each person they invite before they join.'
        : 'Every member can send personal email invitations, and the people they invite join right away.'
    },
    {
      value: INVITE_POLICY.stewards,
      icon: ShieldCheck,
      title: 'Administrators and Hosts (anyone who can add members)',
      description: 'Only roles that include Add Members can invite people: Administrators, Hosts and any custom role you give it.'
    },
    {
      value: INVITE_POLICY.roles,
      icon: UserCheck,
      title: 'Specific roles',
      description: needsApproval
        ? 'Administrators and Hosts, and anyone in the roles you choose, can invite people. A steward approves each person the chosen roles invite before they join.'
        : 'Administrators and Hosts, and anyone in the roles you choose, can invite people.'
    }
  ]
}

/**
 * The roles a group's "Specific roles" choice can list: its active roles, with
 * the ones that include Add Members locked on because they can always invite.
 */
export function invitePolicyRoles (groupRoles, selectedRoleIds = []) {
  const selected = new Set((selectedRoleIds || []).map(String))
  return groupRolesForPicker(groupRoles).map(role => ({
    id: role.id,
    label: role.label,
    locked: (role.type === 'system' && ADD_MEMBERS_SYSTEM_ROLES.includes(role.name)) ||
      (role.responsibilities?.items || []).some(responsibility => responsibility.title === RESP_ADD_MEMBERS),
    checked: selected.has(role.id)
  }))
}

/**
 * The invite policy to save: 'Specific roles' with no role beyond the locked
 * ones is the same as stewards.
 */
export function invitePolicyToSave (mode, roles) {
  if (mode !== INVITE_POLICY.roles) return { mode }
  const roleIds = roles.filter(role => role.checked).map(role => role.id)
  if (!roles.some(role => role.checked && !role.locked)) return { mode: INVITE_POLICY.stewards }
  return { mode, roleIds }
}

/**
 * "Who can add new members?": everyone in the group, only roles with Add Members,
 * or those plus chosen roles. `roles` ({ id, label, locked, checked }) are listed
 * when specific roles are chosen.
 */
export default function InvitePolicySelect ({ mode, onModeChange, roles = [], onToggleRole, accessibility, hint, popoverClassName }) {
  const { t } = useTranslation()
  const needsApproval = accessibility !== GROUP_ACCESSIBILITY.Open
  const options = useMemo(() => invitePolicyOptions(needsApproval), [needsApproval])

  return (
    <div className='flex flex-col gap-3'>
      <SettingSelectRow
        label='Who can add new members?'
        value={mode}
        onChange={onModeChange}
        options={options}
        popoverClassName={popoverClassName}
      />
      {mode === INVITE_POLICY.roles && (
        <div className='flex flex-col gap-2 pl-12'>
          {roles.map(role => {
            const inputId = `invite-policy-role-${role.id}`
            return (
              <div key={role.id} className='flex items-center gap-2'>
                <Checkbox
                  id={inputId}
                  checked={role.locked || role.checked}
                  disabled={role.locked}
                  onCheckedChange={() => onToggleRole(role.id)}
                />
                <Label htmlFor={inputId} className={cn('font-normal', !role.locked && 'cursor-pointer')}>
                  {role.label}
                </Label>
                {role.locked && <span className='text-xs text-foreground/50'>{t('Can always invite')}</span>}
              </div>
            )
          })}
          {hint && <p className='text-xs text-foreground/60 m-0'>{hint}</p>}
        </div>
      )}
    </div>
  )
}
