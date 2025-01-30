import React from 'react'
import { isEmpty } from 'lodash/fp'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import WorkflowModalHeader from 'navigation/headers/WorkflowModalHeader'
import CreateGroupTabBar from 'screens/CreateGroupFlow/CreateGroupTabBar'
import { GROUP_ACCESSIBILITY } from 'frontend-shared/presenters/GroupPresenter'
// Screens
import CreateGroupName from 'screens/CreateGroupFlow/CreateGroupName'
import CreateGroupUrl from 'screens/CreateGroupFlow/CreateGroupUrl'
import CreateGroupVisibilityAccessibility from 'screens/CreateGroupFlow/CreateGroupVisibilityAccessibility'
import CreateGroupPurpose from 'screens/CreateGroupFlow/CreateGroupPurpose'
import CreateGroupParentGroups from 'screens/CreateGroupFlow/CreateGroupParentGroups'
import CreateGroupReview from 'screens/CreateGroupFlow/CreateGroupReview'
import { white20onCaribbeanGreen } from 'style/colors'
import useCurrentUser from 'frontend-shared/hooks/useCurrentUser'

const CreateGroupTabs = createBottomTabNavigator()

export default function CreateGroupTabsNavigator () {
  const [{ currentUser }] = useCurrentUser()
  const memberships = currentUser?.memberships
  const parentGroupOptions = memberships
    .filter(m => m.hasModeratorRole || m.group.accessibility === GROUP_ACCESSIBILITY.Open)
  const hasParentGroupOptions = !isEmpty(parentGroupOptions)
  const totalSteps = hasParentGroupOptions ? 6 : 5
  const navigatorProps = {
    tabBar: props => <CreateGroupTabBar {...props} />,
    // NOTE: This is how to have back button functionality
    // backBehavior: 'order',
    screenOptions: {
      // animationEnabled: false,
      animationTypeForReplace: 'push',
      lazy: false,
      header: headerProps => {
        const close = () => headerProps.navigation.navigate('Drawer')
        return (
          <WorkflowModalHeader
            {...headerProps}
            headerLeftCloseIcon
            headerLeftOnPress={close}
            style={{ backgroundColor: white20onCaribbeanGreen }}
          />
        )
      }
    }
  }

  return (
    <CreateGroupTabs.Navigator {...navigatorProps}>
      <CreateGroupTabs.Screen
        name='CreateGroupName'
        component={CreateGroupName}
        options={{ title: `STEP 1/${totalSteps}`, headerLeftCloseIcon: true }}
      />
      <CreateGroupTabs.Screen
        name='CreateGroupUrl'
        component={CreateGroupUrl}
        options={{ title: `STEP 2/${totalSteps}` }}
      />
      <CreateGroupTabs.Screen
        name='CreateGroupPurpose'
        component={CreateGroupPurpose}
        options={{ title: `STEP 3/${totalSteps}` }}
      />
      <CreateGroupTabs.Screen
        name='CreateGroupVisibilityAccessibility'
        component={CreateGroupVisibilityAccessibility}
        options={{ title: `STEP 4/${totalSteps}` }}
      />
      {hasParentGroupOptions && (
        <CreateGroupTabs.Screen
          name='CreateGroupParentGroups'
          component={CreateGroupParentGroups}
          options={{ title: `STEP ${totalSteps - 1}/${totalSteps}` }}
        />
      )}
      <CreateGroupTabs.Screen
        name='CreateGroupReview'
        component={CreateGroupReview}
        options={{ title: `STEP ${totalSteps}/${totalSteps}` }}
      />
    </CreateGroupTabs.Navigator>
  )
}
