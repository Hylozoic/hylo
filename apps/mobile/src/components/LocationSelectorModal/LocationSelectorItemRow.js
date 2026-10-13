import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import useFindOrCreateLocationObject from '@hylo/hooks/useFindOrCreateLocationObject'
import { PLAIN_TEXT_LOCATION_ID } from './LocationSelectorModal'
import Icon from 'components/Icon'
import { rhino80, rhino20, caribbeanGreen, alabaster } from '@hylo/presenters/colors'

export default function LocationSelectorItemRow ({ item, onPress, colors = {} }) {
  const [, findOrCreateLocationObject] = useFindOrCreateLocationObject()
  const isGeocoded = item.id !== PLAIN_TEXT_LOCATION_ID

  const selectLocation = async locationData => {
    if (!isGeocoded) {
      onPress({ id: null, fullText: locationData.fullText })
    } else {
      const { locationObject } = await findOrCreateLocationObject(locationData)
      onPress(locationObject)
    }
  }

  return (
    <TouchableOpacity style={[styles.locationRow, { borderTopColor: colors?.border }]} onPress={() => selectLocation(item)}>
      {!isGeocoded && (
        <>
          <Icon name='Back' color={colors?.border || rhino80} style={styles.locationIcon} />
          <Text style={[styles.locationText, styles.notGeocodedRow, { color: colors?.text }]}>Use "{item.fullText}" (without mapping)</Text>
        </>
      )}
      {isGeocoded && (
        <>
          <Icon name='Location' color={caribbeanGreen} style={styles.locationIcon} size={18} />
          <Text style={[styles.locationText, { color: colors?.text }]}>{item.fullText}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = {
  locationRow: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: rhino80
  },
  notGeocodedRow: {
    color: rhino20
  },
  locationIcon: {
    marginRight: 10
  },
  locationText: {
    color: alabaster,
    fontWeight: 'normal',
    fontFamily: 'Circular-Bold',
    flex: 1
  }
}
