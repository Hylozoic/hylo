import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { createStackNavigator } from '@react-navigation/stack'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useOpenInitialURL from 'hooks/useOpenInitialURL'
import useReturnToOnAuthPath from 'hooks/useReturnToOnAuthPath'
import getReturnToOnAuthPath from 'store/selectors/getReturnToOnAuthPath'
// Helper Components
import TabStackHeader from 'navigation/headers/TabStackHeader'
// Screens
import UserSettingsWebView from 'screens/UserSettingsWebView'
import GroupSettingsWebView from 'screens/GroupSettingsWebView'
import ChatRoomWebView from 'screens/ChatRoomWebView'
import Stream from 'screens/Stream'
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
  const initialURL = useSelector(state => state.initialURL)
  const returnToOnAuthPath = useSelector(getReturnToOnAuthPath)
  const { t } = useTranslation()

  useEffect(() => {
    if (!initialURL && !returnToOnAuthPath) {
      setTimeout(() => navigation.navigate('Stream'), 400)
    }
  }, [])

  useOpenInitialURL()
  useReturnToOnAuthPath()

  const navigatorProps = {
    initialRouteName: 'Group Navigation',
    screenOptions: {
      animationEnabled: !initialURL,
      title: currentGroup?.name || 'Home',
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
      <HomeTab.Screen name='Stream' component={Stream} />
      {/* WebView screens (may link/route internally) */}
      <HomeTab.Screen name='ChatRoom' component={ChatRoomWebView} />
      <HomeTab.Screen name='Group Settings' component={GroupSettingsWebView} />
      <HomeTab.Screen name='User Settings' component={UserSettingsWebView} />
      {/* Other screens */}
      <HomeTab.Screen name='All Views' component={AllViews} />
      <HomeTab.Screen name='Group Relationships' component={Groups} />
      <HomeTab.Screen name='Group Welcome' component={GroupWelcomeLanding} />
      <HomeTab.Screen name='Map' component={MapWebView} />
      <HomeTab.Screen name='Member' key='Member' component={MemberProfile} />
      <HomeTab.Screen name='Members' component={MembersComponent} />
      <HomeTab.Screen name='Member Details' component={MemberDetails} />
      <HomeTab.Screen name='Post Details' key='Post Details' component={PostDetails} />
      <HomeTab.Screen name='Project Members' key='Project Members' component={ProjectMembers} />
      <HomeTab.Screen name='Topics' component={AllTopicsWebView} />
    </HomeTab.Navigator>
  )
}
