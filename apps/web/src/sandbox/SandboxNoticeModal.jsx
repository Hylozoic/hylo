import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shapes } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from 'components/ui/dialog'
import { isSandboxMode, SANDBOX_MUTATION_EVENT } from 'sandbox/isSandbox'
import { claimSandboxDialog, releaseSandboxDialog } from 'sandbox/sandboxDialogLock'

const DIALOG_NAME = 'notice'

const SESSION_KEY = 'hylo-sandbox-notice-seen-kinds'

/**
 * Root fields of mutations the visitor triggers on purpose, mapped to the kind
 * of call to action to show. Background mutations (marking activity read, link
 * previews, location lookups, …) are left out so the modal never pops up
 * without a deliberate click.
 */
const ACTION_KINDS = {
  createPost: 'post',
  updatePost: 'post',
  createComment: 'comment',
  updateComment: 'comment',
  createMessage: 'message',
  reactOn: 'reaction',
  enrollInTrack: 'track',
  // Invite UI: invitations, join links, event invites, group-to-group invites
  createInvitation: 'invite',
  resendInvitation: 'invite',
  reinviteAll: 'invite',
  expireInvitation: 'invite',
  regenerateAccessCode: 'invite',
  allowGroupInvites: 'invite',
  invitePeopleToEvent: 'invite',
  inviteGroupToJoinParent: 'invite',
  invitePeerRelationship: 'invite',
  // Group settings and admin tools
  updateGroupSettings: 'settings',
  deleteGroup: 'settings',
  addGroupRole: 'settings',
  updateGroupRole: 'settings',
  addRoleToMember: 'settings',
  removeRoleFromMember: 'settings',
  addGroupResponsibility: 'settings',
  updateGroupResponsibility: 'settings',
  deleteGroupResponsibility: 'settings',
  addResponsibilityToRole: 'settings',
  removeResponsibilityFromRole: 'settings',
  acceptJoinRequest: 'settings',
  declineJoinRequest: 'settings',
  removeMember: 'settings',
  requestToAddGroupToParent: 'settings',
  acceptGroupRelationshipInvite: 'settings',
  rejectGroupRelationshipInvite: 'settings',
  cancelGroupRelationshipInvite: 'settings',
  deleteGroupRelationship: 'settings',
  createGroupView: 'settings',
  updateGroupView: 'settings',
  deleteGroupView: 'settings',
  reorderGroupView: 'settings',
  setGroupViewHidden: 'settings',
  setHomeView: 'settings',
  deleteSpace: 'settings',
  convertGroupToSpace: 'settings',
  convertSpaceToChildGroup: 'settings',
  addSuggestedSkillToGroup: 'settings',
  removeSuggestedSkillFromGroup: 'settings',
  createStripeConnectedAccount: 'settings',
  createStripeAccountLink: 'settings',
  createStripeOffering: 'settings',
  updateStripeOffering: 'settings',
  grantContentAccess: 'settings',
  revokeContentAccess: 'settings'
}

function readSeenKinds () {
  try {
    const seen = JSON.parse(window.sessionStorage?.getItem(SESSION_KEY) || '[]')
    return new Set(Array.isArray(seen) ? seen : [])
  } catch (e) {
    return new Set()
  }
}

function markKindSeen (kind) {
  try {
    window.sessionStorage?.setItem(SESSION_KEY, JSON.stringify([...readSeenKinds(), kind]))
  } catch (e) { /* storage unavailable */ }
}

/**
 * Demo limitation notice.
 *
 * In sandbox mode, a successful mutation fires SANDBOX_MUTATION_EVENT on window
 * (see sandbox/transport.js). A deliberate action opens this modal with a call
 * to action tailored to what the visitor just did, then steers them to sign up.
 *
 * Each kind of action (post, invite, settings, …) prompts at most once per demo
 * session, tracked in sessionStorage, so repeating it won't spam the visitor.
 * Only one sandbox prompt opens at a time (see sandboxDialogLock.js).
 */
export default function SandboxNoticeModal () {
  const { t } = useTranslation()
  const [actionKind, setActionKind] = useState(null)

  const copy = {
    post: {
      title: t('Nice post!'),
      description: t('In the demo, your post only lives in this browser tab and disappears when you leave. Sign up to share it with a real community.')
    },
    comment: {
      title: t('Thanks for joining the conversation!'),
      description: t("Demo comments aren't seen by anyone else. Sign up to reply to real people in real communities.")
    },
    message: {
      title: t('Your message stays in the demo'),
      description: t('Nobody receives messages sent from the demo. Sign up to chat with real people.')
    },
    reaction: {
      title: t('Glad you liked it!'),
      description: t("Reactions in the demo aren't shared with anyone. Sign up to show your appreciation for real.")
    },
    track: {
      title: t('You joined a track!'),
      description: t('In the full app, tracks guide you and your community through onboarding and learning together. Sign up to save your progress.')
    },
    invite: {
      title: t('Invites are switched off in the demo'),
      description: t('Sign up to create your own group and invite your people.')
    },
    settings: {
      title: t('Settings changes stay in the demo'),
      description: t('Try out every admin tool you like — nothing here is saved. Sign up to create your own group and set it up for real.')
    }
  }[actionKind]

  useEffect(() => {
    if (!isSandboxMode()) return

    const show = (event) => {
      const kind = ACTION_KINDS[event.detail?.rootField]
      if (!kind || readSeenKinds().has(kind)) return
      // Another sandbox prompt is open — skip this action and wait for the next one.
      if (!claimSandboxDialog(DIALOG_NAME)) return
      markKindSeen(kind)
      setActionKind(kind)
    }
    window.addEventListener(SANDBOX_MUTATION_EVENT, show)

    return () => {
      window.removeEventListener(SANDBOX_MUTATION_EVENT, show)
      releaseSandboxDialog(DIALOG_NAME)
    }
  }, [])

  const handleOpenChange = (open) => {
    if (open) return
    setActionKind(null)
    releaseSandboxDialog(DIALOG_NAME)
  }

  return (
    <Dialog open={!!copy} onOpenChange={handleOpenChange}>
      <DialogContent overlayClassName='bg-darkening/30'>
        <DialogHeader className='items-center text-center sm:text-center'>
          <Shapes className='mb-2 h-8 w-8' aria-hidden='true' />
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type='button'
            onClick={() => handleOpenChange(false)}
            className='px-4 py-2 rounded-md border border-foreground/20 hover:bg-foreground/5 transition-colors'
          >
            {t('Keep exploring')}
          </button>
          <a
            href='/signup'
            className='px-4 py-2 rounded-md bg-foreground text-background font-semibold text-center hover:opacity-90 transition-opacity'
          >
            {t('Sign up to unlock the full app')}
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
