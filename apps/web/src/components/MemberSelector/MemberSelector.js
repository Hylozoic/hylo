import React, { Component } from 'react'
import TagInput from 'components/TagInput'
import RoundImage from 'components/RoundImage'
import { isEmpty, isEqual } from 'lodash/fp'
import { withTranslation } from 'react-i18next'

import classes from './MemberSelector.module.scss'

class MemberSelector extends Component {
  componentDidMount () {
    this.props.setMembers()
  }

  componentDidUpdate (prevProps) {
    // if member list has changed
    if (!isEqual(this.props.members.map(m => m.id), prevProps.members.map(m => m.id))) {
      // update in the parent component
      this.props.onChange(this.props.members)
    }
    // if initial member list has changed
    if (this.props.initialMembers && (!prevProps.initialMembers || !isEqual(this.props.initialMembers.map(m => m.id), prevProps.initialMembers.map(m => m.id)))) {
      this.props.setMembers()
    }
  }

  handleInputChange = input => {
    const { forGroups } = this.props
    this.props.setAutocomplete(input)
    if (!isEmpty(input)) {
      // this fetched should be debounced or throttled, maybe here, or in the connector
      this.props.fetchPeople({ autocomplete: input, groupIds: forGroups ? forGroups.map(c => c.id) : null })
    }
  }

  handleAddition = person => {
    this.props.addMember(person)
  }

  handleDelete = person => {
    this.props.removeMember(person)
  }

  render () {
    const {
      placeholder = this.props.t('Type persons name...'),
      readOnly,
      memberMatches,
      autocomplete,
      members = [],
      className,
      backgroundClassName
    } = this.props

    return (
      <TagInput
        placeholder={placeholder}
        tags={members}
        suggestions={isEmpty(autocomplete) ? [] : memberMatches}
        handleInputChange={this.handleInputChange}
        handleAddition={this.handleAddition}
        handleDelete={this.handleDelete}
        readOnly={readOnly}
        theme={classes}
        inputClassName={className}
        renderSuggestion={Suggestion}
        backgroundClassName={backgroundClassName}
      />
    )
  }
}

export function Suggestion ({ item, handleChoice }) {
  const { id, name, avatarUrl } = item
  return (
    <li key={id || 'blank'}>
      <a onClick={event => handleChoice(item, event)} className={classes.suggestionLink}>
        <RoundImage url={avatarUrl} className={classes.suggestionAvatar} small />
        <div className={classes.suggestionName}>{name}</div>
      </a>
    </li>
  )
}

export default withTranslation()(MemberSelector)
