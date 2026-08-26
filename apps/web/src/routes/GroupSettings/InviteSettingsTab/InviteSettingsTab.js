import isMobile from 'ismobilejs'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import TextareaAutosize from 'react-textarea-autosize'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Tooltip } from 'react-tooltip'
import { TextHelpers } from '@hylo/shared'
import { groupInviteUrl } from '@hylo/navigation'
import { isEmpty } from 'lodash'
import { TransitionGroup, CSSTransition } from 'react-transition-group'
import Button from 'components/Button'
import Icon from 'components/Icon'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import PeopleSelector from 'routes/Messages/PeopleSelector'
import { cn } from 'util/index'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import getMe from 'store/selectors/getMe'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { regenerateAccessCode as regenerateAccessCodeAction } from '../GroupSettings.store'
import {
  CREATE_INVITATIONS,
  FETCH_INVITEABLE_PEOPLE,
  INVITEABLE_PEOPLE_PAGE_SIZE,
  createInvitations as createInvitationsAction,
  fetchInviteablePeople,
  fetchPendingInvitations,
  getPendingInvites,
  expireInvitation as expireInvitationAction,
  resendInvitation as resendInvitationAction,
  reinviteAll as reinviteAllAction
} from './InviteSettingsTab.store'

import classes from './InviteSettingsTab.module.scss'

const { bool, object } = PropTypes

const parseEmailList = emails =>
  (emails || '').split(/,|\n/).map(email => {
    const trimmed = email.trim()
    const match = trimmed.match(/.*<(.*)>/)
    return match ? match[1] : trimmed
  })

function InviteSettingsTab (props) {
  const { group, inModal = false, parentGroup } = props
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const pendingCreateFromStore = useSelector(state => state.pending[CREATE_INVITATIONS])
  const pendingCreate = !!(props.pendingCreate || pendingCreateFromStore)
  const pendingPeople = useSelector(state => !!state.pending[FETCH_INVITEABLE_PEOPLE])
  const pendingInvites = useSelector(state => getPendingInvites(state, { groupId: group.id }))
  const storeGroup = useSelector(state => {
    if (!group?.id) return null
    return orm.session(state.orm).Group.withId(group.id)?.ref || null
  })
  const parentGroupFromStore = useSelector(state => {
    const id = parentGroup?.id || group?.parentId
    if (!id) return null
    return orm.session(state.orm).Group.withId(id)?.ref || parentGroup || null
  })
  const inviteLink = groupInviteUrl(storeGroup || group)
  const isSpace = group.type === GROUP_TYPES.space || !!group.parentId
  const parentGroupId = parentGroup?.id || group.parentId
  const parentName = parentGroup?.name || parentGroupFromStore?.name

  const regenerateAccessCode = useCallback(() => dispatch(regenerateAccessCodeAction(group.id)), [dispatch, group.id])
  const createInvitations = useCallback((emails, message, groupRoleId, userIds) => dispatch(createInvitationsAction(group.id, emails, message, groupRoleId, userIds)), [dispatch, group.id])
  const expireInvitation = useCallback((invitationToken) => dispatch(expireInvitationAction(invitationToken)), [dispatch])
  const resendInvitation = useCallback((invitationToken) => dispatch(resendInvitationAction(invitationToken)), [dispatch])
  const reinviteAll = useCallback(() => dispatch(reinviteAllAction(group.id)), [dispatch, group.id])
  const trackAnalyticsEventDispatch = useCallback((eventNames, analyticsData) => dispatch(trackAnalyticsEvent(eventNames, analyticsData)), [dispatch])

  const { t } = useTranslation()

  const defaultMessage = t(`Hi!

I'm inviting you to join {{name}} on Hylo.

{{name}} is using Hylo for our online community: this is our dedicated space for communication & collaboration.`, { name: group.name })

  const [copiedPublicLink, setCopiedPublicLink] = useState(false)
  const [copiedInviteLink, setCopiedInviteLink] = useState(false)
  const [reset, setReset] = useState(false)
  const [emails, setEmails] = useState('')
  const [message, setMessage] = useState(defaultMessage)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [people, setPeople] = useState([])
  const [selectedPeople, setSelectedPeople] = useState([])
  const [peopleSelectorOpen, setPeopleSelectorOpen] = useState(false)
  const [hasMorePeople, setHasMorePeople] = useState(false)
  const sendingRef = useRef(false)
  const pendingInvitesTransitionRef = useRef(null)
  const peopleSearchRef = useRef('')
  const peopleOffsetRef = useRef(0)
  const peopleFetchGenRef = useRef(0)
  const loadingMorePeopleRef = useRef(false)
  const hasMorePeopleRef = useRef(false)
  hasMorePeopleRef.current = hasMorePeople

  const setTemporaryState = (setter, value) => {
    setter(value)
    setTimeout(() => {
      setter(false)
    }, 3000)
  }

  /**
   * Maps a fetchInviteablePeople response to person records and whether more pages exist.
   */
  const parseInviteablePeopleResponse = useCallback((response) => {
    const pageHasMore = (querySet, rawCount) => (
      typeof querySet?.hasMore === 'boolean'
        ? querySet.hasMore
        : rawCount >= INVITEABLE_PEOPLE_PAGE_SIZE
    )
    if (isSpace && parentGroupId) {
      const members = response?.payload?.data?.group?.members
      const rawItems = members?.items || []
      return {
        items: rawItems.filter(p => String(p.id) !== String(currentUser?.id)),
        hasMore: pageHasMore(members, rawItems.length)
      }
    }
    const connections = response?.payload?.data?.connections
    const rawItems = connections?.items || []
    return {
      items: rawItems
        .map(c => c.person)
        .filter(p => p && String(p.id) !== String(currentUser?.id)),
      hasMore: pageHasMore(connections, rawItems.length)
    }
  }, [currentUser?.id, isSpace, parentGroupId])

  /**
   * Loads one page of inviteable people: connections (groups) or parent members (spaces).
   */
  const fetchPeopleForInvite = useCallback(async (autocomplete = '') => {
    const search = typeof autocomplete === 'string' ? autocomplete : ''
    peopleSearchRef.current = search
    peopleOffsetRef.current = 0
    loadingMorePeopleRef.current = false
    const gen = ++peopleFetchGenRef.current
    const response = await dispatch(fetchInviteablePeople({
      groupId: group.id,
      parentGroupId: isSpace ? parentGroupId : undefined,
      autocomplete: search,
      first: INVITEABLE_PEOPLE_PAGE_SIZE,
      offset: 0
    }))
    if (gen !== peopleFetchGenRef.current) return
    const { items, hasMore } = parseInviteablePeopleResponse(response)
    peopleOffsetRef.current = INVITEABLE_PEOPLE_PAGE_SIZE
    setPeople(items)
    setHasMorePeople(!!hasMore)
  }, [dispatch, group.id, isSpace, parentGroupId, parseInviteablePeopleResponse])

  /**
   * Appends the next page of inviteable people when the picker list is scrolled to the bottom.
   */
  const handleLoadMorePeople = useCallback(async () => {
    if (loadingMorePeopleRef.current || !hasMorePeopleRef.current) return
    loadingMorePeopleRef.current = true
    const gen = peopleFetchGenRef.current
    const offset = peopleOffsetRef.current
    const response = await dispatch(fetchInviteablePeople({
      groupId: group.id,
      parentGroupId: isSpace ? parentGroupId : undefined,
      autocomplete: peopleSearchRef.current,
      first: INVITEABLE_PEOPLE_PAGE_SIZE,
      offset
    }))
    if (gen !== peopleFetchGenRef.current) {
      loadingMorePeopleRef.current = false
      return
    }
    const { items, hasMore } = parseInviteablePeopleResponse(response)
    peopleOffsetRef.current = offset + INVITEABLE_PEOPLE_PAGE_SIZE
    setPeople(prev => {
      const seen = new Set(prev.map(p => String(p.id)))
      return [...prev, ...items.filter(p => !seen.has(String(p.id)))]
    })
    setHasMorePeople(!!hasMore)
    loadingMorePeopleRef.current = false
  }, [dispatch, group.id, isSpace, parentGroupId, parseInviteablePeopleResponse])

  const fetchDefaultPeopleList = useCallback(() => {
    fetchPeopleForInvite('')
  }, [fetchPeopleForInvite])

  const handleSelectPerson = useCallback((person) => {
    setSelectedPeople(prev => prev.find(p => p.id === person.id) ? prev : [...prev, person])
  }, [])

  const handleRemovePerson = useCallback((person) => {
    setSelectedPeople(prev => prev.filter(p => p.id !== person.id))
  }, [])

  const handleSendInvites = () => {
    if (sendingRef.current) return
    sendingRef.current = true

    let groupRoleId = null
    if (selectedRoleId) {
      groupRoleId = parseInt(selectedRoleId, 10)
    }

    const userIds = selectedPeople.map(p => p.id)
    const emailList = parseEmailList(emails).filter(Boolean)
    createInvitations(emailList, message, groupRoleId, userIds)
      .then(res => {
        sendingRef.current = false
        if (!res?.payload?.data?.createInvitation) return
        const { invitations } = res.payload.data.createInvitation
        const badEmails = invitations.filter(email => email.error).map(e => e.email)

        const numBad = badEmails.length
        let errorMessage, successMessage
        if (numBad > 0) {
          errorMessage = `${t('{{numBad}} invalid email address/es found (see above)).', { numBad })}{' '}`
        }
        const numGood = invitations.length - badEmails.length
        if (numGood > 0) {
          successMessage = numGood === 1
            ? t('Sent 1 invite')
            : t('Sent {{numGood}} invites', { numGood })
          trackAnalyticsEventDispatch('Group Invitations Sent', { numGood })
        }
        setEmails(badEmails.join('\n'))
        setErrorMessage(errorMessage)
        setSuccessMessage(successMessage)
        setSelectedRoleId('')
        setSelectedPeople([])
        if (userIds.length > 0) {
          setPeople(prev => prev.filter(p => !userIds.includes(p.id)))
        }
        dispatch(fetchPendingInvitations(group.id))
      })
      .catch(() => {
        sendingRef.current = false
      })
  }

  const onReset = () => {
    if (window.confirm(t("Are you sure you want to create a new join link? The current link won't work anymore if you do."))) {
      regenerateAccessCode()
      setTemporaryState(setReset, true)
    }
  }

  const onCopyPublicLink = () => setTemporaryState(setCopiedPublicLink, true)
  const onCopyInviteLink = () => setTemporaryState(setCopiedInviteLink, true)

  const buttonColor = highlight => highlight ? 'green' : 'green-white-green-border'

  const disableSendBtn = ((isEmpty(emails) && selectedPeople.length === 0) || pendingCreate)

  const resendAllOnClick = useCallback(() => {
    if (window.confirm(t('Are you sure you want to resend all Pending Invitations'))) {
      reinviteAll()
    }
  }, [reinviteAll])

  const expireOnClick = useCallback((invitationToken) => {
    expireInvitation(invitationToken)
  }, [expireInvitation])

  const resendOnClick = useCallback((invitationToken) => {
    resendInvitation(invitationToken)
  }, [resendInvitation])

  const hasPendingInvites = !isEmpty(pendingInvites)
  const peopleForSelector = useMemo(() => {
    const invitedIds = new Set(pendingInvites.map(i => i.userId != null && String(i.userId)).filter(Boolean))
    const invitedNames = new Set(pendingInvites.map(i => i.name && i.name.toLowerCase()).filter(Boolean))
    const invitedEmails = new Set(pendingInvites.map(i => i.email && i.email.toLowerCase()).filter(Boolean))
    return people.filter(p => {
      if (invitedIds.has(String(p.id))) return false
      if (p.email && invitedEmails.has(String(p.email).toLowerCase())) return false
      if (p.name && invitedNames.has(p.name.toLowerCase())) return false
      return true
    })
  }, [people, pendingInvites])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    if (inModal) return
    setHeaderDetails({
      title: t('Invite People'),
      icon: 'People',
      info: ''
    })
  }, [inModal, setHeaderDetails, t])

  useEffect(() => {
    if (group?.id) dispatch(fetchPendingInvitations(group.id))
  }, [dispatch, group?.id])

  return (
    <div className={classes.container}>
      {!isSpace && group.visibility === GROUP_VISIBILITY.Public && group.accessibility !== GROUP_ACCESSIBILITY.Closed && (
        <div className='border-2 p-4 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-2 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
          <div className='text-foreground'>
            <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Public Group Link')}</h2>
            <div className='text-sm'><strong>{t('Use this for people you don\'t know')}</strong> <span className='text-foreground/50'>{t('who you would like ask join questions to vet before they enter the group.')}</span></div>
          </div>
          <div className='min-w-0 w-full overflow-hidden'>
            <CopyToClipboard text={`${window.location.origin}/groups/${group.slug}`} onCopy={onCopyPublicLink}>
              <button className='flex items-center group gap-2 min-w-0 w-full max-w-full bg-card border-2 border-foreground/20 rounded-lg p-2 hover:border-foreground/50 transition-all hover:cursor-pointer' data-tooltip-content={!copiedPublicLink ? t('Click to Copy') : undefined} data-tooltip-id='public-link-tooltip'>
                <span className='min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis' dir='rtl'>
                  <bdi className='text-selected'>{`${window.location.origin}/groups/${group.slug}`}</bdi>
                </span>
                <div className='flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all shrink-0'>
                  {copiedPublicLink
                    ? <>{t('Copied!')}</>
                    : <><Icon name='Copy' /> {t('Copy')}</>}
                </div>
              </button>
            </CopyToClipboard>
            {!isMobile.any && (
              <Tooltip
                place='top'
                type='dark'
                id='public-link-tooltip'
                effect='solid'
                delayShow={500}
              />
            )}
          </div>
        </div>
      )}

      <div className='border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
        <div className='text-foreground'>
          <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Share a Join Link')}</h2>
          <div className='text-sm'><strong>{t('Use this link to invite people you know and trust.')}</strong> <span className='text-foreground/50'>{t('They will still have the opportunity to answer any join questions and agree to agreements before they enter the group.')}</span></div>
        </div>
        <div className='flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 w-full'>
          {inviteLink && (
            <div className='min-w-0 w-full sm:flex-1 overflow-hidden'>
              <CopyToClipboard text={inviteLink} onCopy={onCopyInviteLink}>
                <button className='flex relative items-center group gap-2 min-w-0 w-full max-w-full bg-card border-2 border-foreground/20 rounded-lg p-2 hover:border-foreground/50 transition-all hover:cursor-pointer' data-tooltip-content={!copiedInviteLink ? t('Click to Copy') : undefined} data-tooltip-id='invite-link-tooltip'>
                  <span className='min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis' dir='rtl'>
                    <bdi className='text-selected'>{inviteLink}</bdi>
                  </span>
                  <div className='flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all shrink-0'>
                    {copiedInviteLink
                      ? <>{t('Copied!')}</>
                      : <><Icon name='Copy' /> {t('Copy')}</>}
                  </div>
                </button>
              </CopyToClipboard>
              {!isMobile.any && (
                <Tooltip
                  place='top'
                  type='dark'
                  id='invite-link-tooltip'
                  effect='solid'
                  delayShow={500}
                />
              )}
            </div>
          )}
          <button onClick={onReset} className='flex items-center justify-center text-nowrap shrink-0 group gap-2 bg-card border-2 border-accent/20 text-accent rounded-lg p-3 hover:border-foreground/50 transition-all hover:cursor-pointer text-sm w-full sm:w-auto' color={buttonColor(reset)}>
            {inviteLink ? t('Reset Link') : t('Generate a Link')}
          </button>
        </div>
      </div>

      <div className='border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
        <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>
          {t('Invite people on Hylo')}
        </h2>
        <span className='text-sm text-foreground/50'>
          {isSpace
            ? t('Search members of {{name}} who aren\'t already in this space.', { name: parentName || t('the group') })
            : t('Search people you\'re connected with who aren\'t already members.')}
        </span>
        <PeopleSelector
          placeholder={isSpace
            ? t('Search members of {{name}}...', { name: parentName || t('the group') })
            : t('Search people you know...')}
          fetchPeople={fetchPeopleForInvite}
          fetchDefaultList={fetchDefaultPeopleList}
          setPeopleSearch={() => {}}
          people={peopleForSelector}
          selectedPeople={selectedPeople}
          selectPerson={handleSelectPerson}
          removePerson={handleRemovePerson}
          peopleSelectorOpen={peopleSelectorOpen}
          onFocus={() => setPeopleSelectorOpen(true)}
          onTyping={() => setPeopleSelectorOpen(true)}
          onBlur={() => setPeopleSelectorOpen(false)}
          dropdownClassName={inModal ? 'z-[200]' : undefined}
          loading={pendingPeople}
          hasMore={hasMorePeople}
          onLoadMore={handleLoadMorePeople}
        />
        <h2 className='text-lg font-bold mt-4 mb-1 text-foreground'>
          {t('Send Invites via email')}
        </h2>
        <span className='text-sm text-foreground/50'>{t('An email invitation link will be sent to each email address, which allows them to bypass the group approval process. They will still be shown any required questions or agreements you may have set.')}</span>
        <p>{t('Enter email addresses separated by commas or new lines')}</p>
        <TextareaAutosize
          minRows={1}
          className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
          placeholder={t('example@domain.com, secondexample@domain2.us, etc@example.com')}
          value={emails}
          disabled={pendingCreate}
          onChange={(event) => setEmails(event.target.value)}
        />
        <div className='mt-4 mb-2'>{t('Customize the invite email message (optional):')}</div>
        <TextareaAutosize
          minRows={5}
          className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
          value={message}
          disabled={pendingCreate}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className='mt-4 mb-2'>{t('Assign a role to invitees (optional):')}</div>
        <select
          className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
          value={selectedRoleId}
          disabled={pendingCreate}
          onChange={(event) => setSelectedRoleId(event.target.value)}
        >
          <option value=''>{t('No special role')}</option>
          {group.groupRoles?.items?.filter(role => role.active).map(role => (
            <option key={role.id} value={role.id}>
              {role.emoji ? `${role.emoji} ` : ''}{role.name}
            </option>
          ))}
        </select>
        <div className={classes.sendInviteButton}>
          <div className={classes.sendInviteFeedback}>
            {errorMessage && <span className={classes.error}>{errorMessage}</span>}
            {successMessage && <span className={classes.success}>{successMessage}</span>}
          </div>
          <Button color='green' disabled={disableSendBtn} onClick={handleSendInvites} narrow small>
            {t('Send Invite')}
          </Button>
        </div>
      </div>

      {hasPendingInvites && (
        <div className='border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
          <div className='w-full flex justify-between items-center'>
            <h2 className='text-lg font-bold mt-0 mb-1 text-foreground w-full'>{t('Pending Invites')}</h2>
            {hasPendingInvites && (
              <button
                className='focus:text-foreground w-[120px] relative text-base border-2 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background block transition-all scale-100 hover:scale-105 hover:opacity-100 text-foreground opacity-100 border-foreground/20'
                onClick={resendAllOnClick}
              >
                {t('Resend All')}
              </button>
            )}
          </div>
          <TransitionGroup className='flex flex-col gap-1'>
            {pendingInvites.map((invite, index) => (
              <CSSTransition
                classNames={{
                  enter: classes.enter,
                  enterActive: classes.enterActive,
                  exit: classes.exit,
                  exitActive: classes.exitActive
                }}
                timeout={{ enter: 400, exit: 500 }}
                key={index}
                nodeRef={pendingInvitesTransitionRef}
              >
                <div className='w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 bg-card rounded-lg px-2 py-1.5 mb-1 last:mb-0' key={invite.id} ref={pendingInvitesTransitionRef}>
                  <div className='flex-1 min-w-0'>
                    <span className='block truncate'>
                      {invite.name
                        ? <>{invite.name} <span className='text-foreground/50'>{invite.email}</span></>
                        : invite.email}
                    </span>
                    <span className='text-foreground/50 text-sm'>{TextHelpers.humanDate(invite.lastSentAt)}</span>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    <span className={cn('flex items-center gap-2 bg-foreground/10 rounded-lg p-1 cursor-pointer group-hover:bg-selected/50 transition-all', classes.expireBtn)} onClick={() => expireOnClick(invite.id)}>{t('Expire')}</span>
                    <span className={cn('flex items-center gap-2 bg-foreground/10 rounded-lg p-1 cursor-pointer group-hover:bg-selected/50 transition-all', classes.actionBtn, classes.resendBtn)} onClick={() => !invite.resent && resendOnClick(invite.id)}>{invite.resent ? t('Sent') : t('Resend')}</span>
                  </div>
                </div>
              </CSSTransition>
            ))}
          </TransitionGroup>
        </div>
      )}
    </div>
  )
}

InviteSettingsTab.propTypes = {
  group: object,
  inModal: bool,
  parentGroup: object
}

export default InviteSettingsTab
