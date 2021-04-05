import React from 'react'
import { useSelector } from 'react-redux'
import { StyleSheet } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { isIOS } from 'util/platform'
// Helper Components
import Icon from 'components/Icon'
import { buildModalScreenOptions, buildTabStackScreenOptions } from 'navigation/header'
// Screens
import Feed from 'screens/Feed'
import MembersComponent from 'screens/Members'
import MemberProfile from 'screens/MemberProfile'
import TopicsComponent from 'screens/Topics'
import PostDetails from 'screens/PostDetails'
import MemberDetails from 'screens/MemberProfile/MemberDetails'
import MemberSkillEditor from 'screens/MemberProfile/MemberSkillEditor'
import ProjectMembers from 'screens/ProjectMembers/ProjectMembers'
import GroupNavigation from 'screens/GroupNavigation'
import { caribbeanGreen, gainsboro, gunsmoke, rhino05, white } from 'style/colors'
import Groups from 'screens/Groups'
import GroupDetail from 'screens/GroupDetail'
import NewMessage from 'screens/NewMessage'
import Thread from 'screens/Thread'
import ThreadList from 'screens/ThreadList'
import ThreadParticipants from 'screens/ThreadParticipants'
import SearchPage from 'screens/SearchPage'
import Avatar from 'components/Avatar'
import getMe from 'store/selectors/getMe'

const Messages = createStackNavigator()
export function MessagesNavigator () {
  const navigatorProps = {}
  return (
    <Messages.Navigator {...navigatorProps}>
      <Messages.Screen
        name='Messages' component={ThreadList}
        options={({ navigation }) => buildModalScreenOptions({
          headerRightButtonLabel: 'New',
          headerRightButtonOnPress: () => navigation.navigate('New Message'),
          headerLeftOnPress: () => navigation.navigate('Home')
        })}
      />
      <Messages.Screen
        name='New Message' component={NewMessage}
        options={({ navigation }) => buildModalScreenOptions({
          headerLeftCloseIcon: false,
          headerLeftLabel: ' '
        })}
      />
      <Messages.Screen
        name='ThreadParticipants' component={ThreadParticipants}
        options={({ navigation }) => buildModalScreenOptions({
          headerLeftCloseIcon: false,
          headerLeftLabel: ' ',
          headerTitle: 'Participants'
        })}
      />
      <Messages.Screen
        name='Thread' component={Thread}
        options={({ navigation }) => buildModalScreenOptions({
          headerLeftCloseIcon: false,
          headerLeftLabel: ' ',
          headerLeftOnPress: () => navigation.navigate('Messages')
        })}
      />
    </Messages.Navigator>
  )
}

const Search = createStackNavigator()
export function SearchNavigator () {
  const navigatorProps = {}
  return (
    <Search.Navigator {...navigatorProps}>
      <Search.Screen name='Search' component={SearchPage}
        options={({ navigation }) => buildModalScreenOptions({
          headerLeftOnPress: () => navigation.navigate('Home')
        })}        
      />
    </Search.Navigator>
  )
}

const Home = createStackNavigator()
export function HomeNavigator () {
  const navigatorProps = {
    screenOptions: buildTabStackScreenOptions
  }
  return (
    <Home.Navigator {...navigatorProps}>
      <Home.Screen name='Group Navigation' component={GroupNavigation} />
      <Home.Screen name='Feed' component={Feed} />
      <Home.Screen name='Topic Feed' key='Topic Feed' component={Feed} />
      <Home.Screen name='Post Details' key='Post Details' component={PostDetails} />
      <Home.Screen name='Projects' component={Feed} initialParams={{ isProjectFeed: true }} />
      <Home.Screen name='Project Members' key='Project Members' component={ProjectMembers} />
      <Home.Screen name='Members' component={MembersComponent} />
      <Home.Screen name='Member' key='Member' component={MemberProfile} />
      <Home.Screen name='MemberDetails' key='MemberDetails' component={MemberDetails} />
      <Home.Screen name='MemberSkillEditor' key='MemberSkillEditor' component={MemberSkillEditor}
        options={{ headerTitle: 'Edit Skills' }} />
      <Home.Screen name='Group Relationships' component={Groups} />
      <Home.Screen name='Group Detail' component={GroupDetail} />
      <Home.Screen name='Topics' component={TopicsComponent} />
    </Home.Navigator>
  )
}

const MyProfile = createStackNavigator()
export function MyProfileNavigator () {
  const navigatorProps = {
    // screenOptions: buildTabStackScreenOptions
  }
  return <MyProfile.Navigator {...navigatorProps}>
    <MyProfile.Screen name='My Profile' component={MemberDetails}
        options={({ navigation }) => buildModalScreenOptions({
          headerLeftOnPress: () => navigation.navigate('Home')
        })}
     />
  </MyProfile.Navigator>
}

const Tabs = createBottomTabNavigator()
export default function TabsNavigator () {
  const navigatorProps = {
    //
    // NOTE: This is required so the home tab is available 
    //       when path linking into the app to a child tab.
    // 
    //       Lazy loading so make sure to check for focus
    //       before fetching for the initial screen on 
    //       any Tab stack.
    //
    lazy: false,
    tabBarOptions: {
      showIcon: true,
      showLabel: true,
      // TODO: Required for Android, not iOS
      // Set only for Android as it makes undesirable animation in iOS
      keyboardHidesTabBar: !isIOS,
      pressColor: gainsboro,
      indicatorStyle: { backgroundColor: white },
      style: isIOS
        ? { backgroundColor: rhino05 }
        : { backgroundColor: rhino05, borderTopWidth: StyleSheet.hairlineWidth }
    },
    screenOptions: ({ route }) => ({
      tabBarIcon: ({ focused }) => (
        <Icon
          name={route.name}
          size={30}
          color={focused ? caribbeanGreen : gunsmoke}
          style={{ paddingTop: isIOS ? 0 : 5 }}
        />
      ),
      tabBarLabel: () => null
    })
  }
  const currentUser = useSelector(getMe)

  return (
    <Tabs.Navigator {...navigatorProps}>
      <Tabs.Screen name='Home' component={HomeNavigator} />
      <Tabs.Screen name='Search' component={SearchNavigator} />
      <Tabs.Screen name='Messages' component={MessagesNavigator} />
      <Tabs.Screen
        name='Profile'
        component={MyProfileNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <Avatar style={{
              borderWidth: 2,
              borderColor: focused ? caribbeanGreen : rhino05 }}
              dimension={34}
              hasBorder
              avatarUrl={currentUser?.avatarUrl}
            />
          )
        }}
      />
    </Tabs.Navigator>
  )
}
