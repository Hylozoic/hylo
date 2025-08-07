import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { uniq, merge } from 'lodash/fp'
import LinkButton from '../LinkButton'
import Triangle from 'react-native-triangle'
import { amaranth, white } from '@hylo/presenters/colors'
import errorMessages from '../../util/errorMessages'

export const defaultStyles = {
  errorWrapper: {
    marginBottom: 10,
    alignItems: 'center'
  },
  error: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: amaranth,
    borderRadius: 100
  },
  errorText: {
    color: white,
    fontSize: 14
  },
  errorTriangle: {
    backgroundColor: amaranth
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
    const options = uniq(noPasswordMatch[1].split(',')
      .map(option => ({
        google: 'Google',
        'google-token': 'Google',
        facebook: 'Facebook',
        'facebook-token': 'Facebook',
        linkedin: 'LinkedIn',
        'linkedin-token': 'LinkedIn'
      }[option])))

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
          width={10} 
          height={5}
          color={styles.errorTriangle?.backgroundColor || amaranth}
          direction='up'
        />
      )}
      <View style={styles.error}>
        {children}
      </View>
    </View>
  )
}