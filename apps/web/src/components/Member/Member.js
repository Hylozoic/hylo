import PropTypes from 'prop-types'
import React from 'react'
import { withTranslation } from 'react-i18next'
import { connect } from 'react-redux'
import BadgeEmoji from 'components/BadgeEmoji'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import { MapPin } from 'lucide-react'
import { RESP_REMOVE_MEMBERS } from 'store/constants'
import { cn, bgImageStyle } from 'util/index'
import fetchPerson from 'store/actions/fetchPerson'
import getPerson from 'store/selectors/getPerson'

import classes from './Member.module.scss'

const { object, string, shape, func } = PropTypes

class Member extends React.Component {
  componentDidMount() {
    // Fetch complete person data when component mounts
    const { member, fetchPerson } = this.props
    if (member && member.id) {
      fetchPerson(member.id)
    }
  }

  removeOnClick (e, id, name, removeMember) {
    e.preventDefault()

    if (window.confirm(this.props.t('are you sure you want to remove {{name}}?', { name }))) {
      removeMember(id)
    }
  }

  render () {
    const {
      className,
      group,
      member,
      personFromStore,
      goToPerson,
      removeMember,
      currentUserResponsibilities,
      roles,
      t
    } = this.props

    // Use data from Redux store if available, otherwise fall back to the member prop
    const personData = personFromStore || member
    const { id, name, location, tagline, avatarUrl } = member

    // Get bannerUrl from the Redux store data if available
    const bannerUrl = personData.bannerUrl || ' '

    return (
      <div className={cn('flex flex-col gap-2 bg-card/100 rounded-lg p-2 shadow-lg hover:bg-card/100 transition-all hover:scale-102 relative overflow-hidden', className)} data-testid='member-card'>
        {(currentUserResponsibilities.includes(RESP_REMOVE_MEMBERS)) &&
          <Dropdown
            className={classes.dropdown}
            toggleChildren={<Icon name='More' />}
            items={[{ icon: 'Trash', label: t('Remove'), onClick: (e) => this.removeOnClick(e, id, name, removeMember) }]}
          />}
        <div onClick={goToPerson(id, group.slug)} className='flex flex-row gap-2 z-10 relative'>
          <div className='min-w-16 min-h-16 max-h-16 rounded-full bg-cover' style={bgImageStyle(avatarUrl)} />
          <div className='flex flex-col gap-0 justify-center'>
            <div className='text-base whitespace-nowrap flex flex-row gap-1 items-center'>
              <span className='font-bold'>{name}</span>
              <div className='text-sm inline-flex gap-1'>
                {roles.map(role => (
                  <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={id} />
                ))}
              </div>
            </div>
            {location && <div className='text-xs text-foreground/70 flex items-center gap-1'><MapPin className='w-3 h-3' /> {location}</div>}
            {tagline && <div className='text-base text-foreground/100'>{tagline}</div>}
          </div>
        </div>
        <div className='absolute inset-0 w-full h-full bg-cover bg-center z-0 opacity-30' style={bgImageStyle(bannerUrl)} />
      </div>
    )
  }
}

Member.propTypes = {
  className: string,
  group: object,
  member: shape({
    id: string,
    name: string,
    location: string,
    tagline: string,
    avatarUrl: string,
    bannerUrl: string
  }).isRequired,
  fetchPerson: func,
  personFromStore: object
}

// Map state to props to get the person data from Redux store
function mapStateToProps(state, ownProps) {
  return {
    personFromStore: ownProps.member && ownProps.member.id ? getPerson(state, ownProps.member.id) : null
  }
}

export default connect(
  mapStateToProps,
  { fetchPerson }
)(withTranslation()(Member))
