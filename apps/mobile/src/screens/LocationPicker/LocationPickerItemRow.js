import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import { propTypesForItemRowComponent } from 'screens/ItemChooser'
import { pollingFindOrCreateLocation } from 'screens/LocationPicker/LocationPicker.store'
import Icon from 'components/Icon'
import { rhino80, rhino20, caribbeanGreen } from 'style/colors'
import { useDispatch } from 'react-redux'

export default function LocationPickerItemRow ({ item, onPress }) {
  const isGeocoded = item.id !== 'NEW'
  const dispatch = useDispatch()

  const selectLocation = locationData => {
    if (!isGeocoded) {
      onPress(locationData)
    } else {
      pollingFindOrCreateLocation(
        dispatch,
        locationData,
        locationObject => onPress(locationObject)
      )
    }
  }

  return (
    <TouchableOpacity style={styles.locationRow} onPress={() => selectLocation(item)}>
      {!isGeocoded && (
        <>
          <Icon name='Back' color={rhino80} style={styles.locationIcon} />
          <Text style={[styles.locationText, styles.notGeocodedRow]}>Use "{item.fullText}" (without mapping)</Text>
        </>
      )}
      {isGeocoded && (
        <>
          <Icon name='Location' color={caribbeanGreen} style={styles.locationIcon} />
          <Text style={styles.locationText}>{item.fullText}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}
LocationPickerItemRow.propTypes = propTypesForItemRowComponent

const styles = {
  locationRow: {
    paddingHorizontal: 13,
    paddingTop: 13,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: rhino20
  },
  notGeocodedRow: {
    color: rhino80
  },
  locationIcon: {
    marginRight: 10
  },
  locationText: {
    color: caribbeanGreen,
    fontWeight: 'normal',
    fontFamily: 'Circular-Bold',
    flex: 1
  }
}
