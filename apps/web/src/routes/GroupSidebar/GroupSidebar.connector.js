import { connect } from 'react-redux'
import getRouteParam from 'store/selectors/getRouteParam'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'

export function mapStateToProps (state, props) {
  const group = getGroupForSlug(state, props)
  const members = group ? group.members.toModelArray().slice(0, 8) : []
  const stewards = group ? group.stewards.toModelArray() : []
  const myResponsibilities = getResponsibilitiesForGroup(state, { groupId: group.id }).map(r => r.title)

  return {
    group: group ? group.ref : null,
    members,
    myResponsibilities,
    stewards,
    slug: getRouteParam('groupSlug', props)
  }
}

export default connect(mapStateToProps)
