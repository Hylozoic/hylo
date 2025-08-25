import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { isEmpty, merge, uniq } from 'lodash/fp'
import Colors from '../../style/theme-colors'
import LinkButton from 'components/LinkButton'
import Triangle from 'react-native-triangle'
import errorMessages from 'util/errorMessages'

export const defaultStyles = {
  errorWrapper: {
    marginBottom: 10,
    alignItems: 'center'
  },
  error: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.destructive,
    borderRadius: 100
  },
  errorText: {
    color: Colors.muted,
    fontSize: 14
  },
  errorTriangle: {
    backgroundColor: Colors.destructive
  }
}

export default function FormattedError ({
  error,
  action = 'Operation',
  styles: providedStyles = {},
  theme = {}
}) {
  const { t } = useTranslation()

  if (!error) return null

  const styles = merge(defaultStyles, providedStyles, theme)

  const noPasswordMatch = error.match(/password account not found. available: \[(.*)\]/)

  if (noPasswordMatch) {
    const optionMap = {
      google: 'Google',
      'google-token': 'Google',
      facebook: 'Facebook',
      'facebook-token': 'Facebook',
      linkedin: 'LinkedIn',
      'linkedin-token': 'LinkedIn'
    }
    const options = uniq(noPasswordMatch[1].split(',')
      .map(option => optionMap[option]))

    return (
      <Error styles={styles}>
        <Text style={styles.errorText}>
          {t('Your account has no password set')}. <LinkButton to='/reset-password'>{t('Set your password here')}.</LinkButton>
        </Text>
        {options[0] && (
          <Text style={styles.errorText}>{t('Or log in with')} {options.join(' or ')}.</Text>
        )}
      </Error>
    )
  }

  const errorMessageText = errorMessages(error, action)

  return (
    <Error styles={styles}>
      {errorMessageText && (
        <Text style={styles.errorText}>{t(errorMessageText)}</Text>
      )}
    </Error>
  )
}

export function Error ({ children, styles }) {
  return (
    <View style={styles.errorWrapper}>
      {!styles.hideErrorTriangle && (
        <Triangle
          styles={styles?.errorTriangle}
          width={10} height={5}
          color={styles.errorTriangle?.backgroundColor}
          direction='up'
        />
      )}
      <View style={styles.error}>
        {children}
      </View>
    </View>
  )
}
