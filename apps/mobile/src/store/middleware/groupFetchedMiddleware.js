// import getMyMemberships from '../selectors/getMyMemberships'
// import getCurrentGroup from '../selectors/getCurrentGroup'
// import getMixpanel from '../selectors/getMixpanel'

// TODO: URQL - convert mixpanel handling
export default function groupFetchedMiddleware ({ getState }) {
  return next => async action => {
    // const wasCurrentGroup = getCurrentGroup(getState())
    const result = next(action)
    // const isCurrentGroup = getCurrentGroup(getState())
    // if (wasCurrentGroup?.id !== isCurrentGroup?.id) {
    //   const state = getState()
    //   await identifyMixpanelGroup(state)
    // }
    return result
  }
}

// async function identifyMixpanelGroup (state) {
//   const mixpanel = getMixpanel(state)
//   await mixpanel.init()
//   const memberships = getMyMemberships(state)
//   mixpanel.setGroup('groupId', memberships.map(m => m.group.id))
//   const currentGroup = getCurrentGroup(state)
//   if (currentGroup?.id) {
//     // Setup group profile info
//     mixpanel.getGroup('groupId', currentGroup.id).set({
//       $location: currentGroup.location,
//       $name: currentGroup.name,
//       type: currentGroup.type
//     })
//   }
// }
