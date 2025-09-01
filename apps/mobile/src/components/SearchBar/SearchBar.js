import React, { useState, useRef, useEffect } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import Colors from '../../style/theme-colors'
import Icon from 'components/Icon'
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
    : <Icon name='Ex' style={[styles.cancelButton, style.cancelButton]} />

  return (
    <View style={[styles.container, style.container]}>
      <Icon style={[styles.searchIcon, style.searchIcon]} name='Search' />
      <TextInput
        autoFocus={autoFocus}
        onFocus={onFocus}
        style={[styles.searchInput, style.searchInput]}
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 3,
    borderColor: Colors.foreground50,
    borderRadius: 32
  },
  searchIcon: {
    marginLeft: 2,
    fontSize: 30,
    color: Colors.foreground50,
    backgroundColor: 'transparent'
  },
  searchInput: {
    margin: 0,
    padding: 0,
    top: 1,
    fontSize: 14,
    fontFamily: 'Circular-Book',
    flex: 1
  },
  loading: {
    paddingHorizontal: 10
  },
  cancel: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10
  },
  cancelButton: {
    fontSize: 20
  },
  cancelText: {
    marginLeft: 'auto',
    fontWeight: 'bold',
    fontSize: 14,
    color: Colors.secondary
  }
})
