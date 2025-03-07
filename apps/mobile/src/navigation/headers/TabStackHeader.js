import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import { getFocusedRouteNameFromRoute, useNavigation } from '@react-navigation/native'
import { Header, HeaderBackButton, getHeaderTitle } from '@react-navigation/elements'
import { ChevronLeft } from 'lucide-react-native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { isIOS } from 'util/platform'
import FocusAwareStatusBar from 'components/FocusAwareStatusBar'
import { black, white } from 'style/colors'

export default function TabStackHeader ({
  route,
  options,
  back,
  headerLeft,
  headerRight,
  ...otherProps
}) {
  const navigation = useNavigation()
  const [{ currentGroup }] = useCurrentGroup()
  const avatarUrl = currentGroup?.headerAvatarUrl ||
    currentGroup?.avatarUrl

  const props = {
    headerBackTitleVisible: false,
    // NOTE: The previous default TabStackheader was as follows, which is likely near the
    // the React Navigation default:
    // getFocusedRouteNameFromRoute(route) || getHeaderTitle(options, route.name),
    title: currentGroup?.name,
    headerTitle: options.headerTitle,
    headerTitleContainerStyle: {
      // Follow: https://github.com/react-navigation/react-navigation/issues/7057#issuecomment-593086348
      alignItems: 'left',
      marginLeft: isIOS ? 10 : 20
    },
    headerTitleStyle: {
      fontFamily: 'Circular-Bold',
      fontSize: 16
    },
    headerTitleAlign: 'left',
    headerStyle: {
      backgroundColor: white
    },
    headerLeft: headerLeft || options.headerLeft || (() => {
      let onPress = options.headerLeftOnPress

      if (!onPress) {
        onPress = navigation.canGoBack()
          ? navigation.goBack
          : navigation.openDrawer
      }

      return (
        <>
          <FocusAwareStatusBar />
          <HeaderBackButton
            onPress={onPress}
            labelVisible={false}
            backImage={({ tintColor }) => (
              <View style={styles.container}>
                <ChevronLeft style={styles.backIcon} color={tintColor} size={30} />
                <FastImage style={styles.avatar} source={{ uri: avatarUrl }} />
              </View>
            )}
          />
        </>
      )
    })
  }

  return <Header {...props} {...otherProps} />
}

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  backIcon: {
    marginHorizontal: 5
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 4
  }
})
