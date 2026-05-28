import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { addQuerystringToPath } from '@hylo/navigation'
import { isEmpty, map } from 'lodash'
import { cn } from 'util/index'
import isPendingFor from 'store/selectors/isPendingFor'
import getMe from 'store/selectors/getMe'
import getPerson from 'store/selectors/getPerson'
import Pillbox from 'components/Pillbox'
import Loading from 'components/Loading'
import {
  addSkill as addSkillAction,
  addSkillToGroup,
  removeSkill as removeSkillAction,
  removeSkillFromGroup,
  fetchMemberSkills,
  fetchSkillSuggestions,
  getMemberSkills,
  getSkillSuggestions,
  getSearch,
  setSearch
} from './SkillsSection.store'
import classes from './SkillsSection.module.scss'

export default function SkillsSection (props) {
  const {
    group,
    personId,
    editable = true,
    label: labelProp,
    placeholder: placeholderProp,
    skills: skillsProp
  } = props

  const isControlled = skillsProp !== undefined

  const { t } = useTranslation()
  const dispatch = useDispatch()

  const searchFromStore = useSelector(getSearch)
  const person = useSelector(state => getPerson(state, props))
  const currentUser = useSelector(state => getMe(state, props))
  const loadingFromStore = useSelector(state => !group && isPendingFor(fetchMemberSkills, state))
  const skillSuggestionsFromStore = useSelector(state => getSkillSuggestions(state, { search: searchFromStore, ...props }))
  const skillsFromStore = useSelector(state => (group ? group.suggestedSkills : getMemberSkills(state, props)))
  const isMeFromStore = !group && currentUser && person && currentUser.id === person.id

  const search = isControlled ? props.search : searchFromStore
  const loading = isControlled ? props.loading : loadingFromStore
  const skillSuggestions = isControlled ? props.skillSuggestions : skillSuggestionsFromStore
  const skills = isControlled ? skillsProp : skillsFromStore
  const isMe = isControlled ? props.isMe : isMeFromStore

  const addSkillRedux = useCallback((name) => {
    if (group) {
      dispatch(addSkillToGroup(group.id, name))
    } else {
      dispatch(addSkillAction(name))
    }
  }, [dispatch, group])

  const removeSkillRedux = useCallback((skillId) => {
    if (group) {
      dispatch(removeSkillFromGroup(group.id, skillId))
    } else {
      dispatch(removeSkillAction(skillId))
    }
  }, [dispatch, group])

  const fetchSkillSuggestionsRedux = useCallback(() => {
    dispatch(fetchSkillSuggestions(searchFromStore))
  }, [dispatch, searchFromStore])

  const fetchMemberSkillsRedux = useCallback(() => {
    if (!group) {
      dispatch(fetchMemberSkills(personId))
    }
  }, [dispatch, group, personId])

  const setSearchRedux = useCallback((s) => {
    dispatch(setSearch(s))
  }, [dispatch])

  const searchForSkillRedux = useCallback((skill) => {
    const from = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : ''
    const path = addQuerystringToPath('/search', {
      t: skill,
      from: from && !from.startsWith('/search') ? from : undefined
    })
    dispatch(push(path))
  }, [dispatch])

  const addSkill = isControlled ? props.addSkill : addSkillRedux
  const removeSkill = isControlled ? props.removeSkill : removeSkillRedux
  const fetchSkillSuggestionsFn = isControlled ? props.fetchSkillSuggestions : fetchSkillSuggestionsRedux
  const fetchMemberSkillsFn = isControlled ? props.fetchMemberSkills : fetchMemberSkillsRedux
  const setSearchFn = isControlled ? props.setSearch : setSearchRedux
  const searchForSkill = isControlled ? props.searchForSkill : searchForSkillRedux

  useEffect(() => {
    fetchMemberSkillsFn?.()
  }, [personId, fetchMemberSkillsFn])

  useEffect(() => {
    if (!isEmpty(search)) {
      fetchSkillSuggestionsFn?.()
    }
  }, [search, fetchSkillSuggestionsFn])

  const handleInputChange = useCallback((input) => {
    setSearchFn?.(input)
  }, [setSearchFn])

  const handleAddition = useCallback((skill) => {
    setSearchFn?.('')
    addSkill?.(skill.name)
  }, [setSearchFn, addSkill])

  const handleDelete = useCallback((skillId) => {
    removeSkill?.(skillId)
  }, [removeSkill])

  const handleClick = useCallback((skillId, skillLabel) => {
    searchForSkill?.(skillLabel)
  }, [searchForSkill])

  if (loading) return <Loading />

  const label = labelProp ?? t('Add a Skill or Interest')
  const placeholder = placeholderProp ?? t('What skills and interests do you have?')

  return (
    <div className={cn('relative w-full', classes.expanded)}>
      <Pillbox
        pills={map(skills, skill => ({ ...skill, label: skill.name }))}
        handleInputChange={handleInputChange}
        handleClick={handleClick}
        handleAddition={handleAddition}
        handleDelete={handleDelete}
        editable={editable && (isMe || group)}
        addLabel={label}
        placeholder={placeholder}
        suggestions={skillSuggestions}
      />
    </div>
  )
}
