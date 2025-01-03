/* eslint-disable react/no-unstable-nested-components */
import { View } from 'react-native'
import RNPickerSelect from 'react-native-picker-select'
import { useTranslation } from 'react-i18next'
import Icon from 'components/Icon'
import styles, { typeSelectorStyles } from './PostEditor.styles'
import { white } from 'style/colors'

export default function TypeSelector (props) {
  const { t } = useTranslation()
  // explicit invocation of dynamic labels
  t('Discussion')
  t('Request')
  t('Offer')
  t('Resource')
  t('Project')
  t('Event')
  return (
    <View style={styles.typeSelectorWrapper}>
      <RNPickerSelect
        {...props}
        style={typeSelectorStyles(props.value)}
        useNativeAndroidPickerStyle={false}
        pickerProps={{ itemStyle: { backgroundColor: white, letterSpacing: 2, fontWeight: 'bold', fontSize: 20 } }}
        items={
          ['Discussion', 'Request', 'Offer', 'Resource', 'Project', 'Event'].map(type => ({
            label: t(type).toUpperCase(),
            value: type.toLowerCase(),
            color: typeSelectorStyles(type.toLowerCase()).inputIOS.color
          }))
        }
        Icon={() => (
          <Icon name='ArrowDown' style={typeSelectorStyles(props.value).icon} />
        )}
      />
    </View>
  )
}
