import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from 'urql'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { white80onCaribbeanGreen } from '@hylo/presenters/colors'
import { LOCALE_EN_US, LOCALE_ES, normalizeLocaleToFull } from '@hylo/shared'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'

const LocaleSelector = ({ small, dark }) => {
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const { t, i18n } = useTranslation()
  const selectedLocale = i18n.language
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const currentUserResult = useCurrentUser()
  const currentUserData = currentUserResult ? currentUserResult[0]?.currentUser : null

  const handleSelectLocale = (locale) => {
    const normalizedLocale = normalizeLocaleToFull(locale)
    i18n.changeLanguage(normalizedLocale)
    setDropdownVisible(false)
    if (!currentUserData) return
    updateUserSettings({ changes: { settings: { locale: normalizedLocale } } })
  }

  // TODO: URQL! This keeps things from crashing when network is not active on load
  // fix another way.
  if (!currentUserData) {
    return null
  }

  const styles = StyleSheet.create({
    container: {
      padding: 4,
      backgroundColor: dark ? null : white80onCaribbeanGreen,
      borderRadius: 4,
      alignItems: 'center'
    },
    selectorButton: {
      padding: 8,
      borderRadius: 5,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: dark ? null : '#ccc',
      backgroundColor: dark ? '#aaa' : '#fff',
      width: '100%'
    },
    selectorButtonText: {
      fontSize: 12,
      color: dark ? 'white' : '#333'
    },
    dropdown: {
      marginTop: 10,
      left: 16,
      top: 12,
      position: 'absolute',
      width: '100%',
      backgroundColor: '#fff',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: '#ccc'
    },
    optionButton: {
      padding: 12,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#ccc'
    },
    selectedOption: {
      backgroundColor: '#007bff',
      borderColor: '#007bff'
    },
    optionText: {
      fontSize: 16,
      color: '#333'
    },
    selectedOptionText: {
      color: 'white'
    }
  })

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setDropdownVisible(!dropdownVisible)}
      >
        <Text style={styles.selectorButtonText}>
          {small ? '🌐' : `🌐 ${t('Language')}: ${normalizeLocaleToFull(selectedLocale) === LOCALE_ES ? 'Español' : 'English'}`}
        </Text>
      </TouchableOpacity>
      {dropdownVisible && (
        <View style={styles.dropdown}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              normalizeLocaleToFull(selectedLocale) === LOCALE_EN_US && styles.selectedOption
            ]}
            onPress={() => handleSelectLocale(LOCALE_EN_US)}
          >
            <Text
              style={[
                styles.optionText,
                normalizeLocaleToFull(selectedLocale) === LOCALE_EN_US && styles.selectedOptionText
              ]}
            >
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionButton,
              normalizeLocaleToFull(selectedLocale) === LOCALE_ES && styles.selectedOption
            ]}
            onPress={() => handleSelectLocale(LOCALE_ES)}
          >
            <Text
              style={[
                styles.optionText,
                normalizeLocaleToFull(selectedLocale) === LOCALE_ES && styles.selectedOptionText
              ]}
            >
              Español
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export default LocaleSelector
