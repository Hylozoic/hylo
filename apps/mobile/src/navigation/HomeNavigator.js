import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { Header } from '@react-navigation/elements'
import { useHandleCurrentGroup, useHandleCurrentGroupSlug } from 'hooks/useHandleCurrentGroup'
// Helper Components
import TabStackHeader from 'navigation/headers/TabStackHeader'
import { twBackground } from '@hylo/presenters/colors'
// Screens
import NoContextFallbackScreen from 'screens/NoContextFallbackScreen'
import UserSettingsWebView from 'screens/UserSettingsWebView'
import GroupSettingsWebView from 'screens/GroupSettingsWebView'
import ChatRoomWebView from 'screens/ChatRoomWebView'
import Stream from 'screens/Stream'
import Moderation from 'screens/Moderation'
import AllViews from 'screens/AllViews'
import Groups from 'screens/Groups'
import Tracks from 'screens/Tracks'
import MyTracks from 'screens/MyTracks'
import TrackDetail from 'screens/TrackDetail'
import GroupWelcome from 'screens/GroupWelcome'
import GroupWelcomePage from 'screens/GroupWelcome/GroupWelcomePage'
import HyloWebView from 'components/HyloWebView'
import MemberDetails from 'screens/MemberProfile/MemberDetails'
import MemberProfile from 'screens/MemberProfile'
import MembersComponent from 'screens/Members'
import ProjectMembers from 'screens/ProjectMembers/ProjectMembers'
import MapWebView from 'screens/MapWebView/MapWebView'
import PostDetails from 'screens/PostDetails'
import ContextMenu from 'screens/ContextMenu'

const HomeTab = createStackNavigator()
export default function HomeNavigator () {
  // THE ORDER OF THESE HOOKS MATTERS!
  useHandleCurrentGroupSlug()
  useHandleCurrentGroup()

  const navigatorProps = {
    initialRouteName: 'No Context Fallback', // This is an emergency fallback to avoid rare blank screen loads. Tempting to replace with a loading UI that centralizes some redirection logic
    screenOptions: {
      header: props => <TabStackHeader {...props} />,
      headerMode: 'float'
    }
  }

  return (
    <HomeTab.Navigator {...navigatorProps}>
      <HomeTab.Screen
        name='No Context Fallback'
        component={NoContextFallbackScreen}
                  options={{
            header: () => (
              <Header
                title="Hylo"
                headerTitleAlign="center"
                headerLeft={() => null}
                headerStyle={{ backgroundColor: twBackground }}
                headerTitleStyle={{
                  fontFamily: 'Circular-Bold',
                  fontSize: 18
                }}
              />
            )
          }}
      />
      {/* WebView screens (may link/route internally) */}
      <HomeTab.Screen name='Chat Room' component={ChatRoomWebView} />
      <HomeTab.Screen name='Group Settings' component={GroupSettingsWebView} />
      <HomeTab.Screen name='User Settings' component={UserSettingsWebView} />
      <HomeTab.Screen name='Web View' component={HyloWebView} />
      {/* Other screens */}
      <HomeTab.Screen name='Stream' component={Stream} />
      <HomeTab.Screen name='All Views' component={AllViews} />
      <HomeTab.Screen name='Tracks' component={Tracks} />
      <HomeTab.Screen name='My Tracks' component={MyTracks} />
      <HomeTab.Screen name='Track Detail' component={TrackDetail} />
      <HomeTab.Screen name='Group Relationships' component={Groups} />
      <HomeTab.Screen name='Group Welcome' component={GroupWelcome} />
      <HomeTab.Screen name='Group Welcome Page' component={GroupWelcomePage} />
      <HomeTab.Screen name='Map' component={MapWebView} />
      <HomeTab.Screen name='Member' key='Member' component={MemberProfile} />
      <HomeTab.Screen name='Members' component={MembersComponent} />
      <HomeTab.Screen name='Member Details' component={MemberDetails} />
      <HomeTab.Screen name='Moderation' component={Moderation} />
      <HomeTab.Screen name='Post Details' component={PostDetails} />
      <HomeTab.Screen name='Project Members' key='Project Members' component={ProjectMembers} />
      <HomeTab.Screen name='Context Menu' component={ContextMenu} />
    </HomeTab.Navigator>
  )
}
