import { combineReducers } from 'redux'

import orm from './ormReducer'
import returnToPath from 'store/reducers/returnToPath'
import pending from './pending'
import locationHistory from './locationHistory'
import resetStore from './resetStore'
import mixpanel from './mixpanel'
import queryResults from './queryResults'
import { composeReducers, handleSetState } from './util'

// Local store
// generator-marker-local-store-import
import AllTopics from 'routes/AllTopics/AllTopics.store'
import AttachmentManager from 'components/AttachmentManager/AttachmentManager.store'
import CreateGroup from 'components/CreateGroup/CreateGroup.store'
import CreateTopic from 'components/CreateTopic/CreateTopic.store'
import FullPageModal from 'routes/FullPageModal/FullPageModal.store'
import MapExplorer from 'routes/MapExplorer/MapExplorer.store'
import Messages from 'routes/Messages/Messages.store'
import Members from 'routes/Members/Members.store'
import MembershipRequests from 'routes/GroupSettings/MembershipRequestsTab/MembershipRequestsTab.store'
import MemberSelector from 'components/MemberSelector/MemberSelector.store'
import RoleSettings from 'routes/GroupSettings/RolesSettingsTab/RolesSettingsTab.store'
import PeopleTyping from 'components/PeopleTyping/PeopleTyping.store'
import PostEditor from 'components/PostEditor/PostEditor.store'
import AuthLayoutRouter from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import RelatedGroups from 'routes/GroupSettings/RelatedGroupsTab/RelatedGroupsTab.store'
import SavedSearches from 'routes/UserSettings/UserSettings.store'
import SkillsSection from 'components/SkillsSection/SkillsSection.store'
import SkillsToLearnSection from 'components/SkillsToLearnSection/SkillsToLearnSection.store'
import TopicsSettings from 'routes/GroupSettings/TopicsSettingsTab/TopicsSettingsTab.store'
import UserGroupsTab from 'routes/UserSettings/UserGroupsTab/UserGroupsTab.store'

export const createCombinedReducers = routerReducer => combineReducers({
  // Global store
  orm,
  router: routerReducer,
  returnToPath,
  pending,
  queryResults,
  locationHistory,
  mixpanel,

  // Local store (Component)
  // generator-marker-local-store-reducer
  AllTopics,
  AttachmentManager,
  CreateGroup,
  CreateTopic,
  FullPageModal,
  MembershipRequests,
  MapExplorer,
  Members,
  MemberSelector,
  Messages,
  RoleSettings,
  PeopleTyping,
  AuthLayoutRouter,
  PostEditor,
  RelatedGroups,
  SavedSearches,
  SkillsSection,
  SkillsToLearnSection,
  TopicsSettings,
  UserGroupsTab
})

export default function createRootReducer (routerReducer) {
  return composeReducers(
    createCombinedReducers(routerReducer),
    /*

      DANGEROUS: These mutate and/or reset the entire state object

      Not sure why then need to added using our `composeReducers`
      utility function with appears to do the same things as redux's
      `combineReducers`. If I remember right correctly this is so these
      somehow run in a 2nd reducer cycle to eliminate an infinite reducer
      update condition? Not convinced they can't just go at the bottom above ^

    */
    resetStore,
    handleSetState
  )
}
