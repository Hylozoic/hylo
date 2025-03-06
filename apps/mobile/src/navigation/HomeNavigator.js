import React, { useEffect } from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import useCurrentGroup, { useContextGroups } from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import useChangeToGroup from 'hooks/useChangeToGroup'
import useOpenInitialURL from 'hooks/useOpenInitialURL'
import useReturnToOnAuthPath from 'hooks/useReturnToOnAuthPath'
// Helper Components
import TabStackHeader from 'navigation/headers/TabStackHeader'
// Screens
import UserSettingsWebView from 'screens/UserSettingsWebView'
import GroupSettingsWebView from 'screens/GroupSettingsWebView'
import ChatRoomWebView from 'screens/ChatRoomWebView'
import Stream from 'screens/Stream'
import Moderation from 'screens/Moderation'
import AllTopicsWebView from 'screens/AllTopicsWebView'
import AllViews from 'screens/AllViews'
import Groups from 'screens/Groups'
import GroupWelcomeLanding from 'screens/GroupWelcomeFlow/GroupWelcomeLanding'
import MemberDetails from 'screens/MemberProfile/MemberDetails'
import MemberProfile from 'screens/MemberProfile'
import MembersComponent from 'screens/Members'
import PostDetails from 'screens/PostDetails'
import ProjectMembers from 'screens/ProjectMembers/ProjectMembers'
import MapWebView from 'screens/MapWebView/MapWebView'

const HomeTab = createStackNavigator()
export default function HomeNavigator ({ navigation }) {
  const [{ currentGroup }] = useCurrentGroup()
  const changeToGroup = useChangeToGroup()
  const { myContext, publicContext } = useContextGroups()
  const { context, groupSlug } = useRouteParams()

  // The following 3 steps are the final steps in linking within the app:

  // === initialURL ===
  // If the app was launched via navigation to a URL this hook retrieves
  // that path and navigates to it. The value is then cleared from memory,
  // but kept here temporarily to use as a flag to disable initial animations
  // for a more seamless initial loading experience.
  const initialURL = useOpenInitialURL()

  // === returnToOnAuth ===
  // When the app is launched or brought into focus via navigation to
  // a path which requires auth, and the user is not authorized, that
  // path is stored for later use in a zustand global store and then
  // navigated to here now that we're auth'd. The memory is then cleared.
  // Generally good UX, but especially important for handling of JoinGroup.
  useReturnToOnAuthPath()

  // === :context and :groupSlug path match handling ===
  // The context and groupSlug are retrieved from the screen params added by
  // any link that has those named params. They are used here to set that
  // context/group as current. The remaining route params from the matched link
  // are handled in the final component in the screen path (e.g. id for a
  // post/:id path match is retrieved in the PostDetails component).
  useEffect(() => {
    if (context === 'groups' && groupSlug) {
      changeToGroup(groupSlug, false)
    } else if ([myContext.slug, publicContext.slug].includes(context)) {
      changeToGroup(context, false)
    }
  }, [context, groupSlug])

  const navigatorProps = {
    screenOptions: {
      animationEnabled: !initialURL,
      title: currentGroup?.name || '',
      transitionSpec: {
        open: {
          animation: 'spring',
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01
        },
        close: {
          animation: 'spring',
          stiffness: 1000,
          damping: 500,
          mass: 3,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01
        }
      },
      headerMode: 'float',
      header: headerProps => <TabStackHeader {...headerProps} />
    }
  }

  return (
    <HomeTab.Navigator {...navigatorProps}>
      {/* WebView screens (may link/route internally) */}
      <HomeTab.Screen name='Chat Room' component={ChatRoomWebView} initialParams={{ topicName: 'home' }} />
      <HomeTab.Screen name='Group Settings' component={GroupSettingsWebView} />
      <HomeTab.Screen name='User Settings' component={UserSettingsWebView} />
      {/* Other screens */}
      <HomeTab.Screen name='Stream' component={Stream} />
      <HomeTab.Screen name='All Views' component={AllViews} />
      <HomeTab.Screen name='Group Relationships' component={Groups} />
      <HomeTab.Screen name='Group Welcome' component={GroupWelcomeLanding} />
      <HomeTab.Screen name='Map' component={MapWebView} />
      <HomeTab.Screen name='Member' key='Member' component={MemberProfile} />
      <HomeTab.Screen name='Members' component={MembersComponent} />
      <HomeTab.Screen name='Member Details' component={MemberDetails} />
      <HomeTab.Screen name='Moderation' component={Moderation} />
      <HomeTab.Screen name='Post Details' key='Post Details' component={PostDetails} />
      <HomeTab.Screen name='Project Members' key='Project Members' component={ProjectMembers} />
      <HomeTab.Screen name='Topics' component={AllTopicsWebView} />
    </HomeTab.Navigator>
  )
}
