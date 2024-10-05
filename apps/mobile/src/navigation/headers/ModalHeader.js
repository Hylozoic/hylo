import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Header, HeaderBackButton, getHeaderTitle } from '@react-navigation/elements'
import confirmDiscardChanges from 'util/confirmDiscardChanges'
import HeaderLeftCloseIcon from 'navigation/headers/HeaderLeftCloseIcon'
import FocusAwareStatusBar from 'components/FocusAwareStatusBar'
import {
  black10onRhino, rhino05, rhino80, rhino10, havelockBlue, ghost
} from 'style/colors'
import { useTranslation } from 'react-i18next'

export default function ModalHeader ({
  navigation,
  route,
  options,
  back,
  headerLeft,
  headerRight,
  // custom props
  headerLeftCloseIcon: providedHeaderLeftCloseIcon = true,
  headerLeftLabel,
  headerLeftOnPress: providedHeaderLeftOnPress,
  headerLeftConfirm,
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
  const { t } = useTranslation()
  const headerLeftCloseIcon = options.headerLeftCloseIcon ?? providedHeaderLeftCloseIcon
  const headerTitleStyleColor = otherProps.headerTitleStyle?.color ||
    (options.headerTitleStyle?.color ?? black10onRhino)
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
      // get go back function from navigation
      const headerLeftOnPress = options.headerLeftOnPress ||
        providedHeaderLeftOnPress ||
        navigation.goBack
      const onPress = headerLeftConfirm
        ? () => confirmDiscardChanges({ onDiscard: headerLeftOnPress, t })
        : headerLeftOnPress
      const label = headerLeftLabel || props.label
      return (
        <>
          <FocusAwareStatusBar {...statusBarOptions} />
          {headerLeftCloseIcon
            ? <HeaderLeftCloseIcon {...props} color={headerTitleStyleColor} onPress={onPress} />
            : <HeaderBackButton {...props} label={label} onPress={onPress} />}
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
