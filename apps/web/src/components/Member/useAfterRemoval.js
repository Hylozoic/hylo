import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { toast } from 'sonner'
import { RESP_ADD_MEMBERS } from 'store/constants'
import { regenerateAccessCode } from 'routes/GroupSettings/GroupSettings.store'
import { banFromGroup } from 'routes/GroupSettings/MembershipRequestsTab/MembershipRequestsTab.store'

/**
 * What the remove-member dialogs (the Members directory card and the member's
 * profile) offer beyond removing someone (D60): 'Also block from rejoining',
 * and afterwards an offer to reset the join link the person may still have.
 * Blocks apply to groups only, as a block on a group covers its spaces.
 *
 * @param {object} group the group the person is removed from
 * @param {string[]} responsibilities the current user's responsibility titles in it
 * @returns {{ canBlock: boolean, afterRemoval: Function }} afterRemoval({ member, block })
 *   runs once the person has been removed: blocks them when asked to, then offers the reset
 */
export default function useAfterRemoval (group, responsibilities = []) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const canBlock = !!group?.id && group.type !== 'space' && !group.parentId
  const canResetJoinLink = canBlock && responsibilities.includes(RESP_ADD_MEMBERS)

  // The person leaves the list or the page as soon as they are removed, so what follows is told in toasts
  const afterRemoval = useCallback(async ({ member, block }) => {
    if (canBlock && block) {
      const blocked = await Promise.resolve(dispatch(banFromGroup(member.id, group.id)))
        .catch(error => ({ error: true, payload: error }))
      if (blocked?.error) {
        toast.error(t("{{name}} was removed, but couldn't be blocked from rejoining", { name: member.name }))
      }
    }
    if (canResetJoinLink) {
      toast(t('{{name}} was removed', { name: member.name }), {
        description: t('Anyone with the current join link can still use it. Reset it so the old link stops working.'),
        duration: 15000,
        action: {
          label: t('Reset join link'),
          onClick: () => Promise.resolve(dispatch(regenerateAccessCode(group.id)))
            .then(() => toast.success(t('The join link was reset')))
            .catch(() => toast.error(t('There was an error, please try again.')))
        }
      })
    }
  }, [canBlock, canResetJoinLink, dispatch, group?.id, t])

  return { canBlock, afterRemoval }
}
