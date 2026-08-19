import CopyToClipboard from 'react-copy-to-clipboard'
import { Copy, Info, Mail, UserPlus } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { groupInviteUrl, groupUrl } from '@hylo/navigation'
import { Popover, PopoverContent, PopoverTrigger } from 'components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { regenerateAccessCode as regenerateAccessCodeAction } from 'routes/GroupSettings/GroupSettings.store'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
import { RESP_ADD_MEMBERS } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { cn } from 'util/index'

/**
 * Compact invite affordance: UserPlus trigger opens a popover with public/share
 * links (and Invite By Email). Shown only when the user can add members.
 */
export default function InviteMembersPopover ({
  group,
  className,
  triggerClassName,
  triggerLabel,
  /** When false, parent should use `group` so this fades in on hover. */
  alwaysVisible = false
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADD_MEMBERS,
    groupId: group?.id
  }))
  const [open, setOpen] = useState(false)
  const [copiedPublicLink, setCopiedPublicLink] = useState(false)
  const [copiedInviteLink, setCopiedInviteLink] = useState(false)

  const inviteLink = groupInviteUrl(group)
  const showPublicLink = group?.visibility === GROUP_VISIBILITY.Public &&
    group?.accessibility !== GROUP_ACCESSIBILITY.Closed
  const publicLink = group?.slug ? `${window.location.origin}/groups/${group.slug}` : ''

  const regenerateAccessCode = useCallback(() => {
    if (!group?.id) return
    dispatch(regenerateAccessCodeAction(group.id))
  }, [dispatch, group?.id])

  const setTemporaryCopied = (setter) => {
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const handleInviteByEmail = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    dispatch(toggleNavMenu(false))
    navigate(groupUrl(group.slug, 'settings/invite'))
  }

  const handleGenerateLink = (e) => {
    e.preventDefault()
    e.stopPropagation()
    regenerateAccessCode()
  }

  if (!canAddMembers || !group?.id) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type='button'
              aria-label={t('Invite Members')}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'inline-flex items-center justify-center rounded-md p-1 transition-all',
                'hover:scale-110 hover:bg-background/20',
                !alwaysVisible && !open && '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100',
                (alwaysVisible || open) && 'opacity-100',
                className,
                triggerClassName
              )}
            >
              <UserPlus className='w-4 h-4' />
              {triggerLabel && <span className='ml-1'>{triggerLabel}</span>}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side='top'>{t('Invite Members')}</TooltipContent>
      </Tooltip>

      <PopoverContent
        align='start'
        className='w-80 p-3'
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className='flex flex-col gap-3'>
          {showPublicLink && (
            <InviteLinkRow
              label={t('Public Group Link')}
              helpText={`${t("Use this for people you don't know")} ${t('who you would like ask join questions to vet before they enter the group.')}`}
              link={publicLink}
              copied={copiedPublicLink}
              onCopy={() => setTemporaryCopied(setCopiedPublicLink)}
            />
          )}

          <InviteLinkRow
            label={t('Share a Join Link')}
            helpText={`${t('Use this link to invite people you know and trust.')} ${t('They will still have the opportunity to answer any join questions and agree to agreements before they enter the group.')}`}
            link={inviteLink}
            copied={copiedInviteLink}
            onCopy={() => setTemporaryCopied(setCopiedInviteLink)}
            emptyAction={
              <button
                type='button'
                onClick={handleGenerateLink}
                className='w-full text-left text-sm text-selected hover:underline'
              >
                {t('Generate a Link')}
              </button>
            }
          />

          <button
            type='button'
            onClick={handleInviteByEmail}
            className='flex items-center justify-center gap-2 w-full rounded-lg border-2 border-foreground/20 bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground/50 transition-all'
          >
            <Mail className='w-4 h-4' />
            {t('Invite By Email')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Label + info tooltip + copyable link row for the invite popover.
 */
function InviteLinkRow ({ label, helpText, link, copied, onCopy, emptyAction }) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-center gap-1'>
        <span className='text-sm font-semibold text-foreground'>{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type='button'
              className='inline-flex text-foreground/40 hover:text-foreground/80 transition-colors'
              aria-label={helpText}
              onClick={(e) => e.preventDefault()}
            >
              <Info className='w-3.5 h-3.5' />
            </button>
          </TooltipTrigger>
          <TooltipContent side='top' className='max-w-[16rem] text-xs leading-snug'>
            {helpText}
          </TooltipContent>
        </Tooltip>
      </div>

      {link
        ? (
          <CopyToClipboard text={link} onCopy={onCopy}>
            <button
              type='button'
              className='flex items-center gap-2 w-full rounded-lg border-2 border-foreground/20 bg-card p-2 hover:border-foreground/50 transition-all text-left'
            >
              <span className='flex-1 text-xs text-selected truncate'>{link}</span>
              <span className='flex items-center gap-1 shrink-0 rounded-md bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground'>
                {copied
                  ? t('Copied!')
                  : <><Copy className='w-3 h-3' />{t('Copy')}</>}
              </span>
            </button>
          </CopyToClipboard>
          )
        : emptyAction}
    </div>
  )
}
