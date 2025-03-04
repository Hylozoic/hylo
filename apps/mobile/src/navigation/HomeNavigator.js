import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
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
import MembersComponent from 'screens/Members'
import ProjectMembers from 'screens/ProjectMembers/ProjectMembers'
import MapWebView from 'screens/MapWebView/MapWebView'

const HomeTab = createStackNavigator()
export default function HomeNavigator ({ navigation }) {
  const [{ currentGroup }] = useCurrentGroup()
  const initialURL = useOpenInitialURL()
  useReturnToOnAuthPath()

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
      <HomeTab.Screen name='Members' component={MembersComponent} />
      <HomeTab.Screen name='Moderation' component={Moderation} />
      <HomeTab.Screen name='Project Members' key='Project Members' component={ProjectMembers} />
      <HomeTab.Screen name='Topics' component={AllTopicsWebView} />
    </HomeTab.Navigator>
  )
}
