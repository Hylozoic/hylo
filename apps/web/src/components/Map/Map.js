import React, { forwardRef, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import MapGL, { NavigationControl, useControl } from 'react-map-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { mapbox } from 'config/index'
import NativeTerritoriesLayer from './NativeTerritoriesLayers'

function DeckGLOverlay (props) {
  const overlay = useControl(() => new MapboxOverlay(props))
  overlay.setProps(props)
  return null
}

const Map = forwardRef(({
  afterViewportUpdate = () => {},
  baseLayerStyle = 'light-v11',
  darkLayerStyle = 'dark-v11',
  isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
  children = {},
  hyloLayers,
  isAddingItemToMap,
  layers = [],
  onMouseDown,
  onMouseUp,
  onLoad,
  otherLayers,
  setViewport,
  viewport = {
    latitude: 35.442845,
    longitude: 7.916598,
    zoom: 0,
    bearing: 0,
    pitch: 0
  }
}, forwardedRef) => {
  const [isOverHyloFeature, setIsOverHyloFeature] = useState(false)

  const ref = useRef(null)
  const mapRef = forwardedRef || ref

  const [hoveredLayerFeatures, setHoveredLayerFeatures] = useState([])
  const [cursorLocation, setCursorLocation] = useState({ x: 0, y: 0 })

  console.log({ onLoad, setViewport }, 'LIVING THE DREAM')

  const onMouseEnter = event => {
    const { features } = event
    setHoveredLayerFeatures(features)
  }

  const onMouseMove = event => {
    const {
      originalEvent: { offsetX, offsetY }
    } = event

    if (event.target.id === 'deckgl-overlay') {
      setCursorLocation({ x: offsetX, y: offsetY })
    }
  }

  return (
    <MapGL
      {...viewport}
      attributionControl={false}
      interactiveLayerIds={otherLayers}
      mapboxAccessToken={mapbox.token}
      mapOptions={{ logoPosition: 'bottom-right' }}
      mapStyle={`mapbox://styles/mapbox/${isDarkMode ? darkLayerStyle : baseLayerStyle}`}
      onLoad={(map) => { map.target.resize(); onLoad && onLoad(map) }}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseLeave={() => { setHoveredLayerFeatures([]) }}
      onMouseOut={() => { setHoveredLayerFeatures([]) }}
      onMouseUp={onMouseUp}
      onTouchEnd={onMouseUp}
      onMove={evt => { setViewport(evt.viewState) }}
      onMoveEnd={afterViewportUpdate}
      ref={r => { mapRef.current = r && r.getMap(); return r }}
      reuseMaps
    >
      <NavigationControl style={{
        position: 'absolute',
        top: 55,
        right: 13,
        filter: isDarkMode ? 'invert(1)' : 'none'
      }}
      />

      <NativeTerritoriesLayer
        cursorLocation={cursorLocation}
        hoveredLayerFeatures={hoveredLayerFeatures}
        visibility={otherLayers && otherLayers.includes('native_territories')}
      />

      <DeckGLOverlay
        initialViewState={viewport}
        layers={hyloLayers}
        interleaved
        onHover={({ object }) => {
          setIsOverHyloFeature(Boolean(object))
          // if hovering over DeckGL object then turn off hover state of MapGL
          if (object) {
            setHoveredLayerFeatures([])
          }
        }}
        getCursor={() => isOverHyloFeature ? 'pointer' : isAddingItemToMap ? 'url(/assets/create-post-pin.png) 12 31, pointer' : 'grab'}
      >
        {children}
      </DeckGLOverlay>

    </MapGL>
  )
})

Map.propTypes = {
  center: PropTypes.object,
  children: PropTypes.any,
  layers: PropTypes.array,
  onViewportUpdate: PropTypes.func,
  zoom: PropTypes.number
}

export default Map
