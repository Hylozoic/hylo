import React from 'react'
import {
  View,
  TouchableOpacity,
  TextInput,
  Text
} from 'react-native'
import Icon from 'components/Icon'
import styles from './SearchBar.styles'
import Loading from 'components/Loading'

export default function SearchBar ({
  value,
  onChangeText,
  placeholder,
  onCancel,
  onCancelText,
  onFocus,
  autoFocus = false,
  loading,
  disabled = false,
  style = {}
}) {
  const Cancel = () => onCancelText
    ? <Text style={styles.cancelText}>{onCancelText}</Text>
    : <Icon name='Ex' style={styles.cancelButton} />

  return (
    <View style={[styles.searchBar, style]}>
      <Icon style={styles.searchIcon} name='Search' />
      <TextInput
        autoFocus={autoFocus}
        onFocus={onFocus}
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize='none'
        autoCorrect={false}
        underlineColorAndroid='transparent'
        editable={!disabled}
      />
      {loading && <Loading style={styles.loading} />}
      {!loading && value?.length > 0 && onCancel && (
        <TouchableOpacity style={styles.cancel} onPress={onCancel}>
          <Cancel />
        </TouchableOpacity>
      )}
    </View>
  )
}
