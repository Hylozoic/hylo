import React from 'react'
import { StyleSheet, View } from 'react-native'
import { getFocusedRouteNameFromRoute } from '@react-navigation/native'
import { Header, HeaderBackButton, getHeaderTitle } from '@react-navigation/elements'
import FastImage from 'react-native-fast-image'
import { isIOS } from 'util/platform'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import FocusAwareStatusBar from 'components/FocusAwareStatusBar'
import Icon from 'components/Icon'
import { white, rhino80 } from 'style/colors'

// For now this list needs to be kept in sync with the names of the initial
// routes for each stack in navigation/TabsNavigator.
// export const TAB_STACK_ROOTS = [
//   'Stream',
//   'Messages Tab',
//   'Search Tab',
//   'Profile Tab',
//   'Group Welcome'
// ]

export default function TabStackHeader ({
  navigation,
  route,
  options,
  back,
  headerLeft,
  headerRight,
  // custom
  // rootsScreenNames = TAB_STACK_ROOTS,
  ...otherProps
}) {
  // const canGoBack = !rootsScreenNames.includes(route?.name)

  const props = {
    headerBackTitleVisible: false,
    title: getFocusedRouteNameFromRoute(route) || getHeaderTitle(options, route.name),
    headerTitle: options.headerTitle,
    headerTitleContainerStyle: {
      // Follow: https://github.com/react-navigation/react-navigation/issues/7057#issuecomment-593086348
      width: isIOS ? '55%' : '45%',
      alignItems: 'center',
      marginLeft: isIOS ? 0 : 10
    },
    headerTitleStyle: {
      color: white,
      fontFamily: 'Circular-Bold',
      fontSize: 18
    },
    headerTitleAlign: 'center',
    headerStyle: {
      backgroundColor: rhino80
    },
    headerLeft: headerLeft || options.headerLeft || (() => {
      let onPress = options.headerLeftOnPress

      if (!onPress) {
        onPress = navigation.openDrawer
        // onPress = canGoBack
        //   ? navigation.goBack
        //   : navigation.openDrawer

        // if (canGoBack && !navigation.canGoBack()) {
        //   onPress = () => navigation.navigate('Group Navigation')
        // }
      }

      return (
        <>
          <FocusAwareStatusBar barStyle='light-content' backgroundColor={rhino80} />
          <MenuButton onPress={onPress} />
        </>
      )
    }),
    headerRight
  }

  return <Header {...props} {...otherProps} />
}

export function MenuButton ({ canGoBack, onPress }) {
  const [{ currentGroup }] = useCurrentGroup()
  const avatarUrl = currentGroup?.headerAvatarUrl ||
    currentGroup?.avatarUrl

  return (
    <HeaderBackButton
      onPress={onPress}
      labelVisible={false}
      backImage={() => (
        <View style={styles.container}>
          <Icon name='Hamburger' style={styles.menuIcon} />
          {/* {!canGoBack
            ? <Icon name='Hamburger' style={styles.menuIcon} />
            : <Icon name='ArrowBack' style={styles.backIcon} />} */}
          <FastImage source={{ uri: avatarUrl }} style={styles.avatar} />
        </View>
      )}
    />
  )
}

export const styles = StyleSheet.create({
  headerIcon: {
    opacity: 0.75,
    color: white,
    backgroundColor: 'transparent',
    fontSize: 32,
    marginRight: 12
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  backIcon: {
    transform: [{ scaleX: -1 }],
    opacity: 0.75,
    backgroundColor: 'transparent',
    fontSize: 22,
    marginLeft: 10,
    color: 'white',
    marginRight: 17
  },
  menuIcon: {
    color: 'white',
    opacity: 0.75,
    backgroundColor: 'transparent',
    fontSize: 16,
    marginLeft: 10,
    marginRight: 10
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 4
  }
})
