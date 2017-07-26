import {
  DrawerNavigator,
  TabNavigator,
  StackNavigator
} from 'react-navigation'
import { Dimensions, Platform } from 'react-native'

import WelcomeScene from '../WelcomeScene'
import Feed from '../Feed'
import Post from '../Post'
import Settings from '../Settings'
import DrawerMenu from '../DrawerMenu'
import { Home, Members, Topics } from '../Tabs'
import stacksInTabsFactory from './stacksInTabsFactory'
import PostEditor from '../PostEditor'
import DetailsEditor from '../PostEditor/DetailsEditor'
import PostDetails from '../PostDetails'
import MemberProfile from '../MemberProfile'
import CommentEditor from '../PostDetails/CommentEditor'
import ThreadList from '../ThreadList'
import tabStyles from '../Tabs/Tabs.styles'

// Tab Home Screens
const tabs = {
  Home: {screen: Home},
  Members: {screen: Members},
  Topics: {screen: Topics}
}

// Screens that work within Tabs (the same tab icon stays highlighted)
const screensInTabs = {
  Post: {screen: Post},
  Feed: {screen: Feed},
  WelcomeScene: {screen: WelcomeScene},
  PostEditor: {screen: PostEditor},
  DetailsEditor: {screen: DetailsEditor},
  PostDetails: {screen: PostDetails},
  MemberProfile: {screen: MemberProfile},
  CommentEditor: {screen: CommentEditor}
}

// Screens that work outside of tabs, Settings, Messages, etc.
const screensInStack = {
  Settings: {screen: Settings},
  ThreadList: {screen: ThreadList}
}

Object.freeze(tabs)
Object.freeze(screensInTabs)

const tabNavigatorConfig = {
  tabBarPosition: 'bottom',
  animationEnabled: false,
  swipeEnabled: false,
  tabBarOptions: {
    showIcon: true,
    showLabel: true,
    indicatorStyle: {
      display: 'none'
    },
    style: (Platform.OS === 'ios') ? tabStyles.tabNavigatorIOS : tabStyles.tabNavigatorAndroid
  }
}

const TabNavigatorWithBar = TabNavigator(
  stacksInTabsFactory(tabs, screensInTabs),
  tabNavigatorConfig
)

const drawerNavigatorRoutes = {
  Home: { screen: TabNavigatorWithBar }
}

const drawerNavigatorConfig = {
  contentComponent: DrawerMenu,
  initialRouteName: 'Home',
  drawerWidth: Dimensions.get('window').width * 0.9
}

const DrawerAndTabsNavigator = DrawerNavigator(
  drawerNavigatorRoutes,
  drawerNavigatorConfig
)

const mainStackRoute = {
  Main: {
    screen: DrawerAndTabsNavigator,
    navigationOptions: {
      header: null
    }
  }
}

const rootNavigatorRoutes = Object.assign({}, mainStackRoute, screensInStack)

const RootNavigator = StackNavigator(
  rootNavigatorRoutes,
  {
    mode: 'modal'
  }
)

export default RootNavigator
