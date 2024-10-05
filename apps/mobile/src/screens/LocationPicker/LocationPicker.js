import { isObject } from 'lodash/fp'
import { locationSearch } from 'screens/LocationPicker/LocationPicker.store'
import LocationPickerItemRow from 'screens/LocationPicker/LocationPickerItemRow'

export default function LocationPicker ({
  screenTitle: providedScreenTitle,
  navigation,
  currentLocation,
  initialSearchTerm = '',
  onPick,
  t
}) {
  navigation.navigate('ItemChooser', {
    screenTitle: t(providedScreenTitle || 'Choose a Location'),
    searchPlaceholder: t('Search for your location'),
    initialSearchTerm,
    ItemRowComponent: LocationPickerItemRow,
    pickItem: onPick,
    searchTermFilter: searchTerm => {
      return isObject(searchTerm)
        ? searchTerm.fullText
        : searchTerm
    },
    fetchSearchSuggestions: (scope, searchTerm) => {
      const proximity = currentLocation?.coords &&
        `${currentLocation.coords.longitude},${currentLocation.coords.latitude}`

      return locationSearch(scope, searchTerm, proximity)
    }
  })
}
