/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import moment from 'moment-timezone'
import DatePicker from 'react-native-date-picker'
import Icon from 'components/Icon'
import styles, { typeSelectorStyles } from './PostEditor.styles'

export default function DatePickerWithLabel ({
  date,
  minimumDate,
  label,
  onSelect,
  disabled,
  style,
  styleTemplate = {
    disabled: styles.pressDisabled,
    expandIconWrapper: styles.pressSelectionRight,
    expandIcon: styles.pressSelectionRightIcon,
    labelText: styles.pressSelectionLeftText,
    labelWrapper: styles.pressSelection,
    valueText: styles.pressSelectionValue
  },
  dateFormat = 'MM/DD/YYYY LT z'
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const handleOnPress = () => {
    !disabled && setOpen(true)
  }
  const handleOnConfirm = newDate => {
    onSelect(newDate)
    setOpen(false)
  }
  const handleOnCancel = () => {
    onSelect(null)
    setOpen(false)
  }

  return (
    <>
      <TouchableOpacity style={style} onPress={handleOnPress}>
        <View style={styleTemplate.labelWrapper}>
          <Text style={[styleTemplate.labelText, disabled && styleTemplate.disabled]}>
            {label}
          </Text>
          <View style={[styleTemplate.expandIconWrapper, disabled && styleTemplate.disabled]}>
            <Icon name='ArrowDown' style={[styleTemplate.expandIcon, disabled && styleTemplate.disabled]} />
          </View>
        </View>
        {date && !open && (
          <Text style={styleTemplate.valueText}>{moment.tz(date, moment.tz.guess()).format(dateFormat)}</Text>
        )}
      </TouchableOpacity>
      <DatePicker
        modal
        open={open}
        minimumDate={minimumDate}
        minuteInterval={5}
        date={date || new Date()}
        mode='datetime'
        title={label}
        confirmText={t('Set')}
        cancelText={t('Clear')}
        onConfirm={handleOnConfirm}
        onCancel={handleOnCancel}
      />
    </>
  )
}
