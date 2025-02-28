import React, { useEffect, useState } from 'react'
import { LayoutAnimation, View, Keyboard } from 'react-native'
import { useSelector } from 'react-redux'
import { getWorkflowOptions } from 'screens/CreateGroupFlow/CreateGroupFlow.store'
import { isIOS } from 'util/platform'
import { useKeyboard } from '@react-native-community/hooks'
import { useTranslation } from 'react-i18next'
import ButtonNW from 'components/Button/ButtonNW'

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
    <View 
      className="flex-row justify-between px-5 pt-2.5 bg-secondary/20"
      style={{ height: keyboardAdjustedHeight }}
    >
      <View className="w-[100px]">
        {prevStepScreenName && (
          <ButtonNW
            text={t('< Back')}
            onPress={gotoPrevStep}
            className="w-[100px] bg-secondary/40"
            textClassName="text-secondary-foreground"
          />
        )}
      </View>
      {nextStepScreenName && (
        <ButtonNW
          text={t('Continue')}
          onPress={gotoNextStep}
          disabled={disableContinue}
          className="w-[134px] bg-background"
          textClassName="text-secondary"
        />
      )}
      {!nextStepScreenName && (
        <ButtonNW
          text={t("Lets Do This!")}
          onPress={completeWorkflow}
          disabled={completeButtonDisabled}
          className="w-[134px] bg-background"
          textClassName="text-secondary"
        />
      )}
    </View>
  )
}
