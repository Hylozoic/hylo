import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import { LocationHelpers } from '@hylo/shared'
import Geocoder from 'components/GeocoderAutocomplete'
import { mapbox } from 'config/index'
import { cn } from 'util/index'

import styles from './LocationInput.module.scss'

class LocationInput extends Component {
  static propTypes = {
    className: PropTypes.string,
    inputPosition: PropTypes.string,
    locationObject: PropTypes.object,
    location: PropTypes.string,
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
    pollingFetchLocation: PropTypes.func,
    saveLocationToDB: PropTypes.bool
  }

  static defaultProps = {
    mapboxToken: mapbox.token,
    className: 'bg-black/20 rounded-lg text-foreground placeholder-foreground/40 w-full p-4',
    inputPosition: 'top',
    locationObject: null,
    location: '',
    onChange: null,
    saveLocationToDB: true
  }

  constructor (props) {
    super(props)
    this.state = {
      browserLocation: null
    }
  }

  componentDidMount () {
    if (!this.props.locationObject || !this.props.locationObject.center) {
      navigator.geolocation.getCurrentPosition((position) => this.setState({ browserLocation: { lat: position.coords.latitude, lng: position.coords.longitude } }))
    }
  }

  handleInputChange = inputData => {
    this.props.onChange({ fullText: inputData, id: null })
  }

  handleSelectLocation = data => {
    if (this.props.saveLocationToDB) {
      this.props.pollingFetchLocation(LocationHelpers.convertMapboxToLocation(data), (location) => this.props.onChange(location))
    } else {
      this.props.onChange(LocationHelpers.convertMapboxToLocation(data))
    }
  }

  handleSuggest = e => { }

  render () {
    const { id, inputPosition, locationObject, location, placeholder = this.props.t('Search for a location...'), mapboxToken, className } = this.props
    const centerAt = (locationObject && locationObject.center) || this.state.browserLocation

    return (
      <div className='w-full text-foreground'>
        <Geocoder
          id={id}
          accessToken={mapboxToken}
          defaultInputValue={location || ''}
          onInputChange={this.handleInputChange}
          onSelect={this.handleSelectLocation}
          onSuggest={this.handleSuggest}
          source='mapbox.places'
          endpoint='https://api.tiles.mapbox.com'
          className={className}
          inputPlaceholder={placeholder}
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
  }
}

export default withTranslation()(LocationInput)
