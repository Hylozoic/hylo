import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import Icon from 'components/Icon'
import useFindOrCreateLocationObject from 'components/LocationSelectorModal/useFindOrCreateLocationObject'
import { rhino80, rhino20, caribbeanGreen } from 'style/colors'

export default function LocationSelectorModalItemRow ({ item, onPress }) {
  const [, findOrCreateLocationObject] = useFindOrCreateLocationObject()
  const isGeocoded = item.id !== 'NEW'

  const selectLocation = async locationData => {
    if (!isGeocoded) {
      onPress(locationData)
    } else {
      const { locationObject } = await findOrCreateLocationObject(locationData)
      onPress(locationObject)
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
