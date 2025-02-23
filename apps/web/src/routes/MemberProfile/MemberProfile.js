import { filter, isFunction } from 'lodash'
import { DateTime } from 'luxon'
import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Helmet } from 'react-helmet'
import { useSelector, useDispatch } from 'react-redux'
import { Tooltip } from 'react-tooltip'
import { useParams, useNavigate, Routes, Route } from 'react-router-dom'
import { TextHelpers } from '@hylo/shared'

import Affiliation from 'components/Affiliation'
import Button from 'components/Button'
import BadgeEmoji from 'components/BadgeEmoji'
import ClickCatcher from 'components/ClickCatcher'
import Dropdown from 'components/Dropdown'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import NotFound from 'components/NotFound'
import RoundImage from 'components/RoundImage'
import RoundImageRow from 'components/RoundImageRow'
import Loading from 'components/Loading'
import RecentActivity from './RecentActivity'
import MemberPosts from './MemberPosts'
import MemberComments from './MemberComments'
import Membership from 'components/Membership'
import MemberReactions from './MemberReactions'
import PostDialog from 'components/PostDialog'
import SkillsSection from 'components/SkillsSection'
import SkillsToLearnSection from 'components/SkillsToLearnSection'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useViewPostDetails from 'hooks/useViewPostDetails'
import blockUser from 'store/actions/blockUser'
import { twitterUrl, AXOLOTL_ID } from 'store/models/Person'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import fetchPerson from 'store/actions/fetchPerson'
import {
  FETCH_RECENT_ACTIVITY,
  FETCH_MEMBER_POSTS,
  FETCH_MEMBER_COMMENTS,
  FETCH_MEMBER_REACTIONS,
  getPresentedPerson
} from './MemberProfile.store'
import { bgImageStyle, cn } from 'util/index'
import {
  currentUserSettingsUrl,
  messagePersonUrl,
  messagesUrl,
  gotoExternalUrl
} from 'util/navigation'

import styles from './MemberProfile.module.scss'

const GROUPS_DIV_HEIGHT = 200

const MESSAGES = {
  invalid: "That doesn't seem to be a valid person ID."
}

const MemberProfile = ({ currentTab = 'Overview', blockConfirmMessage, isSingleColumn }) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routeParams = useParams()
  const { t } = useTranslation()
  const [container, setContainer] = useState(null)

  const personId = routeParams.personId
  const error = !Number.isSafeInteger(Number(personId)) ? MESSAGES.invalid : null
  const person = useSelector(state => getPresentedPerson(state, routeParams))
  const contentLoading = useSelector(state => isPendingFor([
    FETCH_RECENT_ACTIVITY,
    FETCH_MEMBER_POSTS,
    FETCH_MEMBER_COMMENTS,
    FETCH_MEMBER_REACTIONS
  ], state))
  const personLoading = useSelector(state => isPendingFor(fetchPerson, state))
  const groupSlug = routeParams.groupSlug
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const roles = useSelector(state => getRolesForGroup(state, { person, groupId: group?.id }))
  const currentUser = useSelector(getMe)
  const previousLocation = useSelector(getPreviousLocation) || { pathname: '/' }

  const fetchPersonAction = (id) => dispatch(fetchPerson(id))
  const blockUserAction = (id) => dispatch(blockUser(id))
  const push = (url) => navigate(url)
  const goToPreviousLocation = () => navigate(previousLocation)

  const [currentTabState, setCurrentTabState] = useState(currentTab)
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [showExpandGroupsButton, setShowExpandGroupsButton] = useState(false)
  const groupsRef = useRef(null)

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Member Profile') + ': ' + (person ? person.name : t('Loading...')),
      icon: 'Person',
      info: '',
      search: true
    })
  }, [person])

  useEffect(() => {
    if (personId) fetchPersonAction(personId)
    checkGroupsHeight()
  }, [])

  useEffect(() => {
    checkGroupsHeight()
  })

  const checkGroupsHeight = () => {
    if (groupsRef.current && groupsRef.current.scrollHeight > GROUPS_DIV_HEIGHT && !showExpandGroupsButton) {
      setShowExpandGroupsButton(true)
    }
  }

  const selectTab = tab => setCurrentTabState(tab)

  const handleBlockUser = personId => {
    if (window.confirm(t('blockConfirmMessage'))) {
      blockUserAction(personId).then(goToPreviousLocation)
    }
  }

  const toggleShowAllGroups = () => {
    setShowAllGroups(!showAllGroups)
  }

  if (error) return <Error>{error}</Error>
  if (personLoading) return <Loading />
  if (!person?.name) return <NotFound />

  const affiliations = person.affiliations && person.affiliations.items
  const events = person.eventsAttending && person.eventsAttending.items
  const memberships = person.memberships.sort((a, b) => a.group.name.localeCompare(b.group.name))
  const projects = person.projects && person.projects.items
  const locationWithoutUsa = person.location && person.location.replace(', United States', '')
  const isCurrentUser = currentUser && currentUser.id === personId
  const isAxolotl = AXOLOTL_ID === personId
  const contentDropDownItems = [
    { id: 'Overview', label: t('Overview'), title: t('{{name}}\'s recent activity', { name: person.name }), component: RecentActivity },
    { id: 'Posts', label: t('Posts'), title: t('{{name}}\'s posts', { name: person.name }), component: MemberPosts },
    { id: 'Comments', label: t('Comments'), title: t('{{name}}\'s comments', { name: person.name }), component: MemberComments },
    { id: 'Reactions', label: t('Reactions'), title: t('{{name}}\'s reactions', { name: person.name }), component: MemberReactions }
  ].map(contentDropDownitem => ({
    ...contentDropDownitem, onClick: () => selectTab(contentDropDownitem.label)
  }))
  const actionButtonsItems = [
    { iconName: 'Messages', value: t('Message Member'), onClick: () => push(isCurrentUser ? messagesUrl() : messagePersonUrl(person)), hideCopyTip: true },
    { iconName: 'Phone', value: person.contactPhone, onClick: () => handleContactPhone(person.contactPhone) },
    { iconName: 'Email', value: person.contactEmail, onClick: () => handleContactEmail(person.contactEmail) },
    { iconName: 'Facebook', value: person.facebookUrl, onClick: () => gotoExternalUrl(person.facebookUrl) },
    { iconName: 'LinkedIn', value: person.linkedinUrl, onClick: () => gotoExternalUrl(person.linkedinUrl) },
    { iconName: 'Twitter', value: twitterUrl(person.twitterName), onClick: () => gotoExternalUrl(twitterUrl(person.twitterName)) },
    { iconName: 'Public', value: person.url, onClick: () => gotoExternalUrl(person.url) }
  ]
  const actionDropdownItems = [
    { icon: 'Edit', label: t('Edit Profile'), onClick: () => push(currentUserSettingsUrl()), hide: !isCurrentUser },
    { icon: 'Ex', label: t('Block this Member'), onClick: () => handleBlockUser(personId), hide: isCurrentUser || isAxolotl }
  ]
  const {
    title: currentContentTitle,
    component: CurrentContentComponent
  } = contentDropDownItems.find(contentItem => contentItem.id === currentTabState)

  return (
    <div className='h-full overflow-auto flex flex-col items-center' ref={setContainer}>
      <div className={cn('w-full', styles.memberProfile, { [styles.isSingleColumn]: isSingleColumn })}>
        <Helmet>
          <title>{person.name} | Hylo</title>
          <meta name='description' content={`${person.name}: ${t('Member Profile')}`} />
        </Helmet>
        <div className='flex flex-col items-center w-full'>
          {isCurrentUser &&
            <Button className={styles.editProfileButton} onClick={() => push(currentUserSettingsUrl())}>
              <Icon name='Edit' /> {t('Edit Profile')}
            </Button>}
          <div className='w-full h-[40vh] flex flex-col items-center items-end justify-end pb-10 bg-cover' style={bgImageStyle(person.bannerUrl)}>
            <RoundImage className={styles.headerMemberAvatar} url={person.avatarUrl} xlarge />
            <h1 className={styles.headerMemberName}>{person.name}</h1>
            <div className={styles.badgeRow}>
              {roles.map(role => (
                <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={person.id} />
              ))}
            </div>
            {person.location && (
              <div className={styles.headerMemberLocation}>
                <Icon name='Location' className={styles.headerMemberLocationIcon} />
                {locationWithoutUsa}
              </div>
            )}
          </div>
          <div className={styles.actionIcons}>
            <ActionButtons items={actionButtonsItems} />
            <ActionDropdown items={actionDropdownItems} />
          </div>
          {(person.tagline || person.bio) && (
            <div className='flex items-center flex-col'>
              {person.tagline && <div className='text-foreground text-center text-lg font-bold max-w-md'>{person.tagline}</div>}
              {person.bio && (
                <div className={cn('text-foreground text-center max-w-[720px]')}>
                  <ClickCatcher>
                    <HyloHTML element='span' html={TextHelpers.markdown(person.bio)} />
                  </ClickCatcher>
                </div>
              )}
            </div>
          )}
          <div className='flex flex-col max-w-[720px]'>
            <div className='text-sm opacity-50 uppercase mt-4 mb-2 text-center'>
              {t('Skills & Interests')}
            </div>
            <SkillsSection personId={personId} editable={false} t={t} />
            <div className='text-sm opacity-50 uppercase mt-4 mb-2 text-center'>
              {t('What I\'m Learning')}
            </div>
            <SkillsToLearnSection personId={personId} editable={false} t={t} />
            {memberships && memberships.length > 0 && <div className='text-sm opacity-50 uppercase mt-4 mb-2 text-center'>{t('Hylo Groups')}</div>}
            <div
              ref={groupsRef}
              className='flex flex-row flex-wrap items-center w-full overflow-hidden relative space-y-2'
              style={{
                maxHeight: showAllGroups ? 'none' : `${GROUPS_DIV_HEIGHT}px`
              }}
            >
              {memberships && memberships.length > 0 && memberships.map((m, index) => <Membership key={m.id} index={index} membership={m} />)}
            </div>
            {showExpandGroupsButton && (
              <button onClick={toggleShowAllGroups} className='text-sm font-bold mt-4 mb-2 text-center w-full block'>
                {showAllGroups ? 'Show Less' : 'Show More'}
              </button>
            )}

            {affiliations && affiliations.length > 0 && <div className='text-sm opacity-50 uppercase mt-4 mb-2 text-center w-full block'>{t('Other Affiliations')}</div>}
            {affiliations && affiliations.length > 0 && affiliations.map((a, index) => <Affiliation key={a.id} index={index} affiliation={a} />)}

            {events && events.length > 0 && <div className={styles.profileSubhead}>{t('Upcoming Events')}</div>}
            {events && events.length > 0 && events.map((e, index) => <Event key={index} memberCap={3} event={e} routeParams={routeParams} />)}

            {projects && projects.length > 0 && <div className={styles.profileSubhead}>{t('Projects')}</div>}
            {projects && projects.length > 0 && projects.map((p, index) => <Project key={index} memberCap={3} project={p} routeParams={routeParams} />)}
          </div>
        </div>
        <div className='flex flex-col align-items-center max-w-[720px]'>
          <div className={styles.contentControls}>
            <h2 className={styles.contentHeader}>{currentContentTitle}</h2>
            <Dropdown
              className={styles.contentDropdown}
              items={contentDropDownItems}
              toggleChildren={
                <span>{currentTabState} <Icon className={styles.contentDropdownIcon} name='ArrowDown' /></span>
  }
            />
          </div>
          <CurrentContentComponent routeParams={routeParams} loading={contentLoading} />
        </div>
      </div>
      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>
    </div>
  )
}

function ActionTooltip ({ content, hideCopyTip, onClick }) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()

  return (
    <div className={styles.actionIconTooltip}>
      <span className={styles.actionIconTooltipContent} onClick={onClick}>
        {content}
      </span>
      {!hideCopyTip && (
        <CopyToClipboard text={content} onCopy={() => setCopied(true)}>
          <Button className={cn(styles.actionIconTooltipButton, { [styles.copied]: copied })}>
            <Icon name='Copy' />
            {copied ? t('Copied!') : t('Copy')}
          </Button>
        </CopyToClipboard>
      )}
    </div>
  )
}

function ActionButtons ({ items }) {
  return items.map((actionIconItem, index) => {
    const { iconName, value, onClick, hideCopyTip } = actionIconItem

    if (!value) return null

    const tooltipId = `tooltip-${index}`
    const tooltipProps = {
      tooltipContent: value,
      tooltipId
    }

    return (
      <React.Fragment key={index}>
        <Icon
          key={index}
          className='text-foreground text-3xl bg-background flex items-center justify-center rounded-full cursor-pointer mx-2'
          name={iconName}
          onClick={onClick}
          {...tooltipProps}
        />
        <Tooltip
          id={tooltipId}
          place='bottom'
          type='light'
          effect='solid'
          clickable
          delayHide={500}
          delayShow={500}
          className={styles.tooltip}
          content={() =>
            <ActionTooltip content={value} onClick={onClick} key={index} hideCopyTip={hideCopyTip} />}
        />
      </React.Fragment>
    )
  })
}

function ActionDropdown ({ items }) {
  const activeItems = filter(items, item =>
    isFunction(item.onClick) && !item.hide)

  return activeItems.length > 0 &&
    <Dropdown
      alignRight
      items={activeItems}
      toggleChildren={
        <Icon className={cn(styles.actionIconButton, styles.actionMenu)} name='More' />
      }
    />
}

function Project ({ memberCap, project }) {
  const { title, createdAt, creator, members } = project
  const viewPostDetails = useViewPostDetails()
  return (
    <div className={styles.project} onClick={() => viewPostDetails(project)}>
      <div>
        <div className={styles.title}>{title} </div>
        <div className={styles.meta}>{creator.name} - {DateTime.fromJSDate(createdAt).toRelative()} </div>
      </div>
      <RoundImageRow className={cn(styles.members, { [styles.membersPlus]: members.items.length > memberCap })} inline imageUrls={members.items.map(m => m.avatarUrl)} cap={memberCap} />
    </div>
  )
}

function Event ({ memberCap, event }) {
  const { location, eventInvitations, startTime, title } = event
  const viewPostDetails = useViewPostDetails()
  return (
    <div className={styles.event} onClick={() => viewPostDetails(event)}>
      <div className={styles.date}>
        <div className={styles.month}>{DateTime.fromJSDate(startTime).toFormat('MMM')}</div>
        <div className={styles.day}>{DateTime.fromJSDate(startTime).toFormat('dd')}</div>
      </div>
      <div className={styles.details}>
        <div className={styles.title}>{title}</div>
        <div className={styles.meta}><Icon name='Location' />{location}</div>
      </div>
      <RoundImageRow className={cn(styles.members, { [styles.membersPlus]: eventInvitations.items.length > memberCap })} inline imageUrls={eventInvitations.items.map(e => e.person.avatarUrl)} cap={memberCap} />
    </div>
  )
}

function Error ({ children }) {
  return (
    <div className={styles.memberProfile}>
      <span className={styles.error}>{children}</span>
    </div>
  )
}

function handleContactPhone (contactPhone) {
  return window.location.assign(`tel:${contactPhone}`)
}

function handleContactEmail (contactEmail) {
  return window.location.assign(`mailto:${contactEmail}`)
}

export default MemberProfile
