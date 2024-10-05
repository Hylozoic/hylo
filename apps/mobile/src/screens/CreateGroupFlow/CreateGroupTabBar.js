import React, { useEffect, useState } from 'react'
import { LayoutAnimation, View, Keyboard } from 'react-native'
import Button from 'components/Button'
import { useSelector } from 'react-redux'
import { getWorkflowOptions } from 'screens/CreateGroupFlow/CreateGroupFlow.store'
import { isIOS } from 'util/platform'
import {
  caribbeanGreen, rhino30, white, white20onCaribbeanGreen, white40onCaribbeanGreen
} from 'style/colors'
import { useKeyboard } from '@react-native-community/hooks'
import { useTranslation } from 'react-i18next'

export default function CreateGroupTabBar ({ state, descriptors, navigation }) {
  const { t } = useTranslation()
  const workflowOptions = useSelector(getWorkflowOptions)
  const disableContinue = !!workflowOptions?.disableContinue
  const [completeButtonDisabled, setCompleteButtonDisabled] = useState(false)
  const prevStepScreenName = state.routeNames[state.index - 1]
  const nextStepScreenName = state.routeNames[state.index + 1]
  const currentStepRouteKey = state.routes[state.index].key
  const keyboard = useKeyboard()
  const [keyboardWillShow, setKeyboardWillShow] = useState(false)

  useEffect(() => {
    const willShowSubscription = Keyboard.addListener('keyboardWillShow', (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(
        e.duration,
        LayoutAnimation.Types[e.easing],
        LayoutAnimation.Properties.scaleXY
      ))
      setKeyboardWillShow(true)
    })
    const willHideSubscription = Keyboard.addListener('keyboardWillHide', (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(
        e.duration,
        LayoutAnimation.Types[e.easing],
        LayoutAnimation.Properties.scaleXY
      ))
      setKeyboardWillShow(false)
    })
    return () => {
      willShowSubscription.remove()
      willHideSubscription.remove()
    }
  }, [])

  const gotoPrevStep = () => {
    setCompleteButtonDisabled(false)
    prevStepScreenName && navigation.navigate({ name: prevStepScreenName, merge: true })
  }

  const gotoNextStep = () =>
    nextStepScreenName && navigation.navigate({ name: nextStepScreenName, merge: true })

  const completeWorkflow = () => {
    navigation.emit({
      type: 'tabPress',
      target: currentStepRouteKey,
      canPreventDefault: true
    })
    setCompleteButtonDisabled(true)
  }

  const keyboardAdjustedHeight = keyboardWillShow
    ? keyboard.keyboardHeight + (isIOS ? 60 : 40)
    : (isIOS ? 80 : 60)

  return (
    <View style={[styles.container, { height: keyboardAdjustedHeight }]}>
      {prevStepScreenName && (
        <Button
          text={t('< Back')}
          onPress={gotoPrevStep}
          style={styles.backButton}
        />
      )}
      {nextStepScreenName && (
        <Button
          text={t('Continue')}
          onPress={gotoNextStep}
          style={styles.continueButton}
          disabled={disableContinue}
        />
      )}
      {!nextStepScreenName && (
        <Button
          text={t("Lets Do This!")}
          onPress={completeWorkflow}
          disabled={completeButtonDisabled}
          style={styles.continueButton}
        />
      )}
    </View>
  )
}

const buttonStyle = {
  height: 40,
  fontSize: 16,
  paddingBottom: isIOS ? 30 : 10
}

const styles = {
  container: {
    backgroundColor: white20onCaribbeanGreen,
    paddingTop: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  backButton: {
    ...buttonStyle,
    width: 100,
    color: white,
    backgroundColor: white40onCaribbeanGreen
  },
  continueButton: {
    ...buttonStyle,
    width: 134,
    marginLeft: 'auto',
    color: caribbeanGreen,
    backgroundColor: white,
    disabledColor: white,
    disabledBackgroundColor: rhino30
  }
}
