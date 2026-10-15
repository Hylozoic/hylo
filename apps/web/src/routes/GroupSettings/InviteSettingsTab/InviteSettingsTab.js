import isMobile from 'ismobilejs'
import { Eye, KeyRound, MoreVertical, Plus } from 'lucide-react'
import PropTypes from 'prop-types'
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import TextareaAutosize from 'react-textarea-autosize'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Tooltip } from 'react-tooltip'
import { TextHelpers } from '@hylo/shared'
import { isEmpty } from 'lodash'
import Button from 'components/Button'
import Icon from 'components/Icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import PeopleSelector from 'routes/Messages/PeopleSelector'
import { cn } from 'util/index'
import { isSandboxMode } from 'sandbox/isSandbox'
import { toast } from 'sonner'
import { RESP_ADMINISTRATION } from 'store/constants'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import getMe from 'store/selectors/getMe'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import {
  CREATE_INVITATIONS,
  FETCH_INVITEABLE_PEOPLE,
  FETCH_INVITE_RECENT_CONTACTS,
  INVITEABLE_PEOPLE_PAGE_SIZE,
  INVITE_RECENT_CONTACTS_PAGE_SIZE,
  PENDING_INVITES_PAGE_SIZE,
  createGroupInviteLink,
  createInvitations as createInvitationsAction,
  deleteGroupInviteLink,
  updateGroupInviteLink,
  fetchInviteablePeople,
  fetchInviteRecentContacts,
  fetchPendingInvitations,
  getPendingInvites,
  expireInvitation as expireInvitationAction,
  resendInvitation as resendInvitationAction,
  reinviteAll as reinviteAllAction
} from './InviteSettingsTab.store'

import classes from './InviteSettingsTab.module.scss'

const { bool, object } = PropTypes

const INVITES_PER_SEND = 10

function randomAccessCode () {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const parseEmailList = emails =>
  (emails || '').split(/,|\n/).map(email => {
    const trimmed = email.trim()
    const match = trimmed.match(/.*<(.*)>/)
    return match ? match[1] : trimmed
  })

/**
 * Whether this link lets someone join without asking. Restricted groups honor the
 * stored flag. Closed groups, Open groups, and spaces always grant access.
 */
function linkGrantsAccess (link, { isSpace, accessibility }) {
  if (isSpace) return true
  if (accessibility === GROUP_ACCESSIBILITY.Open || accessibility === GROUP_ACCESSIBILITY.Closed) return true
  return !!link.grantAccess
}

/**
 * Helper under the public group link. Open, restricted, and closed groups each get their own sentence.
 */
function publicGroupLinkText ({ accessibility, t }) {
  if (accessibility === GROUP_ACCESSIBILITY.Open) {
    return t('Send this link to anyone you want to see the group and join')
  }
  if (accessibility === GROUP_ACCESSIBILITY.Closed) {
    return t('Send this link to people you want to see the group profile, they will not be able to join the group.')
  }
  return t('Send this link to anyone you want to see the group and request to join')
}

/**
 * Short explanation under Invite Links for this visibility and access setting.
 * Restricted groups that are not public also explain view links.
 */
function inviteLinksExplainer ({ isSpace, accessibility, visibility, t }) {
  const hidden = visibility === GROUP_VISIBILITY.Hidden
  if (isSpace) {
    if (hidden) return t('This space is hidden. Anyone with a link can see it and join.')
    if (accessibility === GROUP_ACCESSIBILITY.Restricted) return t('Anyone with a link can join this space without requesting.')
    if (accessibility === GROUP_ACCESSIBILITY.Closed) return t('Anyone with a link can see this space and join.')
    return t('Anyone with a link can join this space.')
  }
  if (accessibility === GROUP_ACCESSIBILITY.Open) {
    if (hidden) return t('This group is hidden. Anyone with an invite link can see it and join.')
    if (visibility === GROUP_VISIBILITY.Protected) return t('Anyone invited can see the group and join.')
    return t('Anyone with this link can see the group and join.')
  }
  if (accessibility === GROUP_ACCESSIBILITY.Closed) {
    return t('Send an invite link to grant access to the group.')
  }
  const grantLine = t('Send an invite link to grant access to the group without a request.')
  if (visibility === GROUP_VISIBILITY.Public) return grantLine
  return `${grantLine} ${t('Send a view link to let someone see the group and request to join.')}`
}

/**
 * Path copied for a link. View-only links use /view/{code}.
 */
function inviteLinkDisplayPath (link, grantsAccess) {
  if (!link.accessCode) return link.url || ''
  return grantsAccess ? `/invite/${link.accessCode}` : `/view/${link.accessCode}`
}

/**
 * Key or eye inside a link box. The eye means the link only lets people see the group.
 */
function InviteLinkAccessIcon ({ grantsAccess, tooltip }) {
  return (
    <span
      className='relative shrink-0 text-foreground/70'
      data-testid={grantsAccess ? 'invite-link-grants-access' : 'invite-link-view-only'}
      data-tooltip-id='invite-link-grant-tooltip'
      data-tooltip-content={tooltip}
    >
      {grantsAccess
        ? <KeyRound className='w-4 h-4' aria-hidden />
        : <Eye className='w-4 h-4' aria-hidden />}
    </span>
  )
}

/**
 * Name and role pills under a link. Roles stand in for the name when it is blank.
 */
function InviteLinkMeta ({ name, roles, t }) {
  if (!name && roles.length === 0) return null
  return (
    <div className='flex flex-wrap items-center gap-1.5 text-xs text-foreground/60'>
      {name && <span className='font-medium'>{name}</span>}
      {roles.length > 0 && (
        <>
          <span>{t('Grants Role(s):')}</span>
          {roles.map(role => (
            <span key={role.id} className='inline-flex items-center rounded-md bg-foreground/10 px-2 py-0.5 text-foreground'>
              {role.emoji ? `${role.emoji} ` : ''}{role.name}
            </span>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Tooltip for the key shown on a link that grants access.
 */
function grantAccessTooltip ({ isSpace, accessibility, t }) {
  if (isSpace) return t('This link will grant access to the space')
  if (accessibility === GROUP_ACCESSIBILITY.Restricted) {
    return t('This link will grant access to the group without requesting to join')
  }
  return t('This link will grant access to the group')
}

/**
 * Name and role fields shared by creating and editing an invite link.
 * Grant access is chosen by which create button opened the editor.
 */
function InviteLinkEditor ({ draft, onChange, onSave, onCancel, canAdminister, roles }) {
  const { t } = useTranslation()
  const selectedRoles = draft.grantedRoleIds
    .map(id => roles.find(role => String(role.id) === String(id)))
    .filter(Boolean)
  const availableRoles = roles.filter(role => !draft.grantedRoleIds.includes(String(role.id)))

  return (
    <div className='flex flex-col gap-2 border border-foreground/20 rounded-lg p-2'>
      <input
        className='rounded-lg bg-input text-foreground border-2 border-transparent focus:border-focus p-2'
        placeholder={t('Name (optional)')}
        value={draft.name}
        onChange={event => onChange({ ...draft, name: event.target.value })}
      />
      {draft.grantAccess && canAdminister && (
        <>
          {selectedRoles.length > 0 && (
            <div className='flex flex-wrap gap-1'>
              {selectedRoles.map(role => (
                <span key={role.id} className='inline-flex items-center gap-1 rounded-md bg-foreground/10 px-2 py-0.5 text-xs'>
                  {role.emoji ? `${role.emoji} ` : ''}{role.name}
                  <button
                    type='button'
                    className='text-foreground/60 hover:text-foreground'
                    aria-label={t('Remove {{name}}', { name: role.name })}
                    onClick={() => onChange({ ...draft, grantedRoleIds: draft.grantedRoleIds.filter(id => id !== String(role.id)) })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <select
            className='rounded-lg bg-input text-foreground p-2'
            value=''
            onChange={event => {
              const id = event.target.value
              if (!id || draft.grantedRoleIds.includes(id)) return
              onChange({ ...draft, grantedRoleIds: [...draft.grantedRoleIds, id] })
            }}
          >
            <option value=''>{t('Add a role this link grants')}</option>
            {availableRoles.map(role => (
              <option key={role.id} value={String(role.id)}>{role.name}</option>
            ))}
          </select>
        </>
      )}
      <div className='flex gap-2'>
        <Button color='green' narrow small onClick={onSave}>{t('Save')}</Button>
        <Button narrow small onClick={onCancel}>{t('Cancel')}</Button>
      </div>
    </div>
  )
}

/**
 * Invite page for anyone who can add members: public and invite links, people search,
 * email invites, and pending invites. Administrators can create, edit, and delete invite links
 * and assign a role to invitees.
 */
function InviteSettingsTab (props) {
  const { group, inModal = false, parentGroup } = props
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const pendingCreateFromStore = useSelector(state => state.pending[CREATE_INVITATIONS])
  const pendingCreate = !!(props.pendingCreate || pendingCreateFromStore)
  const pendingPeople = useSelector(state => !!(state.pending[FETCH_INVITEABLE_PEOPLE] || state.pending[FETCH_INVITE_RECENT_CONTACTS]))
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
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: group?.id
  }))
  const inviteLinks = (storeGroup || group).inviteLinks || []
  const inviteAllowance = storeGroup?.myInviteAllowance
  const accessibility = (storeGroup || group).accessibility
  const isSpace = group.type === GROUP_TYPES.space || !!group.parentId
  const parentGroupId = parentGroup?.id || group.parentId
  const parentName = parentGroup?.name || parentGroupFromStore?.name

  const createInvitations = useCallback((emails, groupRoleId, userIds) => dispatch(createInvitationsAction(group.id, emails, groupRoleId, userIds)), [dispatch, group.id])
  const expireInvitation = useCallback((invitationToken) => dispatch(expireInvitationAction(invitationToken)), [dispatch])
  const resendInvitation = useCallback((invitationToken) => dispatch(resendInvitationAction(invitationToken)), [dispatch])
  const reinviteAll = useCallback(() => dispatch(reinviteAllAction(group.id)), [dispatch, group.id])
  const trackAnalyticsEventDispatch = useCallback((eventNames, analyticsData) => dispatch(trackAnalyticsEvent(eventNames, analyticsData)), [dispatch])

  const { t } = useTranslation()

  const [copiedPublicLink, setCopiedPublicLink] = useState(false)
  const [copiedInviteLinkId, setCopiedInviteLinkId] = useState(null)
  const [pendingPageSize, setPendingPageSize] = useState(PENDING_INVITES_PAGE_SIZE)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingHasMore, setPendingHasMore] = useState(false)
  const [creatingLink, setCreatingLink] = useState(false)
  const [newLink, setNewLink] = useState(null)
  const [editingLink, setEditingLink] = useState(null)
  const [emails, setEmails] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [people, setPeople] = useState([])
  const [selectedPeople, setSelectedPeople] = useState([])
  const [peopleSelectorOpen, setPeopleSelectorOpen] = useState(false)
  const [hasMorePeople, setHasMorePeople] = useState(false)
  const sendingRef = useRef(false)
  const peopleSearchRef = useRef('')
  const peopleOffsetRef = useRef(0)
  const showingRecentContactsRef = useRef(false)
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
        items: rawItems
          .filter(p => String(p.id) !== String(currentUser?.id))
          .map(p => ({
            ...p,
            groupRoles: p.groupRoles?.items?.map(r => String(r.id)) || []
          })),
        hasMore: pageHasMore(members, rawItems.length)
      }
    }
    const people = response?.payload?.data?.people
    const rawItems = people?.items || []
    return {
      items: rawItems.filter(p => p && String(p.id) !== String(currentUser?.id)),
      hasMore: pageHasMore(people, rawItems.length)
    }
  }, [currentUser?.id, isSpace, parentGroupId])

  /**
   * Maps recent-contact rows to people, dropping the current user and blank names.
   */
  const parseRecentContactsResponse = useCallback((response) => {
    const connections = response?.payload?.data?.connections
    const rawItems = connections?.items || []
    const items = rawItems.map(item => item?.person).filter(person => {
      if (!person || String(person.id) === String(currentUser?.id)) return false
      return typeof person.name === 'string' && person.name.trim()
    }).map(person => ({
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl
    }))
    return {
      items,
      hasMore: connections?.hasMore === true
    }
  }, [currentUser?.id])

  // For role-gated spaces, restrict the people picker to only show parent-group
  // members who already hold one of the required roles.
  const spaceRequiredRoleIds = useMemo(() => {
    if (!isSpace) return null
    const ids = group?.requiredRoles || []
    return ids.length > 0 ? ids.map(id => String(id)) : null
  }, [isSpace, group?.requiredRoles])

  /**
   * Loads the invite dropdown. An empty search on a group shows recent contacts.
   * Any typed search, and every space lookup, loads inviteable people.
   */
  const fetchPeopleForInvite = useCallback(async (autocomplete = '') => {
    const search = typeof autocomplete === 'string' ? autocomplete : ''
    peopleSearchRef.current = search
    peopleOffsetRef.current = 0
    loadingMorePeopleRef.current = false
    const gen = ++peopleFetchGenRef.current
    const useRecentContacts = !isSpace && !search.trim()
    showingRecentContactsRef.current = useRecentContacts

    if (useRecentContacts) {
      const response = await dispatch(fetchInviteRecentContacts({
        groupId: group.id,
        first: INVITE_RECENT_CONTACTS_PAGE_SIZE,
        offset: 0
      }))
      if (gen !== peopleFetchGenRef.current) return
      const { items, hasMore } = parseRecentContactsResponse(response)
      peopleOffsetRef.current = INVITE_RECENT_CONTACTS_PAGE_SIZE
      setPeople(items)
      setHasMorePeople(!!hasMore)
      return
    }

    const response = await dispatch(fetchInviteablePeople({
      groupId: group.id,
      parentGroupId: isSpace ? parentGroupId : undefined,
      excludeGroupId: isSpace ? undefined : group.id,
      groupRoleIds: spaceRequiredRoleIds,
      autocomplete: search,
      first: INVITEABLE_PEOPLE_PAGE_SIZE,
      offset: 0
    }))
    if (gen !== peopleFetchGenRef.current) return
    const { items, hasMore } = parseInviteablePeopleResponse(response)
    peopleOffsetRef.current = INVITEABLE_PEOPLE_PAGE_SIZE
    setPeople(items)
    setHasMorePeople(!!hasMore)
  }, [dispatch, group.id, isSpace, parentGroupId, parseInviteablePeopleResponse, parseRecentContactsResponse, spaceRequiredRoleIds])

  /**
   * Appends the next page when the picker list is scrolled to the bottom.
   */
  const handleLoadMorePeople = useCallback(async () => {
    if (loadingMorePeopleRef.current || !hasMorePeopleRef.current) return
    loadingMorePeopleRef.current = true
    const gen = peopleFetchGenRef.current
    const offset = peopleOffsetRef.current
    const recent = showingRecentContactsRef.current
    const pageSize = recent ? INVITE_RECENT_CONTACTS_PAGE_SIZE : INVITEABLE_PEOPLE_PAGE_SIZE
    const response = recent
      ? await dispatch(fetchInviteRecentContacts({
        groupId: group.id,
        first: pageSize,
        offset
      }))
      : await dispatch(fetchInviteablePeople({
        groupId: group.id,
        parentGroupId: isSpace ? parentGroupId : undefined,
        excludeGroupId: isSpace ? undefined : group.id,
        groupRoleIds: spaceRequiredRoleIds,
        autocomplete: peopleSearchRef.current,
        first: pageSize,
        offset
      }))
    if (gen !== peopleFetchGenRef.current) {
      loadingMorePeopleRef.current = false
      return
    }
    const { items, hasMore } = recent
      ? parseRecentContactsResponse(response)
      : parseInviteablePeopleResponse(response)
    peopleOffsetRef.current = offset + pageSize
    setPeople(prev => {
      const seen = new Set(prev.map(p => String(p.id)))
      return [...prev, ...items.filter(p => !seen.has(String(p.id)))]
    })
    setHasMorePeople(!!hasMore)
    loadingMorePeopleRef.current = false
  }, [dispatch, group.id, isSpace, parentGroupId, parseInviteablePeopleResponse, parseRecentContactsResponse, spaceRequiredRoleIds])

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

    if (isSandboxMode()) {
      toast(t('Create an account to invite people'), {
        action: {
          label: t('Sign up'),
          onClick: () => { window.location.href = '/signup' }
        }
      })
      return
    }

    const emailList = parseEmailList(emails).filter(Boolean)
    const submittedCount = new Set(emailList.map(email => email.toLowerCase())).size + selectedPeople.length
    if (submittedCount > INVITES_PER_SEND) {
      setSuccessMessage('')
      setErrorMessage(t('You can invite up to {{max}} people at a time', { max: INVITES_PER_SEND }))
      return
    }

    sendingRef.current = true

    const groupRoleId = selectedRoleId ? parseInt(selectedRoleId, 10) : null
    const userIds = selectedPeople.map(p => p.id)
    createInvitations(emailList, groupRoleId, userIds)
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
          trackAnalyticsEventDispatch('Group Invitations Sent', {
            numGood,
            numSubmitted: emailList.length + userIds.length
          })
        }
        setEmails(badEmails.join('\n'))
        setErrorMessage(errorMessage)
        setSuccessMessage(successMessage)
        setSelectedRoleId('')
        setSelectedPeople([])
        if (userIds.length > 0) {
          setPeople(prev => prev.filter(p => !userIds.includes(p.id)))
        }
        dispatch(fetchPendingInvitations(group.id, { first: pendingPageSize, onlyMine: inModal }))
      })
      .catch(error => {
        sendingRef.current = false
        setSuccessMessage('')
        setErrorMessage(error?.message === 'invite-limit'
          ? t("You don't have enough invites left today for all of these addresses.")
          : t('Something went wrong. Please try again.'))
        dispatch(fetchPendingInvitations(group.id, { first: pendingPageSize, onlyMine: inModal }))
      })
  }

  const onCopyPublicLink = () => setTemporaryState(setCopiedPublicLink, true)
  const onCopyInviteLink = id => {
    setCopiedInviteLinkId(id)
    setTimeout(() => setCopiedInviteLinkId(current => current === id ? null : current), 3000)
  }

  /**
   * Opens the editor for a new link. View links are created with grant access off.
   */
  const startNewLink = (grantAccess) => {
    setEditingLink(null)
    setCreatingLink(true)
    setNewLink({
      accessCode: randomAccessCode(),
      name: '',
      grantAccess,
      grantedRoleIds: []
    })
  }

  const startEditLink = link => {
    setCreatingLink(false)
    setNewLink(null)
    setEditingLink({
      id: link.id,
      name: link.name || '',
      grantAccess: linkGrantsAccess(link, { isSpace, accessibility }),
      grantedRoleIds: (link.grantedRoles || []).map(role => String(role.id))
    })
  }

  const saveNewLink = () => {
    if (!newLink) return
    dispatch(createGroupInviteLink(group.id, {
      accessCode: newLink.accessCode,
      name: newLink.name || null,
      grantAccess: newLink.grantAccess,
      grantedRoleIds: newLink.grantAccess ? newLink.grantedRoleIds : []
    })).then(() => {
      setCreatingLink(false)
      setNewLink(null)
      dispatch(fetchPendingInvitations(group.id, { first: pendingPageSize, onlyMine: inModal }))
    })
  }

  const saveEditedLink = () => {
    if (!editingLink) return
    dispatch(updateGroupInviteLink(editingLink.id, {
      name: editingLink.name || null,
      grantAccess: editingLink.grantAccess,
      grantedRoleIds: editingLink.grantAccess ? editingLink.grantedRoleIds : []
    })).then(() => {
      setEditingLink(null)
      dispatch(fetchPendingInvitations(group.id, { first: pendingPageSize, onlyMine: inModal }))
    })
  }

  const removeInviteLink = id => {
    if (!window.confirm(t('Delete this invite link? It will stop working.'))) return
    dispatch(deleteGroupInviteLink(id)).then(() => {
      dispatch(fetchPendingInvitations(group.id, { first: pendingPageSize, onlyMine: inModal }))
    })
  }

  const visibility = (storeGroup || group).visibility
  const isOpenGroup = !isSpace && accessibility === GROUP_ACCESSIBILITY.Open
  const showInviteLinks = !isOpenGroup || visibility !== GROUP_VISIBILITY.Public
  const canCreateViewLink = !isSpace && accessibility === GROUP_ACCESSIBILITY.Restricted && visibility !== GROUP_VISIBILITY.Public

  const disableSendBtn = (isEmpty(emails) && selectedPeople.length === 0) || pendingCreate || inviteAllowance === 0

  const resendAllOnClick = useCallback(() => {
    if (window.confirm(t('Are you sure you want to resend all Pending Invitations'))) {
      reinviteAll()
    }
  }, [reinviteAll, t])

  const expireOnClick = useCallback((invitationToken) => {
    expireInvitation(invitationToken)
  }, [expireInvitation])

  const resendOnClick = useCallback((invitationToken) => {
    resendInvitation(invitationToken)
  }, [resendInvitation])

  const hasPendingInvites = !isEmpty(pendingInvites)

  /** True when this is a role-gated space with required roles defined. */
  const isRoleGated = isSpace && (spaceRequiredRoleIds?.length > 0)

  const peopleForSelector = useMemo(() => {
    const invitedIds = new Set(pendingInvites.map(i => i.userId != null && String(i.userId)).filter(Boolean))
    const invitedNames = new Set(pendingInvites.map(i => i.name && i.name.toLowerCase()).filter(Boolean))
    const invitedEmails = new Set(pendingInvites.map(i => i.email && i.email.toLowerCase()).filter(Boolean))
    const allowed = people.filter(p => {
      if (typeof p.name !== 'string' || !p.name.trim()) return false
      if (invitedIds.has(String(p.id))) return false
      if (p.email && invitedEmails.has(String(p.email).toLowerCase())) return false
      if (p.name && invitedNames.has(p.name.toLowerCase())) return false
      return true
    })
    if (!isRoleGated || !spaceRequiredRoleIds) return allowed
    const requiredSet = new Set(spaceRequiredRoleIds)
    const hasRole = []
    const noRole = []
    for (const person of allowed) {
      // groupRoles can arrive as a flat array ['1', '2'] (from parseInviteablePeopleResponse)
      // or as raw GraphQL { items: [{ id: 1 }] } — handle both safely
      const roleIds = Array.isArray(person.groupRoles)
        ? person.groupRoles
        : person.groupRoles?.items?.map(r => String(r.id)) || []
      if (roleIds.some(id => requiredSet.has(id))) {
        hasRole.push({ ...person, hasRequiredRole: true, roleLabel: t('Has role') })
      } else {
        noRole.push({ ...person, hasRequiredRole: false, roleLabel: t('No role') })
      }
    }
    return [...hasRole, ...noRole]
  }, [people, pendingInvites, isRoleGated, spaceRequiredRoleIds, t])

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
    if (!group?.id) return
    dispatch(fetchPendingInvitations(group.id, { first: pendingPageSize, onlyMine: inModal }))
      .then(result => {
        const pending = result?.payload?.data?.group?.pendingInvitations
        if (!pending) return
        setPendingTotal(pending.total || 0)
        setPendingHasMore(!!pending.hasMore)
      })
  }, [dispatch, group?.id, pendingPageSize, inModal])

  return (
    <div className={classes.container}>
      {!isSpace && visibility === GROUP_VISIBILITY.Public && (
        <div className='border-2 p-4 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-2 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
          <div className='text-foreground'>
            <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Public Group Link')}</h2>
            <div className='text-sm text-foreground/70'>
              {publicGroupLinkText({ accessibility, t })}
            </div>
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

      {showInviteLinks && (
        <div className='border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-4 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
          <div className='text-foreground'>
            <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>{t('Invite Links')}</h2>
            <div className='text-sm text-foreground/70'>
              {inviteLinksExplainer({ isSpace, accessibility, visibility, t })}
            </div>
          </div>
          {inviteLinks.map(link => {
            const grantsAccess = linkGrantsAccess(link, { isSpace, accessibility })
            const fullUrl = `${window.location.origin}${inviteLinkDisplayPath(link, grantsAccess)}`
            const copied = copiedInviteLinkId === link.id
            const activeRoles = (group.groupRoles?.items || []).filter(role => role.active)
            return (
              <div key={link.id} className='flex flex-col gap-1'>
                <div className='flex items-center gap-2 min-w-0 w-full'>
                  <CopyToClipboard text={fullUrl} onCopy={() => onCopyInviteLink(link.id)}>
                    <button className='flex items-center group gap-2 min-w-0 flex-1 w-full max-w-full bg-card border-2 border-foreground/20 rounded-lg p-2 hover:border-foreground/50 transition-all hover:cursor-pointer' data-tooltip-content={!copied ? t('Click to Copy') : undefined} data-tooltip-id='invite-link-copy-tooltip'>
                      <InviteLinkAccessIcon
                        grantsAccess={grantsAccess}
                        tooltip={grantsAccess
                          ? grantAccessTooltip({ isSpace, accessibility, t })
                          : t('Gives access to view the group, but people still have to request to join.')}
                      />
                      <span className='min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis' dir='rtl'>
                        <bdi className='text-selected'>{fullUrl}</bdi>
                      </span>
                      <div className='flex items-center gap-2 bg-foreground/10 rounded-lg p-1 group-hover:bg-selected/50 transition-all shrink-0'>
                        {copied
                          ? <>{t('Copied!')}</>
                          : <><Icon name='Copy' /> {t('Copy')}</>}
                      </div>
                    </button>
                  </CopyToClipboard>
                  {canAdminister && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type='button' aria-label={t('Invite link actions')} className='p-1.5 rounded-md hover:bg-foreground/10 transition-colors shrink-0'>
                          <MoreVertical className='w-5 h-5 text-foreground/60' />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => startEditLink(link)}>{t('Edit')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => removeInviteLink(link.id)} className='cursor-pointer text-red-500 focus:text-red-500'>{t('Delete')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <InviteLinkMeta name={link.name} roles={link.grantedRoles || []} t={t} />
                {editingLink?.id === link.id && (
                  <InviteLinkEditor
                    draft={editingLink}
                    onChange={setEditingLink}
                    onSave={saveEditedLink}
                    onCancel={() => setEditingLink(null)}
                    canAdminister={canAdminister}
                    roles={activeRoles}
                  />
                )}
                {!!link.numJoinedUsers && <p className='text-xs text-foreground/50 m-0'>{t('{{count}} joined', { count: link.numJoinedUsers })}</p>}
              </div>
            )
          })}
          {!isMobile.any && (
            <>
              <Tooltip place='top' type='dark' id='invite-link-grant-tooltip' effect='solid' delayShow={500} />
              <Tooltip place='top' type='dark' id='invite-link-copy-tooltip' effect='solid' delayShow={500} />
              <Tooltip
                place='top'
                id='create-view-link-tooltip'
                delayShow={200}
                style={{ maxWidth: '16rem', whiteSpace: 'normal', textAlign: 'left' }}
              />
            </>
          )}
          {canAdminister && !creatingLink && (
            <div className='flex flex-wrap gap-2'>
              <button type='button' onClick={() => startNewLink(true)} className='inline-flex items-center gap-1.5 self-start text-sm border-2 border-foreground/20 rounded-md px-2 py-1 hover:border-foreground/50 transition-all'>
                <Plus className='w-4 h-4' aria-hidden />
                {t('Create invite link')}
              </button>
              {canCreateViewLink && (
                <button
                  type='button'
                  onClick={() => startNewLink(false)}
                  data-tooltip-id='create-view-link-tooltip'
                  data-tooltip-content={t('These links allow for viewing the group, but still require a request to join.')}
                  className='inline-flex items-center gap-1.5 self-start text-sm border-2 border-foreground/20 rounded-md px-2 py-1 hover:border-foreground/50 transition-all'
                >
                  <Plus className='w-4 h-4' aria-hidden />
                  {t('Create View Link')}
                </button>
              )}
            </div>
          )}
          {creatingLink && newLink && (
            <InviteLinkEditor
              draft={newLink}
              onChange={setNewLink}
              onSave={saveNewLink}
              onCancel={() => { setCreatingLink(false); setNewLink(null) }}
              canAdminister={canAdminister}
              roles={(group.groupRoles?.items || []).filter(role => role.active)}
            />
          )}
        </div>
      )}

      <div className='border-2 mt-2 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 text-foreground background-black/10 rounded-lg border-dashed relative mb-2 hover:border-t-foreground/100 hover:border-x-foreground/90 transition-all hover:border-b-foreground/80 flex flex-col gap-2'>
        <>
          <h2 className='text-lg font-bold mt-0 mb-1 text-foreground'>
            {t('Invite people on Hylo')}
          </h2>
          <span className='text-sm text-foreground/50'>
            {isRoleGated && (
              <p className='text-sm text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2'>
                {t('Only members with one of the required roles will actually be able to join the space.')}{' '}
                <a
                  href={`/groups/${group.slug}/settings/roles`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline hover:no-underline font-medium'
                >
                  {t('Go to group roles')}
                </a>
              </p>
            )}
            {isSpace
              ? t('Search members of {{name}} who aren\'t already in this space.', { name: parentName || t('the group') })
              : t('Search people you can see on Hylo.')}
          </span>
          <PeopleSelector
            placeholder={isSpace
              ? t('Search members of {{name}}...', { name: parentName || t('the group') })
              : t('Search people...')}
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
        </>
        <h2 className='text-lg font-bold mb-1 text-foreground mt-4'>
          {t('Send Invites via email')}
        </h2>
        <span className='text-sm text-foreground/50'>
          {isSpace
            ? t('An invitation link will be sent to each email address to join this space. If they are not yet a member of {{name}} they will be asked to join that first.', { name: parentName || t('the group') })
            : t('An invitation link will be sent to each email address. They will still be shown any required questions or agreements you may have set to join this group.')}
        </span>
        <p>{t('Enter up to {{max}} email addresses at a time, separated by commas or new lines', { max: INVITES_PER_SEND })}</p>
        <TextareaAutosize
          minRows={1}
          className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
          placeholder={t('example@domain.com, secondexample@domain2.us, etc@example.com')}
          value={emails}
          disabled={pendingCreate}
          onChange={(event) => setEmails(event.target.value)}
        />
        {canAdminister && (
          <>
            <div className='mt-4 mb-2'>{t('Assign a role to invitees (optional):')}</div>
            <select
              className='rounded-lg bg-input text-foreground focus:outline-none focus:ring-0 focus:ring-offset-0 border-2 border-transparent focus:border-focus p-2'
              value={selectedRoleId}
              disabled={pendingCreate}
              onChange={(event) => setSelectedRoleId(event.target.value)}
            >
              <option value=''>{t('No special role')}</option>
              {(isRoleGated
                ? (group.groupRoles?.items || []).filter(role => role.active && spaceRequiredRoleIds?.includes(String(role.id)))
                : (group.groupRoles?.items || []).filter(role => role.active)
              ).map(role => (
                <option key={role.id} value={role.id}>
                  {role.emoji ? `${role.emoji} ` : ''}{role.name}
                </option>
              ))}
            </select>
          </>
        )}
        {typeof inviteAllowance === 'number' && (
          <p className='text-sm text-foreground/50'>{t('Invites left today: {{remaining}}', { remaining: inviteAllowance })}</p>
        )}
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
            {!inModal && hasPendingInvites && (
              <button
                className='focus:text-foreground w-[120px] relative text-base border-2 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background block transition-all scale-100 hover:scale-105 hover:opacity-100 text-foreground opacity-100 border-foreground/20'
                onClick={resendAllOnClick}
              >
                {t('Resend All')}
              </button>
            )}
          </div>
          <div className='flex flex-col gap-1'>
            {pendingInvites.map(invite => (
              <div className='w-full flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 bg-card rounded-lg px-2 py-1.5 mb-1 last:mb-0' key={invite.id}>
                <div className='flex-1 min-w-0'>
                  <span className='block truncate'>
                    {invite.name
                      ? <>{invite.name} <span className='text-foreground/50'>{invite.email}</span></>
                      : invite.email}
                  </span>
                  <span className='text-foreground/50 text-sm'>
                    {TextHelpers.humanDate(invite.lastSentAt)}
                    {invite.creator?.name && (
                      <> · {t('Invited by {{name}}', { name: invite.creator.name })}</>
                    )}
                  </span>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <span className={cn('flex items-center gap-2 bg-foreground/10 rounded-lg p-1 cursor-pointer group-hover:bg-selected/50 transition-all', classes.expireBtn)} onClick={() => expireOnClick(invite.id)}>{t('Expire')}</span>
                  <span className={cn('flex items-center gap-2 bg-foreground/10 rounded-lg p-1 cursor-pointer group-hover:bg-selected/50 transition-all', classes.actionBtn, classes.resendBtn)} onClick={() => !invite.resent && resendOnClick(invite.id)}>{invite.resent ? t('Sent') : t('Resend')}</span>
                </div>
              </div>
            ))}
          </div>
          {pendingTotal > 0 && (
            <div className='flex items-center justify-between text-sm text-foreground/60'>
              <span>{t('{{from}}-{{to}} of {{total}}', { from: 1, to: Math.min(pendingInvites.length, pendingTotal), total: pendingTotal })}</span>
              {pendingHasMore && (
                <button type='button' className='text-selected' onClick={() => setPendingPageSize(size => size + PENDING_INVITES_PAGE_SIZE)}>{t('Load more')}</button>
              )}
            </div>
          )}
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
