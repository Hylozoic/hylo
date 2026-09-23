import { getAtAGlance, getFarmOpportunities, getOpenToPublic } from 'store/selectors/farmExtensionSelectors'

/** Returns the items a farm-profile widget should render, or a falsy value to hide it. */
export default function useGetWidgetItems ({ name, group, posts }) {
  if (!group) return false
  const postList = posts || []
  switch (name) {
    case 'mission': {
      return true
    }
    case 'relevant_events': {
      const items = postList.filter((post) => post.type === 'event')
      return items.length > 0 ? items : null
    }
    case 'relevant_requests_offers': {
      const items = postList.filter((post) => post.type === 'offer' || post.type === 'request')
      return items.length > 0 ? items : null
    }
    case 'relevant_project_activity': {
      const items = postList.filter((post) => post.type === 'project')
      return items.length > 0 ? items : null
    }
    case 'farm_details': {
      return !(group.settings && group.settings.hideExtensionData)
    }
    case 'farm_open_to_public': {
      return !(group.settings && group.settings.hideExtensionData) && getOpenToPublic(group)
    }
    case 'opportunities_to_collaborate': {
      return !(group.settings && group.settings.hideExtensionData) && getFarmOpportunities(group).length > 0
    }
    case 'farm_at_a_glance': {
      return !(group.settings && group.settings.hideExtensionData) && getAtAGlance(group).length > 0
    }
    case 'farm_map': {
      return group.locationObject && group.locationObject.center && posts
    }
    default: {
      return false
    }
  }
}
