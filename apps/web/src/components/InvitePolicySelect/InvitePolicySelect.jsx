import { ShieldCheck, Users } from 'lucide-react'
import React, { useMemo } from 'react'
import SettingSelectRow from 'components/SettingSelectRow/SettingSelectRow'
import { INVITE_POLICY } from 'store/constants'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'

function invitePolicyOptions (needsApproval) {
  return [
    {
      value: INVITE_POLICY.everyone,
      icon: Users,
      title: 'Everyone in the Group',
      description: needsApproval
        ? 'Every member can invite people. A steward approves each person before they join.'
        : 'Every member can invite people, and the people they invite join right away.'
    },
    {
      value: INVITE_POLICY.stewards,
      icon: ShieldCheck,
      title: 'Stewards with the Add Members responsibility',
      description: 'Only roles that include Add Members can invite people: Administrators, Hosts and any custom role you give it.'
    }
  ]
}

/**
 * "Who can add new members?": everyone in the group, or only roles with Add Members.
 */
export default function InvitePolicySelect ({ mode, onModeChange, accessibility, popoverClassName }) {
  const needsApproval = accessibility !== GROUP_ACCESSIBILITY.Open
  const options = useMemo(() => invitePolicyOptions(needsApproval), [needsApproval])

  return (
    <SettingSelectRow
      label='Who can add new members?'
      value={mode || INVITE_POLICY.stewards}
      onChange={onModeChange}
      options={options}
      popoverClassName={popoverClassName}
    />
  )
}
