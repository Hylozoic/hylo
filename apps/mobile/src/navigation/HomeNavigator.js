import React, { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { createStackNavigator } from '@react-navigation/stack'
import useOpenInitialURL from 'hooks/useOpenInitialURL'
import useReturnToOnAuthPath from 'hooks/useReturnToOnAuthPath'
import getReturnToOnAuthPath from 'store/selectors/getReturnToOnAuthPath'
// Helper Components
import TabStackHeader from 'navigation/headers/TabStackHeader'
// Screens
import AllTopicsWebView from 'screens/AllTopicsWebView'
import ChatRoom from 'screens/ChatRoomWebView'
import Stream from 'screens/Stream'
import GroupExploreWebView from 'screens/GroupExploreWebView'
import GroupNavigation from 'screens/GroupNavigation'
import Groups from 'screens/Groups'
import AllViews from 'screens/AllViews'
import MemberDetails from 'screens/MemberProfile/MemberDetails'
import MemberProfile from 'screens/MemberProfile'
import MembersComponent from 'screens/Members'
import PostDetails from 'screens/PostDetails'
import ProjectMembers from 'screens/ProjectMembers/ProjectMembers'
import MapWebView from 'screens/MapWebView/MapWebView'
import GroupWelcomeLanding from 'screens/GroupWelcomeFlow/GroupWelcomeLanding'
import { GROUP_WELCOME_LANDING } from 'screens/GroupWelcomeFlow/GroupWelcomeFlow.store'
import { useTranslation } from 'react-i18next'

const HomeTab = createStackNavigator()
export default function HomeNavigator ({ navigation }) {
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
      <HomeTab.Screen name='Group Navigation' component={GroupNavigation} />
      <HomeTab.Screen name='Stream' component={Stream} />
      <HomeTab.Screen name='All Views' component={AllViews} />
      <HomeTab.Screen name='Post Details' key='Post Details' component={PostDetails} />
      <HomeTab.Screen name='Projects' component={Stream} initialParams={{ streamType: 'project' }} />
      <HomeTab.Screen name='Project Members' key='Project Members' component={ProjectMembers} />
      <HomeTab.Screen name='Events' component={Stream} initialParams={{ streamType: 'event' }} />
      <HomeTab.Screen name='Decisions' component={Stream} initialParams={{ streamType: 'proposal' }} options={{ title: t('Decisions') }} />
      <HomeTab.Screen name='Members' component={MembersComponent} />
      <HomeTab.Screen name='Member' key='Member' component={MemberProfile} />
      <HomeTab.Screen name='Member Details' component={MemberDetails} />
      <HomeTab.Screen name='Group Relationships' component={Groups} />
      <HomeTab.Screen name='Group Explore' component={GroupExploreWebView} />
      <HomeTab.Screen name='Topics' component={AllTopicsWebView} />
      <HomeTab.Screen name='Map' component={MapWebView} />
      <HomeTab.Screen name='Chat' component={ChatRoom} />
      <HomeTab.Screen name='My Posts' component={Stream} initialParams={{ myHome: 'My Posts' }} />
      <HomeTab.Screen name='Announcements' component={Stream} initialParams={{ myHome: 'Announcements' }} />
      <HomeTab.Screen name='Mentions' component={Stream} initialParams={{ myHome: 'Mentions' }} />
      <HomeTab.Screen name='Interactions' component={Stream} initialParams={{ myHome: 'Interactions' }} />
      <HomeTab.Screen name={GROUP_WELCOME_LANDING} component={GroupWelcomeLanding} />
    </HomeTab.Navigator>
  )
}
