import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import FastImage from 'react-native-fast-image'
import { useNavigation, useNavigationState } from '@react-navigation/native'
import { Header, HeaderBackButton } from '@react-navigation/elements'
import { ChevronLeft } from 'lucide-react-native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import { isIOS } from 'util/platform'
import FocusAwareStatusBar from 'components/FocusAwareStatusBar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import { twBackground } from 'style/colors'

export default function TabStackHeader ({
  options,
  back,
  headerLeft,
  headerRight,
  ...otherProps
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const stackScreenIndex = useNavigationState(state => state.index)
  const canGoBack = stackScreenIndex !== 0
  const [{ currentGroup }] = useCurrentGroup()

  const props = useMemo(() => ({
    headerBackTitleVisible: false,
    title: currentGroup?.name || t('Loading...'),
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
      backgroundColor: twBackground
    },
    headerLeft: headerLeft || options.headerLeft || (() => {
      let onPress = options.headerLeftOnPress

      if (!onPress) {
        onPress = canGoBack
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
                {currentGroup?.iconName && (
                  <LucideIcon size={28} name={currentGroup?.iconName} />
                )}
                {!currentGroup?.iconName && currentGroup?.avatarUrl && (
                  <FastImage style={styles.avatar} source={{ uri: currentGroup?.avatarUrl }} />
                )}
              </View>
            )}
          />
        </>
      )
    })
  }), [
    canGoBack,
    currentGroup?.name,
    options?.headerLeft,
    options?.headerLeftOnPress,
    options?.headerTitle
  ])

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
    width: 30,
    height: 30,
    borderRadius: 4
  }
})
