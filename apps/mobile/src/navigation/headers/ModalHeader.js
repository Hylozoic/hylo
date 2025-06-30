import { Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Header, getHeaderTitle } from '@react-navigation/elements'
import { ChevronLeft } from 'lucide-react-native'
import useConfirmAlert from 'hooks/useConfirmAlert'
import HeaderLeftCloseIcon from 'navigation/headers/HeaderLeftCloseIcon'
import useRouteParams from 'hooks/useRouteParams'
import useOpenURL from 'hooks/useOpenURL'
import FocusAwareStatusBar from 'components/FocusAwareStatusBar'
import { black10onRhino, rhino05, rhino80, rhino10, havelockBlue, ghost, rhino } from 'style/colors'

export default function ModalHeader ({
  navigation,
  route,
  options,
  back,
  headerLeft,
  headerRight,
  // custom props
  headerLeftCloseIcon: providedHeaderLeftCloseIcon = true,
  headerLeftOnPress: providedHeaderLeftOnPress,
  headerLeftConfirm,
  headerLeftStyle,
  headerRightButtonLabel = 'Save',
  headerRightButtonOnPress,
  headerRightButtonDisabled,
  headerRightButtonStyle,
  headerTransparent = false,
  statusBarOptions = {
    backgroundColor: rhino05,
    barStyle: 'dark-content'
  },
  ...otherProps
}) {
  const confirmAlert = useConfirmAlert()
  const openURL = useOpenURL()
  const { originalLinkingPath, id, commentId } = useRouteParams()

  const respectOriginalPath = (() => {
    if (!id || !originalLinkingPath) return null
    
    const postPathPattern = `/post/${id}`
    const basePathEndIndex = originalLinkingPath.indexOf(postPathPattern)
    
    if (basePathEndIndex === -1) return null
    
    return () => {
      const basePath = originalLinkingPath.substring(0, basePathEndIndex)
      openURL(basePath, { replace: true })
    }
  })()

  const headerLeftCloseIcon = options.headerLeftCloseIcon ?? providedHeaderLeftCloseIcon
  const headerTitleStyleColor = otherProps.headerTitleStyle?.color || options.headerTitleStyle?.color || black10onRhino
  const headerLeftStyleColor = options?.headerLeftStyle?.color || headerLeftStyle?.color || rhino
  const props = {
    headerTransparent: typeof options.headerTransparent !== 'undefined' ? options.headerTransparent : headerTransparent,
    headerStatusBarHeight: options.headerStatusBarHeight ?? (options.presentation ? 0 : undefined),
    headerStyle: {
      backgroundColor: rhino10,
      ...options.headerStyle
    },
    headerTitle: options.headerTitle,
    title: getHeaderTitle(options, route.name),
    headerTintColor: rhino80,
    headerTitleAlign: 'center',
    headerTitleStyle: {
      color: headerTitleStyleColor,
      fontFamily: 'Circular-Bold'
    },
    headerLeft: headerLeft || options.headerLeft || (props => {
      const headerLeftOnPress = options.headerLeftOnPress ||
        providedHeaderLeftOnPress || respectOriginalPath ||
        navigation.goBack
      const onPress = headerLeftConfirm
        ? () => confirmAlert({ onConfirm: headerLeftOnPress })
        : headerLeftOnPress
      return (
        <>
          <FocusAwareStatusBar {...statusBarOptions} />
          {headerLeftCloseIcon
            ? <HeaderLeftCloseIcon {...props} color={headerLeftStyleColor} onPress={onPress} />
            : <Pressable onPress={onPress}><ChevronLeft size={32} color={headerLeftStyleColor} style={{ marginLeft: 10 }} /></Pressable>}
        </>
      )
    }),
    headerRight: headerRight || (() => headerRightButtonOnPress && (
      <HeaderRightButton
        disabled={headerRightButtonDisabled}
        label={headerRightButtonLabel}
        onPress={headerRightButtonOnPress}
        style={headerRightButtonStyle}
      />
    ))
  }

  return <Header {...props} {...otherProps} />
}

export function HeaderRightButton ({
  label,
  onPress,
  style,
  disabled = false
}) {
  if (typeof onPress !== 'function') throw new Error('HeaderRightButton: onPress is not a function.')

  return (
    <TouchableOpacity
      style={{ marginRight: 12 }}
      onPress={onPress}
      hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
      disabled={disabled}
    >
      <Text style={[styles.button, style, disabled && styles.disabled]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    fontFamily: 'Circular-Book',
    fontSize: 17,
    color: havelockBlue,
    fontWeight: 'bold'
  },
  disabled: {
    color: ghost,
    fontWeight: 'normal'
  }
})
