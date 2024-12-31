import { cn } from 'util'
import DeckGL from '@deck.gl/react'
import {
  EditableGeoJsonLayer,
  ViewMode,
  DrawPolygonMode
} from '@deck.gl-community/editable-layers'
import { isEqual } from 'lodash/fp'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import MapGL from 'react-map-gl'
import centroid from '@turf/centroid'
import Icon from 'components/Icon'
import { mapbox } from 'config/index'

import 'mapbox-gl/dist/mapbox-gl.css'

import classes from './EditableMap.module.scss'

export default function EditableMap (props) {
  const { locationObject, polygon, savePolygon, toggleModal } = props

  const fallbackCoords = {
    latitude: 35.442845,
    longitude: 7.916598,
    zoom: 12
  }
  const emptyFeatures = {
    type: 'FeatureCollection',
    features: []
  }
  const parsePolygon = (polygonToParse) => {
    try {
      return JSON.parse(polygonToParse)
    } catch (e) {
      return emptyFeatures
    }
  }
  const getFormattedPolygon = (polygonToFormat) => {
    const parsedPolygon = polygonToFormat && typeof polygonToFormat === 'string' ? parsePolygon(polygonToFormat) : polygonToFormat || null
    if (parsedPolygon?.type === 'FeatureCollection') {
      return parsedPolygon
    } else if (parsedPolygon?.type === 'Feature') {
      return {
        type: 'FeatureCollection',
        features: [parsedPolygon]
      }
    } else if (parsedPolygon?.type === 'Polygon') {
      return {
        type: 'FeatureCollection',
        features: [{
          geometry: parsedPolygon,
          properties: {},
          type: 'Feature'
        }]
      }
    } else {
      return emptyFeatures
    }
  }

  const [viewport, setViewport] = useState(fallbackCoords)
  const [mode, setMode] = useState(() => ViewMode)
  const [selectedFeatureIndexes, setSelectedFeatureIndexes] = useState([])
  const [features, setFeatures] = React.useState(getFormattedPolygon(polygon))

  const centerAt = locationObject?.center
  const editorRef = useRef(null)

  useEffect(() => {
    setFeatures(getFormattedPolygon(polygon))
  }, [polygon])

  useEffect(() => {
    const polygonCenter = !isEqual(features, emptyFeatures) ? centroid(features.features[0]).geometry.coordinates : null
    const viewportLocation = polygonCenter?.length > 0
      ? {
          longitude: polygonCenter[0],
          latitude: polygonCenter[1],
          zoom: 12
        }
      : centerAt
        ? {
            longitude: parseFloat(centerAt.lng),
            latitude: parseFloat(centerAt.lat),
            zoom: 12
          }
        : fallbackCoords
    setViewport(viewportLocation)
  }, [features])

  const toggleMode = () => {
    setMode(mode === ViewMode ? () => DrawPolygonMode : () => ViewMode)
  }

  const onClick = useCallback((e) => {
    if (mode === ViewMode) {
      if (e.index !== undefined) {
        setSelectedFeatureIndexes([e.index])
      } else {
        setSelectedFeatureIndexes([])
      }
    }
  }, [mode])

  const onDelete = useCallback(() => {
    if (selectedFeatureIndexes.length > 0) {
      savePolygon(null)
      setFeatures(emptyFeatures)
    } else {
      setMode(() => ViewMode)
    }
  }, [selectedFeatureIndexes])

  const onUpdate = useCallback((payload) => {
    const { editType, updatedData } = payload
    if (editType === 'addFeature') {
      const polygonToSave = getFormattedPolygon(updatedData.features[updatedData.features.length - 1])
      setMode(() => ViewMode)
      savePolygon(polygonToSave)
      setFeatures(polygonToSave)
    }
  }, [])

  const zoomIn = () => {
    setViewport({ ...viewport, zoom: viewport.zoom + 1 })
  }
  const zoomOut = () => {
    setViewport({ ...viewport, zoom: viewport.zoom - 1 })
  }
  const expand = () => {
    toggleModal()
  }

  const drawTools = (
    <div className='mapboxgl-ctrl-top-left'>
      <div className={cn('mapboxgl-ctrl-group', 'mapboxgl-ctrl', classes.mapControl)}>
        <button
          className={cn(classes.mapboxGlGrawPolygon, { active: mode === DrawPolygonMode })}
          title='New Polygon'
          onClick={toggleMode}
        >
          <Icon name='Drawing' />
        </button>
      </div>
      <div className={cn('mapboxgl-ctrl-group', 'mapboxgl-ctrl', classes.mapControl)}>
        <button
          className={classes.mapboxGlDrawCircleEx}
          title='Delete selected polygon, click polygon to select'
          onClick={onDelete}
          disabled={selectedFeatureIndexes.length === 0}
        >
          <Icon name='CircleEx' />
        </button>
      </div>
      {/* We may implement this later
       <div className={cn('mapboxgl-ctrl-group mapboxgl-ctrl', classes.mapControl)}>
        <button
          className={classes.mapboxGlDrawReset}
          title='Reset Drawing'
          onClick={() => setMode(new EditingMode())}
        ><Icon name='CircleArrow' /></button>
      </div> */}
    </div>
  )

  const zoomTools = (
    <div className='mapboxgl-ctrl-top-right'>
      <div className={cn('mapboxgl-ctrl-group', 'mapboxgl-ctrl', classes.mapControl)}>
        <button
          className={classes.mapboxGlDrawPlus}
          title='Zoom In'
          onClick={zoomIn}
        >
          <Icon name='Plus' />
        </button>
        <button
          className={classes.mapboxGlDrawMinus}
          title='Zoom Out'
          onClick={zoomOut}
        >
          <Icon name='Minus' />
        </button>
      </div>
    </div>
  )

  const expandTools = (
    <div className='mapboxgl-ctrl-bottom-left'>
      <div className={cn('mapboxgl-ctrl-group', 'mapboxgl-ctrl', classes.mapControl)}>
        <button
          className={classes.mapboxGlExpand}
          title='Expand'
          onClick={expand}
        >
          <Icon name='Expand' />
        </button>
      </div>
    </div>
  )

  const layer = new EditableGeoJsonLayer({
    data: features,
    mode,
    selectedFeatureIndexes,
    onEdit: onUpdate
  })

  return (
    <>
      <DeckGL
        initialViewState={viewport}
        controller={{
          doubleClickZoom: false
        }}
        layers={[layer]}
        getCursor={layer.getCursor.bind(layer)} // eslint-disable-line
        style={{ position: 'relative' }}
        onClick={onClick}
        ref={editorRef}
      >
        <MapGL
          {...viewport}
          mapStyle='mapbox://styles/mapbox/satellite-streets-v12'
          mapboxAccessToken={mapbox.token}
          attributionControl={false}
        />
        {drawTools}{zoomTools}{expandTools}
      </DeckGL>
    </>

  )
}
