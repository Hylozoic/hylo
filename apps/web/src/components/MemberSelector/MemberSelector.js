import React, { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { debounce, isEmpty, isEqual } from 'lodash/fp'
import fetchPeople from 'store/actions/fetchPeople'
import TagInput from 'components/TagInput'
import RoundImage from 'components/RoundImage'
import {
  addMember,
  removeMember,
  setMembers as setMembersAction,
  setAutocomplete,
  getMembers,
  getAutocomplete,
  getMemberMatches
} from './MemberSelector.store'
import classes from './MemberSelector.module.scss'

const EMPTY_MEMBERS = []

const MemberSelector = forwardRef(function MemberSelector (props, ref) {
  const {
    onChange,
    forGroups,
    readOnly,
    className,
    backgroundClassName,
    placeholder: placeholderProp
  } = props

  const initialMembers = props.initialMembers ?? EMPTY_MEMBERS

  const { t } = useTranslation()
  const dispatch = useDispatch()

  const members = useSelector(state => getMembers(state, props))
  const autocomplete = useSelector(state => getAutocomplete(state, props))
  const memberMatches = useSelector(state => getMemberMatches(state, props))

  const placeholder = placeholderProp ?? t('Type persons name...')

  const fetchPeopleDebounced = useMemo(
    () => debounce(300, (args) => dispatch(fetchPeople(args))),
    [dispatch]
  )

  useEffect(() => {
    dispatch(setMembersAction(initialMembers))
  }, [dispatch, initialMembers])

  const prevMemberIdsRef = useRef()
  useEffect(() => {
    const ids = members.map(m => m.id)
    if (prevMemberIdsRef.current !== undefined && !isEqual(ids, prevMemberIdsRef.current)) {
      onChange(members)
    }
    prevMemberIdsRef.current = ids
  }, [members, onChange])

  const handleInputChange = useCallback((input) => {
    dispatch(setAutocomplete(input))
    if (!isEmpty(input)) {
      fetchPeopleDebounced({
        autocomplete: input,
        groupIds: forGroups ? forGroups.map(c => c.id) : null
      })
    }
  }, [dispatch, forGroups, fetchPeopleDebounced])

  const handleAddition = useCallback((person) => {
    dispatch(addMember(person))
  }, [dispatch])

  const handleDelete = useCallback((person) => {
    dispatch(removeMember(person))
  }, [dispatch])

  return (
    <TagInput
      ref={ref}
      placeholder={placeholder}
      tags={members}
      suggestions={isEmpty(autocomplete) ? [] : memberMatches}
      handleInputChange={handleInputChange}
      handleAddition={handleAddition}
      handleDelete={handleDelete}
      readOnly={readOnly}
      theme={classes}
      inputClassName={className}
      renderSuggestion={Suggestion}
      backgroundClassName={backgroundClassName}
    />
  )
})

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

export default MemberSelector
