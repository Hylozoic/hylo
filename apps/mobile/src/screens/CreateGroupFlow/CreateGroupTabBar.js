import React, { useState } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getWorkflowOptions } from 'screens/CreateGroupFlow/CreateGroupFlow.store'
import ButtonNW from 'components/Button/ButtonNW'

export default function CreateGroupTabBar ({ state, descriptors, navigation }) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const workflowOptions = useSelector(getWorkflowOptions)
  const disableContinue = !!workflowOptions?.disableContinue
  const [completeButtonDisabled, setCompleteButtonDisabled] = useState(false)
  const prevStepScreenName = state.routeNames[state.index - 1]
  const nextStepScreenName = state.routeNames[state.index + 1]
  const currentStepRouteKey = state.routes[state.index].key

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

  return (
    <View className='flex-row justify-between px-5 bg-midground' style={{ paddingBottom: insets.bottom }}>
      <View className='w-[100px]'>
        {prevStepScreenName && (
          <ButtonNW
            text={t('< Back')}
            onPress={gotoPrevStep}
            className='w-[100px] bg-foreground/5'
            textClassName='text-foreground/80'
          />
        )}
      </View>
      {nextStepScreenName && (
        <ButtonNW
          text={t('Continue')}
          onPress={gotoNextStep}
          disabled={disableContinue}
          className='w-[134px] border-2 border-foreground/50'
          textClassName='text-foreground'
        />
      )}
      {!nextStepScreenName && (
        <ButtonNW
          text={t('Lets Do This!')}
          onPress={completeWorkflow}
          disabled={completeButtonDisabled}
          className='w-[134px] border-2 border-foreground/50'
          textClassName='text-foreground'
        />
      )}
    </View>
  )
}
