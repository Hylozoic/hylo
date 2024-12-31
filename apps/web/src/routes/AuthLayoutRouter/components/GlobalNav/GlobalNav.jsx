import cx from 'classnames'
import { get } from 'lodash/fp'
import { Globe } from 'lucide-react'
import React, { Suspense, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useIntercom } from 'react-use-intercom'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { replace } from 'redux-first-history'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import Badge from 'components/Badge'
import BadgedIcon from 'components/BadgedIcon'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import GlobalNavItem from './GlobalNavItem'
import { toggleDrawer, toggleGroupMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getMyGroups from 'store/selectors/getMyGroups'
import logout from 'store/actions/logout'
import { CONTEXT_MY } from 'store/constants'
import { PUBLIC_CONTEXT_AVATAR_PATH } from 'store/models/Group'
import { hyloLogo, publicLogo } from 'util/assets'
import { bgImageStyle } from 'util/index'
import { localeToFlagEmoji, localeLocalStorageSync } from 'util/locale'
import { isMobileDevice, downloadApp } from 'util/mobile'
import { baseUrl, personUrl } from 'util/navigation'

import styles from './GlobalNav.module.scss'

const MessagesDropdown = React.lazy(() => import('./MessagesDropdown'))
const NotificationsDropdown = React.lazy(() => import('./NotificationsDropdown'))
const LocaleDropdown = React.lazy(() => import('./LocaleDropdown'))

export default function GlobalNav (props) {
  const dispatch = useDispatch()
  const {
    currentUser,
    group,
    onClick,
    routeParams,
    showMenuBadge
  } = props
  const { show: showIntercom } = useIntercom()
  const groups = useSelector(getMyGroups)

  const profileUrl = personUrl(get('id', currentUser))
  const isPublic = routeParams.context === 'public'
  const isMyHome = routeParams.context === CONTEXT_MY
  const locale = currentUser?.settings?.locale
  const localeFlag = localeToFlagEmoji(localeLocalStorageSync(locale))

  const appStoreLinkClass = isMobileDevice() ? 'isMobileDevice' : 'isntMobileDevice'
  const { t } = useTranslation()

  const handleLogout = async () => {
    dispatch(replace('/login', null))
    await dispatch(logout())
  }

  return (
    <div className={cx('flex flex-col bg-theme-background h-full z-50 items-center pb-2')} onClick={onClick}>
      <div className='overflow-y-auto py-2 px-3 flex flex-col items-center'>
        {/* <div className={styles.drawerToggle} id='toggleDrawer'>
          <button className={styles.drawerToggleButton} onClick={handleToggleDrawer}><Icon name='Hamburger' className={styles.menuIcon} /></button>
          {showMenuBadge && <Badge number='1' className={styles.logoBadge} border />}
        </div> */}
        {/* <Link
          to={baseUrl(pick(['context', 'groupSlug'], routeParams))}
          onClick={handleToggleGroupMenu}
          className={cx(styles.currentContext, { [styles.groupMenuOpen]: isGroupMenuOpen })}
          id='currentContext'
        >
          <Logo {...{ group, isPublic }} />
          <Title group={group} isPublic={isPublic} isMyHome={isMyHome} />
        </Link> */}
        <Dropdown
          className={cx(styles.navMenu, 'z-50')}
          alignLeft
          noOverflow
          toggleChildren={
            <GlobalNavItem img={get('avatarUrl', currentUser)} tooltip={t('Your Profile')} />
          }
        >
          <li>
            <Link className={styles.hoverHighlight} to={profileUrl}>
              {t('Profile')}
            </Link>
          </li>
          <li><Link className={styles.hoverHighlight} to='/settings'>{t('Settings')}</Link></li>
          <li>
            <Suspense fallback={<span>{t('Locale')} {localeFlag}</span>}>
              <LocaleDropdown className={styles.localeDropdown} renderToggleChildren={<span className={styles.locale}>{t('Locale')} {localeFlag}</span>} />
            </Suspense>
          </li>
          <li><a onClick={handleLogout}>{t('Log out')}</a></li>
        </Dropdown>

        <Suspense fallback={<GlobalNavItem><BadgedIcon name='Notifications' className={styles.icon} /></GlobalNavItem>}>
          <NotificationsDropdown renderToggleChildren={showBadge =>
            <GlobalNavItem tooltip='Activity'>
              <BadgedIcon name='Notifications' className='!text-primary-foreground cursor-pointer font-md' showBadge={showBadge} />
            </GlobalNavItem>}
          />
        </Suspense>

        <Suspense fallback={<GlobalNavItem><BadgedIcon name='Messages' className={styles.icon} /></GlobalNavItem>}>
          <MessagesDropdown renderToggleChildren={showBadge =>
            <GlobalNavItem tooltip='Messages'>
              <BadgedIcon name='Messages' className='!text-primary-foreground cursor-pointer font-md' showBadge={showBadge} />
            </GlobalNavItem>}
          />
        </Suspense>

        <GlobalNavItem tooltip={t('Public')} url='/public'>
          <Globe color='hsl(var(--primary-foreground))' />
        </GlobalNavItem>

        {groups.map(group =>
          <GlobalNavItem
            key={group.id}
            badgeCount={group.newPostCount || 0}
            img={group.avatarUrl}
            tooltip={group.name}
            url={`/groups/${group.slug}`}
          />
        )}
      </div>

      <Link to='/search'><Icon name='Search' className={styles.icon} /></Link>

      <GlobalNavItem onClick={() => {}}>
        +
      </GlobalNavItem>

      <Popover>
        <PopoverTrigger>
          <span className='inline-block text-themeForeground border-2 border-themeForeground rounded-xl p-1 w-10 line-height-1'>?</span>
        </PopoverTrigger>
        <PopoverContent side='right' align='start'>
          <ul>
            <li><span className={styles.hoverHighlight} onClick={showIntercom}>{t('Feedback & Support')}</span></li>
            <li><a href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide' target='_blank' rel='noreferrer' className={styles.hoverHighlight}>{t('User Guide')}</a></li>
            <li><a href='http://hylo.com/terms/' target='_blank' rel='noreferrer' className={styles.hoverHighlight}>{t('Terms & Privacy')}</a></li>
            <li><span className={cx(styles.hoverHighlight, styles[appStoreLinkClass])} onClick={downloadApp}>{t('Download App')}</span></li>
            <li><a href='https://opencollective.com/hylo' target='_blank' rel='noreferrer' className={styles.hoverHighlight}>{t('Contribute to Hylo')}</a></li>
          </ul>
        </PopoverContent>
      </Popover>
      {/* <Dropdown
        className={cx(styles.navMenu, styles.supportMenu)}
        alignLeft
        toggleChildren={

        }
      >

      </Dropdown> */}
    </div>
  )
}

function Logo ({ group, isPublic }) {
  let imageStyle = bgImageStyle(hyloLogo)
  if (group) {
    imageStyle = bgImageStyle(get('avatarUrl', group))
  } else if (isPublic) {
    imageStyle = bgImageStyle(publicLogo)
  }

  return (
    <span className={styles.image} style={imageStyle}>
      <span>
        <Icon name='Home' className={styles.homeLink} />
        <Icon name='Ex' className={styles.closeGroupMenu} />
      </span>
    </span>
  )
}

function Title ({ group, isPublic, onClick, isMyHome }) {
  const { t } = useTranslation()
  let [label, name] = [t('PERSONAL'), t('All My Groups')]
  if (group) {
    [label, name] = [group.typeDescriptor, group.name]
  } else if (isPublic) {
    [label, name] = [t('GLOBAL'), t('Public Groups & Posts')]
  } else if (isMyHome) {
    [label, name] = [t('PERSONAL'), t('My Home')]
  }

  return (
    <div className={styles.title}>
      <div className={styles.label}>{label}</div>
      <div className={styles.groupName}>{name}</div>
    </div>
  )
}
