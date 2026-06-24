import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { addQuerystringToPath } from '@hylo/navigation'
import isPendingFor from 'store/selectors/isPendingFor'
import getMe from 'store/selectors/getMe'
import getPerson from 'store/selectors/getPerson'
import {
  addSkill,
  removeSkill,
  fetchMemberSkills,
  fetchSkillSuggestions,
  getMemberSkills,
  getSkillSuggestions,
  getSearch,
  setSearch
} from './SkillsToLearnSection.store'
import SkillsSection from '../SkillsSection/SkillsSection'

export default function SkillsToLearnSection (props) {
  const { personId } = props
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const search = useSelector(getSearch)

  const person = useSelector(state => getPerson(state, props))
  const currentUser = useSelector(state => getMe(state, props))
  const loading = useSelector(state => isPendingFor(fetchMemberSkills, state))
  const skillSuggestions = useSelector(state => getSkillSuggestions(state, { search, ...props }))
  const skills = useSelector(state => getMemberSkills(state, props))
  const isMe = currentUser && person && currentUser.id === person.id

  const addSkillFn = useCallback((name) => {
    dispatch(addSkill(name))
  }, [dispatch])

  const removeSkillFn = useCallback((skillId) => {
    dispatch(removeSkill(skillId))
  }, [dispatch])

  const fetchSkillSuggestionsFn = useCallback(() => {
    dispatch(fetchSkillSuggestions(search))
  }, [dispatch, search])

  const fetchMemberSkillsFn = useCallback(() => {
    dispatch(fetchMemberSkills(personId))
  }, [dispatch, personId])

  const setSearchFn = useCallback((s) => {
    dispatch(setSearch(s))
  }, [dispatch])

  const searchForSkill = useCallback((skill) => {
    const from = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : ''
    const path = addQuerystringToPath('/search', {
      t: skill,
      from: from && !from.startsWith('/search') ? from : undefined
    })
    dispatch(push(path))
  }, [dispatch])

  return (
    <SkillsSection
      {...props}
      label={t('Add a skill you want to learn')}
      placeholder={t('What skills do you want to learn?')}
      currentUser={currentUser}
      loading={loading}
      search={search}
      skillSuggestions={skillSuggestions}
      skills={skills}
      isMe={isMe}
      addSkill={addSkillFn}
      removeSkill={removeSkillFn}
      fetchSkillSuggestions={fetchSkillSuggestionsFn}
      fetchMemberSkills={fetchMemberSkillsFn}
      setSearch={setSearchFn}
      searchForSkill={searchForSkill}
    />
  )
}
