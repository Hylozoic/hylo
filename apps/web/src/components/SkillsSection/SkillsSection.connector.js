import { push } from 'redux-first-history'
import { connect } from 'react-redux'
import isPendingFor from 'store/selectors/isPendingFor'
import getMe from 'store/selectors/getMe'
import getPerson from 'store/selectors/getPerson'
import { addQuerystringToPath } from '@hylo/navigation'
import {
  addSkill,
  addSkillToGroup,
  removeSkill,
  removeSkillFromGroup,
  fetchMemberSkills,
  fetchSkillSuggestions,
  getMemberSkills,
  getSkillSuggestions,
  getSearch,
  setSearch
} from './SkillsSection.store'

export function mapStateToProps (state, props) {
  const person = getPerson(state, props)
  const currentUser = getMe(state, props)
  const search = getSearch(state)
  const group = props.group

  return {
    currentUser,
    loading: !group && isPendingFor(fetchMemberSkills, state),
    search,
    skillSuggestions: getSkillSuggestions(state, { search, ...props }),
    skills: group ? group.suggestedSkills : getMemberSkills(state, props),
    isMe: !group && currentUser && person && currentUser.id === person.id,
    group
  }
}

export function mapDispatchToProps (dispatch, props) {
  const group = props.group

  return {
    addSkill: group ? name => dispatch(addSkillToGroup(group.id, name)) : name => dispatch(addSkill(name)),
    removeSkill: group ? skillId => dispatch(removeSkillFromGroup(group.id, skillId)) : skillId => dispatch(removeSkill(skillId)),
    fetchSkillSuggestions: search => dispatch(fetchSkillSuggestions(search)),
    fetchMemberSkills: (id, limit) => dispatch(fetchMemberSkills(id, limit)),
    setSearch: search => dispatch(setSearch(search)),
    searchForSkill: (skill) => {
      const from = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : ''
      const path = addQuerystringToPath('/search', {
        t: skill,
        from: from && !from.startsWith('/search') ? from : undefined
      })
      dispatch(push(path))
    }
  }
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  return {
    ...ownProps,
    ...stateProps,
    ...dispatchProps,
    fetchMemberSkills: stateProps.group ? () => {} : () => dispatchProps.fetchMemberSkills(ownProps.personId),
    fetchSkillSuggestions: () => dispatchProps.fetchSkillSuggestions(stateProps.search)
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
