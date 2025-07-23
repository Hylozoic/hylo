import { filter, isFunction } from 'lodash'
import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Helmet } from 'react-helmet'
import { useSelector, useDispatch } from 'react-redux'
import { Tooltip } from 'react-tooltip'
import { useParams, useNavigate, Routes, Route } from 'react-router-dom'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import { getLocaleFromLocalStorage } from 'util/locale'

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
import { cn } from 'util/index'
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
    <div className='h-full overflow-auto flex flex-col items-center px-2 sm:px-0' ref={setContainer}>
      <div className={cn('w-full', styles.memberProfile)}>
        <Helmet>
          <title>{person.name} | Hylo</title>
          <meta name='description' content={`${person.name}: ${t('Member Profile')}`} />
        </Helmet>
        <div className='flex flex-col items-center w-full'>
          {isCurrentUser &&
            <button className='absolute top-2 right-5 z-50 bg-black/50 hover:bg-selected/90 transition-all scale-100 hover:scale-105 rounded-lg text-foreground placeholder-foreground/40 w-[120px] p-1 transition-all outline-none hover:bg-black/80' onClick={() => push(currentUserSettingsUrl())}>
              <Icon name='Edit' /> {t('Edit Profile')}
            </button>}
          <div className='w-full h-[40vh] mt-4 relative flex flex-col items-center items-end justify-end pb-10 bg-cover'>
            <RoundImage className='relative z-10 shadow-2xl' url={person.avatarUrl} xxlarge />
            <h1 className='text-white text-center text-2xl font-bold max-w-md relative z-10 mb-0'>{person.name}</h1>
            {person.location && (
              <div className='flex items-center gap-2 text-sm relative z-10 text-white '>
                <Icon name='Location' />
                {locationWithoutUsa}
              </div>
            )}
            <div
              className='w-[96%] shadow-2xl max-w-[750px] rounded-xl mx-auto h-[40vh] flex flex-col absolute top-0 z-0 items-center opacity-100 bg-black/80 left-[50%] translate-x-[-50%]'
            >
              <div style={{ backgroundImage: `url(${person.bannerUrl || '/default-user-banner.svg'})` }} className='w-full h-full opacity-70 bg-cover bg-center rounded-xl absolute top-0 left-0 z-1' />
              <div className='w-full h-full bg-gradient-to-b absolute top-0 left-0 from-transparent to-black/90 opacity-60 rounded-xl z-2' />
            </div>
          </div>
          <div className='-mt-5 mb-10 center flex gap-2 flex-row w-full items-center justify-center'>
            <ActionButtons items={actionButtonsItems} />
            <ActionDropdown items={actionDropdownItems} />
          </div>
          {(person.tagline || person.bio) && (
            <div className='flex items-center flex-col mb-4'>
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
          <div className='flex flex-col max-w-[720px] w-full'>
            {person.skills && person.skills.length > 0
              ? (
                <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-4 justify-center items-center'>
                  <div className='text-sm bg-midground text-foreground/50 uppercase absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-center'>{t('Skills & Interests')}</div>
                  <SkillsSection personId={personId} editable={false} t={t} />
                </div>)
              : (currentUser && currentUser.id === personId && (
                <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-4 text-center justify-center items-center'>
                  <div className='text-sm bg-midground text-foreground/50 uppercase absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-center'>{t('Skills & Interests')}</div>
                  <p className='text-foreground/50 mb-3'>{t('Add your skills and interests to your profile')}</p>
                  <button
                    onClick={() => push(currentUserSettingsUrl())}
                    className='focus:text-foreground relative text-sm border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md py-1.5 px-4 bg-background text-white transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 inline-flex items-center justify-center'
                  >
                    <Icon name='Edit' className='mr-2 text-white' />
                    {t('Edit Profile')}
                  </button>
                </div>
                ))}

            {person.skillsToLearn && person.skillsToLearn.length > 0 && (
              <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-4'>
                <div className='text-sm bg-midground text-foreground/50 uppercase absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-center'>
                  {t('What I\'m Learning')}
                </div>
                <SkillsToLearnSection personId={personId} editable={false} t={t} />
              </div>
            )}

            {memberships && memberships.length > 0
              ? (
                <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-4'>
                  <div className='text-sm bg-midground text-foreground/50 uppercase absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-center'>{t('Hylo Groups')}</div>
                  <div
                    ref={groupsRef}
                    className='flex flex-row flex-wrap items-center justify-center w-full overflow-hidden relative gap-2'
                    style={{
                      maxHeight: showAllGroups ? 'none' : `${GROUPS_DIV_HEIGHT}px`,
                      paddingBottom: showAllGroups ? '60px' : '0px'
                    }}
                  >
                    {memberships.map((m, index) => <Membership key={m.id} index={index} membership={m} />)}
                    {showExpandGroupsButton && (
                      <div>
                        <button onClick={toggleShowAllGroups} className='focus:text-foreground absolute bottom-0 left-1/2 -translate-x-1/2 text-sm border-2 border-foreground/20 z-10 hover:border-foreground/100 hover:text-foreground rounded-md py-1 px-2 bg-background text-foreground mb-[.5rem] transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex w-[200px] align-items justify-center mx-auto shadow-lg'>
                          {showAllGroups
                            ? 'Show Less'
                            : `Show All ${memberships.length} Groups`}
                        </button>
                        <div className='w-full h-[60px] bg-gradient-to-t from-midground to-transparent absolute bottom-0 left-0 z-0' />
                      </div>
                    )}
                  </div>
                </div>)
              : (
                <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-4 text-center'>
                  <div className='text-sm bg-midground text-foreground/50 absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-center'>{t('Hylo Groups')}</div>
                  <p className='text-foreground/50 mb-3'>{t('Find groups to join and collaborate with others')}</p>
                  <button
                    onClick={() => push('/groups/explorer')}
                    className='focus:text-foreground relative text-sm border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md py-1.5 px-4 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 inline-flex items-center justify-center'
                  >
                    <Icon name='Groups' className='mr-2' />
                    {t('Explore Groups')}
                  </button>
                </div>)}
            {roles.length > 0 && (
              <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-6'>
                <div className='bg-midground text-foreground/50 text-sm absolute -top-2.5 left-1/2 uppercase -translate-x-1/2 px-2 text-center'>{t('Roles in {{group}}', { group: group.name })}</div>
                <div className='flex flex-row flex-wrap items-center w-full relative gap-2 justify-center'>
                  {roles.map(role => (
                    <div key={role.id + role.common} className='flex flex-row p-2 bg-background rounded-lg items-center justify-center gap-2'>
                      <BadgeEmoji expanded {...role} responsibilities={role.responsibilities} id={person.id} />
                      <div className='text-sm text-foreground/50'>{role.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {affiliations && affiliations.length > 0
              ? (
                <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-6 items-center justify-center'>
                  <div className='text-sm bg-midground text-foreground/50 uppercase absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-center'>{t('Other Affiliations')}</div>
                  <div className='flex flex-row flex-wrap items-center w-full relative gap-2'>
                    {affiliations.map((a, index) => <Affiliation key={a.id} index={index} affiliation={a} />)}
                  </div>
                </div>)
              : (currentUser && currentUser.id === personId && (
                <div className='border-2 mt-8 border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative mb-4 text-center'>
                  <div className='sm:text-base text-sm bg-midground text-foreground/50 uppercase absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-center'>{t('Other Affiliations')}</div>
                  <p className='text-foreground/50 mb-3'>{t('Add your affiliations')}</p>
                  <button
                    onClick={() => push(currentUserSettingsUrl())}
                    className='focus:text-foreground relative text-sm border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md py-1.5 px-4 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 inline-flex items-center justify-center'
                  >
                    <Icon name='Edit' className='mr-2' />
                    {t('Edit Profile')}
                  </button>
                </div>))}

            {events && events.length > 0 && <div className={styles.profileSubhead}>{t('Upcoming Events')}</div>}
            {events && events.length > 0 && events.map((e, index) => <Event key={index} memberCap={3} event={e} routeParams={routeParams} />)}

            {projects && projects.length > 0 && <div className={styles.profileSubhead}>{t('Projects')}</div>}
            {projects && projects.length > 0 && projects.map((p, index) => <Project key={index} memberCap={3} project={p} routeParams={routeParams} />)}
          </div>
        </div>
        <div className='flex flex-col align-items-center max-w-[720px] w-full'>
          <div className='flex flex-row items-center justify-between w-full'>
            <h2 className='text-sm sm:text-base'>{currentContentTitle}</h2>
            <Dropdown
              id='member-profile-content-dropdown'
              items={contentDropDownItems}
              toggleChildren={
                <button className='focus:text-foreground relative text-sm border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md py-1 px-2 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center justify-center gap-2'>
                  {currentTabState} <Icon className='text-foreground' name='ArrowDown' />
                </button>
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

    return (
      <React.Fragment key={index}>
        <button
          className='focus:text-foreground shadow-lg relative text-base border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-105 flex items-center justify-center'
          onClick={onClick}
          data-tooltip-id={tooltipId}
          data-tooltip-content={value}
        >
          <Icon name={iconName} />
        </button>
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
      id='member-profile-action-dropdown'
      alignRight
      items={activeItems}
      toggleChildren={
        <button
          className='focus:text-foreground shadow-lg relative text-base border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-105 flex items-center justify-center'
        >
          <Icon className='-mt-[3px] mb-[3px]' name='More' />
        </button>
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
        <div className={styles.meta}>{creator.name} - {DateTimeHelpers.toDateTime(createdAt, { locale: getLocaleFromLocalStorage() }).toRelative()} </div>
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
        <div className={styles.month}>{DateTimeHelpers.toDateTime(startTime, { locale: getLocaleFromLocalStorage() }).toFormat('MMM')}</div>
        <div className={styles.day}>{DateTimeHelpers.toDateTime(startTime, { locale: getLocaleFromLocalStorage() }).toFormat('dd')}</div>
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
