import PropTypes from 'prop-types'
import React, { forwardRef, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { LocationHelpers } from '@hylo/shared'
import Geocoder from 'components/GeocoderAutocomplete'
import { mapbox } from 'config/index'
import { cn } from 'util/index'
import { pollingFetchLocation as pollingFetchLocationThunk } from './LocationInput.store'

import styles from './LocationInput.module.scss'

const LocationInput = forwardRef(function LocationInput (props, ref) {
  const {
    className,
    inputPosition,
    locationObject,
    location,
    onChange,
    placeholder,
    saveLocationToDB,
    mapboxToken = mapbox.token
  } = props
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [browserLocation, setBrowserLocation] = useState(null)

  const pollingFetchLocation = useCallback((locationData, callback) => {
    pollingFetchLocationThunk(dispatch, locationData, callback)
  }, [dispatch])

  useEffect(() => {
    if (!locationObject || !locationObject.center) {
      navigator.geolocation.getCurrentPosition((position) =>
        setBrowserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }))
    }
  }, [locationObject])

  const handleInputChange = useCallback(inputData => {
    onChange({ fullText: inputData, id: null })
  }, [onChange])

  const handleSelectLocation = useCallback(data => {
    if (saveLocationToDB) {
      pollingFetchLocation(LocationHelpers.convertMapboxToLocation(data), (loc) => onChange(loc))
    } else {
      onChange(LocationHelpers.convertMapboxToLocation(data))
    }
  }, [onChange, saveLocationToDB, pollingFetchLocation])

  const handleSuggest = useCallback(e => { }, [])

  const centerAt = (locationObject && locationObject.center) || browserLocation
  const resolvedPlaceholder = placeholder ?? t('Search for a location...')

  return (
    <div className='w-full text-foreground'>
      <Geocoder
        ref={ref}
        id={props.id}
        accessToken={mapboxToken}
        defaultInputValue={location || ''}
        onInputChange={handleInputChange}
        onSelect={handleSelectLocation}
        onSuggest={handleSuggest}
        source='mapbox.places'
        endpoint='https://api.tiles.mapbox.com'
        className={className}
        inputPlaceholder={resolvedPlaceholder}
        resultClass={styles.result}
        resultsClass={cn(styles.suggestions, { '!top-auto bottom-[100%]': inputPosition === 'bottom' })}
        resultFocusClass={styles.selectedResult}
        showLoader
        inputPosition={inputPosition}
        proximity={centerAt ? centerAt.lng + ',' + centerAt.lat : ''}
        bbox=''
        types=''
      />
    </div>
  )
})

LocationInput.propTypes = {
  className: PropTypes.string,
  inputPosition: PropTypes.string,
  locationObject: PropTypes.object,
  location: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  saveLocationToDB: PropTypes.bool
}

LocationInput.defaultProps = {
  className: 'bg-darkening/20 rounded-lg text-foreground placeholder-foreground/40 w-full p-4',
  inputPosition: 'top',
  locationObject: null,
  location: '',
  onChange: null,
  saveLocationToDB: true
}

export default LocationInput
