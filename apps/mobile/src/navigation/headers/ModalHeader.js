import { Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Header, getHeaderTitle } from '@react-navigation/elements'
import { ChevronLeft } from 'lucide-react-native'
import useConfirmAlert from 'hooks/useConfirmAlert'
import HeaderLeftCloseIcon from 'navigation/headers/HeaderLeftCloseIcon'
import useOpenURL from 'hooks/useOpenURL'
import FocusAwareStatusBar from 'components/FocusAwareStatusBar'
import { black10onRhino, rhino05, rhino80, rhino10, havelockBlue, ghost, rhino } from '@hylo/presenters/colors'
import { getLastParams } from 'hooks/useRouteParams'

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

  // Respect linking path for *back* navigation, when the app view is set by a notification
  // When the app is opened from a link/notification, it will open the content in a modal but not open the containing screen
  // This function ensures that the user is returned to the original path when the modal is closed
  const openURL = useOpenURL()

  // Safely get params from the provided `route` prop instead of useRoute (headers aren't screens)
  const { originalLinkingPath, id } = getLastParams(route) || {}

  // Based on the current linking table setup, when the app is opened from a link/notification,
  // It will open the content in a modal but not open the containing screeen
  // This function ensures that the user is returned to the original path when the modal is closed
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
      // Based on the navigation context (the stack of screens and the path),
      // we need to determine how to handle the closing of modals
      const defaultHeaderLeftOnPress = () => {
        if (navigation.canGoBack()) {
          navigation.goBack()
        } else {
          // Safe fallback when not in a normal stack (e.g., JoinGroup)
          openURL('/groups/my/no-context-fallback', { reset: true })
        }
      }
      const headerLeftOnPress = options.headerLeftOnPress ||
        providedHeaderLeftOnPress || respectOriginalPath ||
        defaultHeaderLeftOnPress
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
