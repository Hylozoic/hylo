import { Hexagon } from 'lucide-react'
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ErrorBoundary from 'components/ErrorBoundary'
import LocationInput from 'components/LocationInput/LocationInput'

// The drawing map pulls in deck.gl + mapbox; only load it once someone opens it
const EditableMap = lazy(() => import('components/Map/EditableMap/EditableMap'))

/**
 * Location search plus an optional boundary polygon drawn on a map.
 * `geoShape` is a GeoJSON geometry serialized as a string (what the API's geoShape field takes), or null.
 */
export default function LocationWithBoundary ({
  locationObject,
  onLocationChange,
  geoShape,
  onGeoShapeChange,
  placeholder,
  inputClassName,
  saveLocationToDB
}) {
  const { t } = useTranslation()
  const [showMap, setShowMap] = useState(Boolean(geoShape))
  const [browserCenter, setBrowserCenter] = useState(null)
  const editorRef = useRef(null)

  useEffect(() => {
    if (!showMap) return
    editorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    // Mapbox measures its container on mount, before the revealed section has settled to full width
    const resizeTimer = setTimeout(() => window.dispatchEvent(new Event('resize')), 300)
    return () => clearTimeout(resizeTimer)
  }, [showMap])

  // With no location chosen yet, start the map near the person drawing instead of the map's generic fallback
  useEffect(() => {
    if (!showMap || locationObject?.center || browserCenter || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(position =>
      setBrowserCenter({ lat: position.coords.latitude, lng: position.coords.longitude }))
  }, [showMap, locationObject?.center, browserCenter])

  const mapLocation = locationObject?.center ? locationObject : (browserCenter ? { center: browserCenter } : null)

  const savePolygon = useCallback((featureCollection) => {
    const features = featureCollection?.features || []
    onGeoShapeChange(features.length > 0 ? JSON.stringify(features[features.length - 1].geometry) : null)
  }, [onGeoShapeChange])

  const removeBoundary = useCallback(() => {
    onGeoShapeChange(null)
    setShowMap(false)
  }, [onGeoShapeChange])

  return (
    <div className='flex flex-col gap-3'>
      <LocationInput
        locationObject={locationObject}
        location={locationObject?.fullText || ''}
        onChange={onLocationChange}
        saveLocationToDB={saveLocationToDB}
        placeholder={placeholder}
        className={inputClassName}
      />
      {showMap
        ? (
          <div ref={editorRef} className='flex flex-col gap-2' data-testid='boundary-editor'>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-xs text-foreground/60'>
                {geoShape
                  ? t('Boundary drawn. Use the pen to redraw it.')
                  : t('Click the map to add points. Click the first point or press Enter to finish.')}
              </span>
              <button
                type='button'
                onClick={removeBoundary}
                className='shrink-0 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors'
              >
                {geoShape ? t('Remove boundary') : t('Cancel')}
              </button>
            </div>
            <div className='relative w-full h-[260px] rounded-lg overflow-hidden bg-darkening/20'>
              {/* Without WebGL the map throws; keep that from taking down the whole form */}
              <ErrorBoundary message={t('The map could not be loaded in this browser.')}>
                <Suspense fallback={null}>
                  <EditableMap
                    locationObject={mapLocation}
                    polygon={geoShape}
                    savePolygon={savePolygon}
                    startInDrawMode={!geoShape}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>
          )
        : (
          <button
            type='button'
            onClick={() => setShowMap(true)}
            className='self-start inline-flex items-center gap-1.5 text-sm font-semibold text-selected hover:underline'
            data-testid='draw-boundary'
          >
            <Hexagon className='w-4 h-4' />
            {t('Draw a boundary')}
          </button>
          )}
    </div>
  )
}
