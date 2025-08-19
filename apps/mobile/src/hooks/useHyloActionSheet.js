import 'react'
import { useActionSheet } from '@expo/react-native-action-sheet'
import { isEmpty, filter } from 'lodash/fp'
import Colors from '../style/theme-colors'
import { isIOS } from 'util/platform'
import { DefaultTheme } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

/*

  Example usage:

    ```
    const { showHyloActionSheet } = useHyloActionSheet

    showHyloActionSheet({
      actions: [
        ['This is the Label', actionFunction, <Icon ... (only applies to Android)  />, destructive],
        ...
      ],
      // alternatively pass in `@expo/react-native-action-sheet` options which takes all
      // `ActionSheetIOS` options with additions. See docs for that library.
    }, afterSelect)
    ```

  * May wish to convert to https://github.com/react-native-menu/menu soon to support iOS 14 style popup menus
*/
export default function useHyloActionSheet () {
  const { t } = useTranslation()
  const { showActionSheetWithOptions } = useActionSheet()

  return {
    showHyloActionSheet: ({ actions: providedActions, ...overrideParams }, afterSelect) => {
      // Eliminate any actions without an action function
      let actions = filter(action => action[1], providedActions)

      // Do nothing if no actions left
      if (isEmpty(actions)) return

      // Add "Cancel" item at the end
      actions = [
        ...actions,
        // <Icon name='Ex' key='cancel' style={{ fontSize: 18, margin: 0, padding: 0, color: pictonBlue }} />
        [t('Cancel'), null]
      ]

      const options = actions.map(action => action[0])
      const cancelButtonIndex = actions.length - 1
      const destructiveButtonIndex = []

      actions.forEach((action, index) => {
        if (action[2] && action[2]?.destructive) {
          destructiveButtonIndex.push(index)
        }
      })

      const onSelect = index => {
        actions[index][1] && actions[index][1]()

        if (afterSelect) {
          afterSelect(actions[index])
        }
      }

      const icons = actions.map(action => action[2] && action[2]?.icon)

      showActionSheetWithOptions(
        {
          options,
          tintColor: DefaultTheme.primaryColor,
          cancelButtonIndex,
          cancelButtonTintColor: isIOS ? DefaultTheme.primaryColor : Colors.secondary,
          destructiveButtonIndex,
          // Great options for adding more context (e.g. Title of Post, etc)
          // title: '',
          // message: '',
          // Above params are compatible with RN iOS ActionSheet
          // The following params are specific to `@expo/react-native-action-sheet`
          // and only relevant for Android.
          icons,
          showSeparators: true,
          containerStyle: { padding: 10 },
          textStyle: { fontSize: 18 },
          ...overrideParams
        },
        onSelect
      )
    }
  }
}
