import { cn } from 'util/index'
import React, { useState, useEffect, useMemo, useRef, useCallback, useContext } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { createSelector } from 'reselect'
import { debounce, get, groupBy, isEqual, isEmpty } from 'lodash'
import { pick, pickBy } from 'lodash/fp'
import { Heart } from 'lucide-react'
import bbox from '@turf/bbox'
import bboxPolygon from '@turf/bbox-polygon'
import booleanWithin from '@turf/boolean-within'
import center from '@turf/center'
import combine from '@turf/combine'
import { featureCollection, point } from '@turf/helpers'
import isWebView from 'util/webView'
import Dropdown from 'components/Dropdown'
import CreateMenu from 'components/CreateMenu'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import LocationInput from 'components/LocationInput'
import Map from 'components/Map/Map'
import { createIconLayerFromPostsAndMembers } from 'components/Map/layers/clusterLayer'
import { createIconLayerFromGroups } from 'components/Map/layers/iconLayer'
import { createPolygonLayerFromGroups } from 'components/Map/layers/polygonLayer'
import SwitchStyled from 'components/SwitchStyled'
import Tooltip from 'components/Tooltip'
import LayoutFlagsContext from 'contexts/LayoutFlagsContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { locationObjectToViewport } from 'util/geo'
import { isMobileDevice } from 'util/mobile'
import { generateViewParams } from 'util/savedSearch'
import { updateUserSettings } from 'routes/UserSettings/UserSettings.store'
import changeQuerystringParam, { changeQuerystringParams } from 'store/actions/changeQuerystringParam'
import { FETCH_FOR_GROUP } from 'store/constants'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import { personUrl, postUrl, groupDetailUrl } from '@hylo/navigation'

import {
  fetchSavedSearches, deleteSearch, saveSearch, viewSavedSearch
} from '../UserSettings/UserSettings.store'

import {
  FEATURE_TYPES,
  FETCH_POSTS_MAP,
  FETCH_POSTS_MAP_DRAWER,
  fetchMembers,
  fetchPostsForDrawer,
  fetchPostsForMap,
  fetchGroupsForMap,
  formatBoundingBox,
  getCurrentTopics,
  getGroupsFilteredByTopics,
  getMembersFilteredByTopics,
  getSortedFilteredPostsForDrawer,
  getFilteredPostsForMap,
  storeClientFilterParams,
  updateState
} from './MapExplorer.store'

import MapDrawer from './MapDrawer'
import SavedSearches from './SavedSearches'

import classes from './MapExplorer.module.scss'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAP_BASE_LAYERS = [
  { id: 'light-v11', label: 'Basic (Light)' },
  { id: 'streets-v12', label: 'Streets' },
  { id: 'satellite-v9', label: 'Satellite' },
  { id: 'satellite-streets-v12', label: 'Satellite + Streets' }
]

function presentMember (person, groupId) {
  return {
    ...pick(['id', 'name', 'avatarUrl', 'groupRoles', 'locationObject', 'tagline', 'skills'], person.ref),
    type: 'member',
    skills: person.skills.toModelArray(),
    group: person.memberships.first()
      ? person.memberships.first().group.name
      : null
  }
}

function presentGroup (group) {
  return group.ref
}

function MapExplorer (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useRouteParams()
  const layoutFlags = useContext(LayoutFlagsContext)

  const mapRef = useRef(null)

  const context = useMemo(() => routeParams.context || props.context, [routeParams.context, props.context])
  const groupSlug = useMemo(() => routeParams.groupSlug, [routeParams.groupSlug])
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupId = group?.id
  const queryGroupSlugs = getQuerystringParam('group', location)
  const groupSlugs = useMemo(() => group ? (queryGroupSlugs || []).concat(groupSlug) : queryGroupSlugs, [groupSlug, queryGroupSlugs])

  const currentUser = useSelector(state => getMe(state, { location }))
  const defaultChildPostInclusion = currentUser?.settings?.streamChildPosts || 'yes'
  const childPostInclusion = useMemo(() => getQuerystringParam('c', location) || defaultChildPostInclusion, [location])

  const [hideDrawer, setHideDrawer] = useState(getQuerystringParam('hideDrawer', location) === 'true')
  const queryParams = useMemo(() => getQuerystringParam(['search', 'sortBy', 'hide', 'topics', 'group'], location), [location])

  const reduxState = useSelector(state => state.MapExplorer)

  const totalBoundingBoxLoaded = useMemo(() => reduxState.totalBoundingBoxLoaded, [reduxState.totalBoundingBoxLoaded])

  const fetchPostsParams = useMemo(() => ({
    childPostInclusion,
    boundingBox: totalBoundingBoxLoaded,
    context,
    slug: groupSlug,
    groupSlugs
  }), [childPostInclusion, context, groupSlug, groupSlugs, totalBoundingBoxLoaded])

  const topicsFromPosts = useSelector(state => getCurrentTopics(state, fetchPostsParams))

  const filters = useMemo(() => {
    const filters = {
      ...reduxState.clientFilterParams,
      ...pick(['search', 'sortBy'], queryParams)
    }
    if (queryParams.hide) {
      // TODO: track groups and members separately from post types so we dont reload posts when we toggle groups or members
      filters.featureTypes = Object.keys(filters.featureTypes).reduce((types, type) => { types[type] = !queryParams.hide.includes(type); return types }, {})
    }
    if (queryParams.topics) {
      filters.topics = topicsFromPosts.filter(t => queryParams.topics.includes(t.id))
    }
    return filters
  }, [reduxState.clientFilterParams, queryParams.search, queryParams.sortBy, queryParams.hide, queryParams.topics])

  const fetchPostsForDrawerParams = useMemo(() => ({
    childPostInclusion,
    context,
    slug: groupSlug,
    groupSlugs,
    ...filters,
    topics: filters.topics.map(t => t.id),
    types: !isEmpty(filters.featureTypes) ? Object.keys(filters.featureTypes).filter(ft => filters.featureTypes[ft]) : null,
    currentBoundingBox: filters.currentBoundingBox || totalBoundingBoxLoaded
  }), [childPostInclusion, context, groupSlug, groupSlugs, filters, totalBoundingBoxLoaded])

  const fetchGroupParams = useMemo(() => ({
    boundingBox: totalBoundingBoxLoaded,
    context,
    parentSlugs: groupSlugs
  }), [totalBoundingBoxLoaded, context, groupSlugs])

  const fetchMemberParams = useMemo(() => ({
    boundingBox: totalBoundingBoxLoaded,
    context,
    slug: groupSlug,
    sortBy: 'name'
  }), [totalBoundingBoxLoaded, context, groupSlug])

  const members = useSelector(
    createSelector(
      (state) => getMembersFilteredByTopics(state, fetchMemberParams),
      (members) => members.map(m => presentMember(m, groupId))
    )
  )
  const postsForDrawer = useSelector(
    createSelector(
      (state) => getSortedFilteredPostsForDrawer(state, fetchPostsForDrawerParams),
      (posts) => posts.map(p => presentPost(p, groupId))
    )
  )
  const postsForMap = useSelector(
    createSelector(
      (state) => getFilteredPostsForMap(state, fetchPostsParams),
      (posts) => posts.map(p => presentPost(p, groupId))
    )
  )
  const groups = useSelector(
    createSelector(
      (state) => getGroupsFilteredByTopics(state, fetchGroupParams),
      (groups) => groups.map(g => presentGroup(g))
    )
  )

  // Use browser location if center location is not otherwise provided
  const [browserLocation, setBrowserLocation] = useState(null)
  useEffect(() => {
    if (!centerParam &&
        !reduxState.centerLocation &&
        !group?.locationObject?.center &&
        !currentUser?.locationObject?.center) {
      navigator.geolocation.getCurrentPosition((position) => {
        setBrowserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setViewport({
          ...viewport,
          zoom: 10,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      })
    }
  }, [])

  const centerParam = getQuerystringParam('center', location)
  const centerLocation = useMemo(() => {
    if (centerParam) {
      const decodedCenter = decodeURIComponent(centerParam).split(',')
      return { lat: parseFloat(decodedCenter[0]), lng: parseFloat(decodedCenter[1]) }
    }

    // TODO: figure out how to priotize group location over current user location, when current user loads first
    return reduxState.centerLocation ||
      group?.locationObject?.center ||
      currentUser?.locationObject?.center ||
      browserLocation ||
      { lat: 35.442845, lng: 7.916598 }
  }, [centerParam, reduxState.centerLocation, group?.locationObject?.center, currentUser?.locationObject?.center, browserLocation])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Map'),
      icon: 'Globe',
      info: ''
    })
  }, [])

  const defaultZoom = useMemo(() => (centerLocation ? 10 : 2), [centerLocation])

  const zoomParam = getQuerystringParam('zoom', location)
  const zoom = useMemo(() => zoomParam ? parseFloat(zoomParam) : reduxState.zoom || defaultZoom, [zoomParam, reduxState.zoom, defaultZoom])

  const baseStyleParam = getQuerystringParam('style', location)
  const [baseLayerStyle, setBaseLayerStyle] = useState(baseStyleParam || reduxState.baseLayerStyle || currentUser?.settings?.mapBaseLayer || 'satellite-streets-v12')
  if (!MAP_BASE_LAYERS.find(o => o.id === baseLayerStyle)) {
    setBaseLayerStyle('satellite-streets-v12')
  }

  const possibleFeatureTypes = useMemo(() => context === 'public'
    ? ['discussion', 'request', 'offer', 'resource', 'project', 'proposal', 'event', 'group']
    : ['discussion', 'request', 'offer', 'resource', 'project', 'proposal', 'event', 'member', 'group'], [context])

  const groupPending = useSelector(state => state.pending[FETCH_FOR_GROUP])
  const pendingPostsMap = useSelector(state => state.pending[FETCH_POSTS_MAP])
  const pendingPostsDrawer = useSelector(state => state.pending[FETCH_POSTS_MAP_DRAWER])
  const selectedSearch = useSelector(state => state.SavedSearches.selectedSearch) // TODO: need this?

  const [clusterLayer, setClusterLayer] = useState(null)
  const [currentBoundingBox, setCurrentBoundingBox] = useState(null)
  const [groupIconLayer, setGroupIconLayer] = useState(null)
  const [polygonLayer, setPolygonLayer] = useState(null)
  const [hoveredObject, setHoveredObject] = useState(null)
  const [isAddingItemToMap, setIsAddingItemToMap] = useState(false)
  const [pointerCoords, setPointerCoords] = useState([0, 0])
  const [groupsForDrawer, setGroupsForDrawer] = useState(groups || [])
  const [membersForDrawer, setMembersForDrawer] = useState(members || [])
  const [otherLayers, setOtherLayers] = useState({})
  // const [selectedObject, setSelectedObject] = useState(null)
  const [showFeatureFilters, setShowFeatureFilters] = useState(false)
  const [showLayersSelector, setShowLayersSelector] = useState(false)
  const [totalPostsInView, setTotalPostsInView] = useState(postsForMap.length || 0)
  const [showSavedSearches, setShowSavedSearches] = useState(false)

  const [viewport, setViewport] = useState({
    width: 800,
    height: 600,
    latitude: parseFloat(centerLocation.lat),
    longitude: parseFloat(centerLocation.lng),
    zoom,
    bearing: 0,
    pitch: 0
  })

  const [createCreatePopupVisible, setCreatePopupVisible] = useState(false)
  const [createPopupPosition, setCreatePopupPosition] = useState({ top: 0, left: 0, lat: 0, lng: 0 })

  const showCreatePopup = (point, lngLat) => {
    setCreatePopupPosition({ top: point.y, left: point.x, lat: lngLat.lat, lng: lngLat.lng })
    setCreatePopupVisible(true)
  }

  const updateUrlFromStore = useCallback((params, replace) => {
    const querystringParams = getQuerystringParam(['sortBy', 'search', 'hide', 'topics'], location)

    let newQueryParams = { ...pick(['search', 'sortBy'], params) }
    if (params.featureTypes) {
      newQueryParams.hide = Object.keys(params.featureTypes).filter(type => !params.featureTypes[type])
    }
    if (params.topics) {
      newQueryParams.topics = params.topics.map(t => t.id)
    }
    newQueryParams = pickBy((val, key) => {
      return !isEqual(val, querystringParams[key])
    }, newQueryParams)

    if (!isEmpty(newQueryParams)) {
      dispatch(changeQuerystringParams(location, newQueryParams, replace))
    }
  }, [dispatch, location])

  const changeChildPostInclusion = useCallback(childPostsBool => {
    dispatch(updateUserSettings({ settings: { streamChildPosts: childPostsBool } }))
    return dispatch(changeQuerystringParam(location, 'c', childPostsBool, 'yes'))
  }, [dispatch, location])

  const doFetchPostsForDrawer = useCallback((offset = 0, replace = true) => dispatch(fetchPostsForDrawer({ ...fetchPostsForDrawerParams, offset, replace })), [fetchPostsForDrawerParams])
  const doFetchSavedSearches = useCallback(() => dispatch(fetchSavedSearches(currentUser.id)), [currentUser?.id])
  const handleDeleteSearch = useCallback((searchId) => dispatch(deleteSearch(searchId)), [])

  const handleSaveSearch = useCallback((name) => {
    const { featureTypes, search: searchText, topics } = filters

    const postTypes = Object.keys(featureTypes).reduce((selected, type) => {
      if (featureTypes[type]) selected.push(type)
      return selected
    }, [])

    const topicIds = topics.map(t => t.id)

    const boundingBox = [
      { lat: currentBoundingBox[1], lng: currentBoundingBox[0] },
      { lat: currentBoundingBox[3], lng: currentBoundingBox[2] }
    ]

    const attributes = { boundingBox, groupSlug, context, name, postTypes, searchText, topicIds, userId: currentUser.id }

    dispatch(saveSearch(attributes))
  }, [context, currentBoundingBox, currentUser?.id, dispatch, filters, groupSlug])

  const showDetails = useCallback((postId) => navigate(postUrl(postId, { ...routeParams, view: 'map' }, getQuerystringParam(['hideDrawer', 't', 'group'], location))), [navigate, routeParams, location])

  const showGroupDetails = useCallback((groupSlug) => navigate(groupDetailUrl(groupSlug, { ...routeParams, view: 'map' }, getQuerystringParam(['hideDrawer', 't', 'group'], location))), [navigate, routeParams, location])

  const gotoMember = useCallback((memberId) => navigate(personUrl(memberId, groupSlug)), [dispatch, groupSlug, navigate])

  const toggleDrawer = useCallback(() => {
    dispatch(changeQuerystringParam(location, 'hideDrawer', !hideDrawer))
    setHideDrawer(!hideDrawer)
    setTimeout(() => {
      mapRef.current.resize()
    }, 100)
  }, [dispatch, hideDrawer, location])

  const doStoreClientFilterParams = useCallback(params => {
    return dispatch(storeClientFilterParams(params)).then(() => {
      updateUrlFromStore(params, true)
    })
  }, [dispatch, updateUrlFromStore])

  const updateBaseLayerStyle = useCallback((style) => {
    if (currentUser) {
      dispatch(updateUserSettings({ settings: { mapBaseLayer: style } }))
    }
    dispatch(changeQuerystringParams(location, { style }, true))
    setBaseLayerStyle(style)
  }, [dispatch, currentUser, location])

  const updateBoundingBox = useCallback(bbox => dispatch(updateState({ totalBoundingBoxLoaded: bbox })), [dispatch])

  const updateQueryParams = useCallback((params, replace) => updateUrlFromStore(params, replace), [updateUrlFromStore])

  const updateView = useCallback(({ centerLocation, zoom }) => {
    const newUrlParams = {
      zoom
    }
    newUrlParams.center = encodeURIComponent(centerLocation.lat + ',' + centerLocation.lng)
    dispatch(updateState({ centerLocation, zoom })).then(() => dispatch(changeQuerystringParams(location, newUrlParams, true)))
  }, [dispatch, location])

  const handleViewSavedSearch = useCallback((search) => {
    const { mapPath } = generateViewParams(search)
    dispatch(viewSavedSearch(search))
    dispatch(navigate(mapPath))
  }, [dispatch, navigate])

  const onMapLoad = (map) => {
    let bounds = map.target.getBounds()
    bounds = [bounds._sw.lng, bounds._sw.lat, bounds._ne.lng, bounds._ne.lat]
    updateBoundingBoxQuery(bounds)
  }

  const onMapHover = useCallback((info) => {
    setHoveredObject(info.objects || info.object)
    setPointerCoords([info.x, info.y])
  }, [setHoveredObject, setPointerCoords])

  const onMapClick = useCallback((info, e) => {
    if (info.objects) {
      if (viewport.zoom >= 20 && hideDrawer) {
        setHideDrawer(false)
        setTimeout(() => {
          mapRef.current.resize()
        }, 100)
      } else {
        const features = featureCollection(info.objects.map(o => point([o.coordinates[0], o.coordinates[1]])))
        const c = center(features)

        setViewport({
          ...viewport,
          longitude: c.geometry.coordinates[0],
          latitude: c.geometry.coordinates[1],
          zoom: Math.max(viewport.zoom, info.expansionZoom)
        })

        mapRef.current.flyTo({
          center: [c.geometry.coordinates[0], c.geometry.coordinates[1]],
          zoom: Math.max(viewport.zoom, info.expansionZoom),
          duration: 500,
          essential: true
        })
      }
    } else {
      // setSelectedObject(info.object)
      if (info.object.type === 'member') {
        gotoMember(info.object.id)
      } else if (info.object.type === 'group') {
        showGroupDetails(info.object.slug)
      } else {
        showDetails(info.object.id)
      }
    }
  }, [gotoMember, hideDrawer, showDetails, showGroupDetails, viewport])

  const creatingPostRef = useRef(false)

  const onMapMouseDown = useCallback((e) => {
    // close all open menus or popups whenever the map is clicked
    setShowFeatureFilters(false)
    setShowLayersSelector(false)
    setShowSavedSearches(false)
    setCreatePopupVisible(false)
    if (currentUser) {
      creatingPostRef.current = e.point
      setTimeout(() => {
        // Make sure the point is still the same as the one we clicked on
        if (creatingPostRef.current === e.point) {
          showCreatePopup(e.point, e.lngLat) // Show the popup at the clicked location
        }
      }, isAddingItemToMap ? 0 : 1000)
    }
  }, [isAddingItemToMap, showCreatePopup, currentUser])

  const onMapMouseUp = useCallback(() => {
    if (creatingPostRef.current) {
      creatingPostRef.current = false
      setIsAddingItemToMap(false)
    }
  }, [])

  const onDragStart = useCallback((e) => {
    // Stop the create popup from appearing when dragging
    creatingPostRef.current = false
  }, [])

  const updatedMapFeatures = useCallback((boundingBox) => {
    const bbox = bboxPolygon(boundingBox)
    const viewMembers = members.filter(member => {
      const locationObject = member.locationObject
      if (locationObject && locationObject.center) {
        const centerPoint = point([locationObject.center.lng, locationObject.center.lat])
        return booleanWithin(centerPoint, bbox)
      }
      return false
    })
    const viewPosts = postsForMap.filter(post => {
      const locationObject = post.locationObject
      if (locationObject && locationObject.center) {
        const centerPoint = point([locationObject.center.lng, locationObject.center.lat])
        return booleanWithin(centerPoint, bbox)
      }
      return false
    })
    const viewGroups = groups.filter(group => {
      const locationObject = group.locationObject
      if (group.geoShape) {
        const coords = group.geoShape.coordinates[0]
        const outOfBounds = []
        coords.forEach((coord, i) => {
          if (!booleanWithin(point(coord), bbox)) {
            outOfBounds.push(i)
          }
        })
        return outOfBounds.length < coords.length
      }
      if (locationObject && locationObject.center) {
        const centerPoint = point([locationObject.center.lng, locationObject.center.lat])
        return booleanWithin(centerPoint, bbox)
      }
      return false
    }).concat(get(group, 'locationObject.center') || get(group, 'geoShape') ? group : [])

    setClusterLayer(createIconLayerFromPostsAndMembers({
      members: viewMembers,
      posts: viewPosts,
      onHover: onMapHover,
      onClick: onMapClick,
      boundingBox
    }))

    setGroupIconLayer(createIconLayerFromGroups({
      groups: viewGroups,
      onHover: onMapHover,
      onClick: onMapClick,
      boundingBox
    }))

    setPolygonLayer(context !== 'public' && createPolygonLayerFromGroups({
      groups: viewGroups,
      onHover: onMapHover,
      boundingBox
    }))

    setCurrentBoundingBox(boundingBox)
    setGroupsForDrawer(viewGroups)
    setMembersForDrawer(viewMembers)
    setTotalPostsInView(viewPosts.length)
  }, [members, postsForMap, groups, group, onMapHover, onMapClick, context])

  const updateViewportWithBbox = useCallback((bbox, zoom = false) => {
    if (zoom) {
      setViewport({ ...locationObjectToViewport(viewport, { bbox }), zoom })
    } else {
      setViewport(locationObjectToViewport(viewport, { bbox }))
    }
  }, [viewport])

  useEffect(() => {
    if (!groupPending && centerLocation) {
      setViewport({
        ...viewport,
        latitude: centerLocation.lat,
        longitude: centerLocation.lng,
        zoom
      })
    }
  }, [groupPending])

  /* Lifecycle methods */
  useEffect(() => {
    if (isMobileDevice()) {
      setHideDrawer(true)
    }

    if (currentUser) {
      doFetchSavedSearches()
    }

    const missingInUrl = {}
    const missingInState = {}
    Object.keys(reduxState.clientFilterParams).forEach(key => {
      if (isEmpty(queryParams[key])) {
        missingInUrl[key] = filters[key]
      } else if (!isEqual(reduxState.clientFilterParams[key], filters[key])) {
        missingInState[key] = filters[key]
      }
    })
    if (!isEmpty(missingInUrl)) {
      updateQueryParams(missingInUrl, true)
    }
    if (!isEmpty(missingInState)) {
      doStoreClientFilterParams(missingInState)
    }
  }, [])

  useEffect(() => {
    if (totalBoundingBoxLoaded) {
      dispatch(fetchPostsForMap({ ...fetchPostsParams }))
    }
  }, [fetchPostsParams])

  useEffect(() => {
    if (totalBoundingBoxLoaded) {
      doFetchPostsForDrawer()
    }
  }, [fetchPostsForDrawerParams])

  useEffect(() => {
    if (totalBoundingBoxLoaded) {
      dispatch(fetchGroupsForMap({ ...fetchGroupParams }))
    }
  }, [fetchGroupParams])

  useEffect(() => {
    if (totalBoundingBoxLoaded) {
      dispatch(fetchMembers({ ...fetchMemberParams }))
    }
  }, [fetchMemberParams])

  useEffect(() => {
    if (currentBoundingBox) {
      updatedMapFeatures(currentBoundingBox)
    }
  }, [currentBoundingBox, postsForMap.length, members.length, groups.length])

  useEffect(() => {
    if (selectedSearch) {
      const { boundingBox, featureTypes, searchText, topics } = generateViewParams(selectedSearch)
      // updateQueryParams({ boundingBox, featureTypes, search: searchText, topics })
      updateBoundingBoxQuery(boundingBox)
      doStoreClientFilterParams({ featureTypes, search: searchText, topics })
      updateViewportWithBbox(formatBoundingBox(boundingBox))
    }
  }, [selectedSearch])

  const handleLocationInputSelection = useCallback((value) => {
    if (value.mapboxId) {
      if (value.bbox) {
        // Calculate zoom based on bounding box size
        const westLng = value.bbox[0].lng
        const southLat = value.bbox[0].lat
        const eastLng = value.bbox[1].lng
        const northLat = value.bbox[1].lat
        const longitudeDelta = Math.abs(eastLng - westLng)
        const latitudeDelta = Math.abs(northLat - southLat)

        // Use the larger of the two deltas to determine zoom
        const maxDelta = Math.max(longitudeDelta, latitudeDelta)
        // log2(360 / delta) gives us a rough zoom level where 360 is the total longitude span
        const zoom = Math.min(Math.log2(360 / maxDelta), 20)

        updateViewportWithBbox(value.bbox, zoom)
      } else {
        setViewport({ ...viewport, latitude: value.center.lat, longitude: value.center.lng, zoom: 13 })
      }
    }
  }, [viewport])

  const updateBoundingBoxQuery = (newBoundingBox) => {
    let finalBbox
    if (totalBoundingBoxLoaded) {
      const curBbox = bboxPolygon(totalBoundingBoxLoaded)
      const newBbox = bboxPolygon(newBoundingBox)
      const fc = featureCollection([curBbox, newBbox])
      const combined = combine(fc)
      finalBbox = bbox(combined)
    } else {
      finalBbox = newBoundingBox
    }

    if (!isEqual(finalBbox, totalBoundingBoxLoaded)) {
      updateBoundingBox(finalBbox)
    }

    if (!isEqual(filters.currentBoundingBox, newBoundingBox)) {
      doStoreClientFilterParams({ currentBoundingBox: newBoundingBox })
    }

    updatedMapFeatures(newBoundingBox)
  }

  const afterViewportUpdate = debounce((update) => {
    let bounds = mapRef.current.getBounds()
    bounds = [bounds._sw.lng, bounds._sw.lat, bounds._ne.lng, bounds._ne.lat]
    updateBoundingBoxQuery(bounds)
    const newCenter = mapRef.current.getCenter()
    const newZoom = mapRef.current.getZoom()
    if (!isEqual(centerLocation, newCenter) || !isEqual(zoom, newZoom)) {
      updateView({ centerLocation: newCenter, zoom: newZoom })
    }
    setCreatePopupVisible(false)
    creatingPostRef.current = false
  }, 300)

  const toggleFeatureType = useCallback((type, checked) => {
    const newFeatureTypes = { ...filters.featureTypes }
    newFeatureTypes[type] = checked
    doStoreClientFilterParams({ featureTypes: newFeatureTypes })
  }, [doStoreClientFilterParams, filters.featureTypes])

  const renderTooltip = useCallback(() => {
    if (hoveredObject) {
      let message
      let type
      if (Array.isArray(hoveredObject) && hoveredObject.length > 0) {
        const types = groupBy(hoveredObject, 'type')
        message = Object.keys(types).map(type => <p key={type}>{types[type].length} {type}{types[type].length === 1 ? '' : 's'}</p>)
        type = 'cluster'
      } else {
        message = hoveredObject.message
        type = hoveredObject.type
      }

      return (
        <div className={cn(classes.postTip, classes[type])} style={{ left: pointerCoords[0] + 15, top: pointerCoords[1] }}>
          {message}
        </div>
      )
    }
    return ''
  }, [hoveredObject, pointerCoords])

  const toggleMapLayer = useCallback((layer) => {
    const newLayers = { ...otherLayers }
    if (otherLayers[layer]) {
      delete newLayers[layer]
    } else {
      switch (layer) {
        case 'native_territories':
          newLayers[layer] = true
          break
      }
    }
    setOtherLayers(newLayers)
  }, [otherLayers])

  const handleAddItemToMap = useCallback(() => {
    setIsAddingItemToMap(!isAddingItemToMap)
  }, [isAddingItemToMap])

  const toggleFeatureFilters = useCallback(() => {
    setShowFeatureFilters(!showFeatureFilters)
  }, [showFeatureFilters])

  const toggleLayersSelector = useCallback(() => {
    setShowLayersSelector(!showLayersSelector)
  }, [showLayersSelector])

  const toggleSavedSearches = useCallback(() => {
    setShowSavedSearches(!showSavedSearches)
  }, [showSavedSearches])

  const { hideNavLayout } = layoutFlags
  const withoutNav = isWebView() || hideNavLayout

  return (
    <div className={cn(classes.container, { [classes.noUser]: !currentUser, [classes.withoutNav]: withoutNav })}>
      <Helmet>
        <title>Map | {group ? `${group.name} | ` : context === 'public' ? 'Public | ' : ' All My Groups | '}Hylo</title>
      </Helmet>

      <div className='flex-1 h-full relative' data-testid='map-container'>
        <Map
          baseLayerStyle={baseLayerStyle}
          hyloLayers={[polygonLayer, groupIconLayer, clusterLayer]}
          isAddingItemToMap={isAddingItemToMap}
          otherLayers={Object.keys(otherLayers)}
          ref={mapRef}
          onMouseDown={onMapMouseDown}
          onMouseUp={onMapMouseUp}
          onDragStart={onDragStart}
          onLoad={onMapLoad}
          afterViewportUpdate={afterViewportUpdate}
          setViewport={setViewport}
          viewport={viewport}
        />
        {renderTooltip()}
        {pendingPostsMap && <Loading className={classes.loading} />}
      </div>
      <button
        data-tooltip-id='helpTip'
        data-tooltip-content={hideDrawer ? t('Open Drawer') : t('Close Drawer')}
        className={cn(
          'border-2 border-foreground/20 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center absolute top-5 gap-1 text-xs z-40 ',
          classes.toggleDrawerButton,
          {
            [classes.drawerOpen]: !hideDrawer
          })}
        onClick={toggleDrawer}
        data-testid='drawer-toggle-button'
      >
        <Icon name='Hamburger' className={classes.openDrawer} />
        <Icon name='Ex' className={cn({ hidden: hideDrawer, block: !hideDrawer })} />
      </button>
      {!hideDrawer && (
        <MapDrawer
          changeChildPostInclusion={changeChildPostInclusion}
          childPostInclusion={childPostInclusion}
          context={context}
          currentUser={currentUser}
          fetchPostsForDrawer={doFetchPostsForDrawer}
          filters={filters}
          group={group}
          groups={groupsForDrawer}
          members={membersForDrawer}
          numFetchedPosts={postsForDrawer.length}
          numTotalPosts={totalPostsInView}
          onUpdateFilters={doStoreClientFilterParams}
          pendingPostsDrawer={pendingPostsDrawer}
          posts={postsForDrawer}
          queryParams={queryParams}
          routeParams={routeParams}
          topics={topicsFromPosts}
        />
      )}
      <div className='absolute top-5 left-[74px]'>
        <LocationInput saveLocationToDB={false} onChange={handleLocationInputSelection} className='bg-input rounded-lg text-foreground placeholder-foreground/40 w-full p-2 transition-all outline-none mb-0 border-2 border-foreground/20 hover:border-foreground/50 hover:text-foreground focus:border-focus hover:scale-105' />
      </div>
      <button className={cn('border-2 border-foreground/20 hover:border-foreground/50 hover:text-foreground rounded-md py-1.5 px-2 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center absolute bottom-2 sm:bottom-10 left-2 sm:left-5 gap-1 text-xs', classes.toggleFeatureFiltersButton, { [classes.open]: showFeatureFilters, [classes.withoutNav]: withoutNav })} onClick={toggleFeatureFilters}>
        {t('Features:')} <strong>{possibleFeatureTypes.filter(t => filters.featureTypes[t]).length}/{possibleFeatureTypes.length}</strong>
      </button>

      {currentUser && (
        <>
          <button
            onClick={toggleSavedSearches}
            className={cn('border-2 border-foreground/20 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center absolute top-5 gap-1 text-xs left-5', { 'border-selected/50 text-selected': showSavedSearches })}
          >
            <Heart />
          </button>
          {showSavedSearches && (
            <SavedSearches
              deleteSearch={handleDeleteSearch}
              filters={filters}
              saveSearch={handleSaveSearch}
              searches={reduxState.searches}
              toggle={toggleSavedSearches}
              viewSavedSearch={handleViewSavedSearch}
            />
          )}
        </>
      )}

      <div className={cn('absolute bottom-[80px] left-5 hidden bg-background rounded-md p-2 drop-shadow-md flex-col', { flex: showFeatureFilters, [classes.withoutNav]: withoutNav })}>
        <h3 className='text-sm font-medium mb-2 text-foreground/80'>{t('What do you want to see on the map?')}</h3>
        {possibleFeatureTypes.map(featureType => {
          const color = FEATURE_TYPES[featureType].primaryColor
          return (
            <div
              key={featureType}
              className={classes.featureTypeSwitch}
            >
              <SwitchStyled
                backgroundColor={`rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`}
                name={featureType}
                checked={filters.featureTypes[featureType]}
                onChange={(checked, name) => toggleFeatureType(name, !checked)}
              />
              <span>{featureType.charAt(0).toUpperCase() + featureType.slice(1)}s</span>
            </div>
          )
        })}
      </div>

      <button
        data-tooltip-id='helpTip'
        data-tooltip-content={showLayersSelector ? null : t('Change Map Layers')}
        onClick={toggleLayersSelector}
        className={cn(
          'border-2 border-foreground/20 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center absolute bottom-[80px] right-5 gap-1 text-xs',
          classes.drawerAdjacentButton,
          {
            [classes.open]: showLayersSelector,
            [classes.withoutNav]: withoutNav,
            [classes.drawerOpen]: !hideDrawer
          })}
        data-testid='layers-selector-button'
      >
        <Icon name='Stack' />
      </button>
      <div className={cn(
        'absolute bottom-[120px] w-[200px] right-5 hidden bg-background rounded-md p-2 drop-shadow-md flex-col',
        classes.drawerAdjacentButton,
        {
          flex: showLayersSelector,
          [classes.withoutNav]: withoutNav,
          [classes.drawerOpen]: !hideDrawer
        })}
      >
        <div className='flex flex-col pb-2 border-b-2 border-foreground/20 mb-2'>
          <span className='text-sm font-medium text-foreground/60'>{t('Base Layer')}</span>
          <Dropdown
            id='map-explorer-base-layer-dropdown'
            className={classes.layersDropdown}
            menuAbove
            toggleChildren={(
              <span className={classes.layersDropdownLabel}>
                {MAP_BASE_LAYERS.find(o => o.id === baseLayerStyle).label}
                <Icon name='ArrowDown' />
              </span>
            )}
            items={MAP_BASE_LAYERS.map(({ id, label }) => ({
              label,
              onClick: () => updateBaseLayerStyle(id)
            }))}
          />
        </div>

        <div>
          <span className='text-sm gap-1 font-medium mb-2 text-foreground/60'>{t('Other Layers')}</span>
          <div className='flex flex-row gap-1'>
            <SwitchStyled
              backgroundColor='rgb(0, 163, 227)'
              name={t('Native Territories')}
              checked={!!otherLayers.native_territories}
              onChange={(checked, name) => toggleMapLayer('native_territories')}
            />
            <span className={classes.layerLabel}>
              {t('Native Territories')}
            </span>
            <a href='https://native-land.ca' target='__blank'>
              <Icon name='Info' tooltipContent='Credit to native-land.ca' tooltipId='helpTipTwo' />
            </a>
          </div>
        </div>
      </div>

      {currentUser && (
        <button
          data-tooltip-id='helpTip'
          data-tooltip-content='Add item to map'
          className={cn(
            'border-2 border-foreground/20 hover:border-foreground/50 hover:text-foreground rounded-md p-2 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center absolute bottom-10 right-5 gap-1 text-xs',
            classes.drawerAdjacentButton,
            {
              [classes.active]: isAddingItemToMap,
              [classes.drawerOpen]: !hideDrawer
            })}
          onClick={handleAddItemToMap}
        >
          <Icon name='Plus' className={cn({ [classes.openDrawer]: !hideDrawer, [classes.closeDrawer]: hideDrawer })} />
        </button>
      )}
      <Tooltip
        delay={550}
        id='helpTip'
        position='left'
      />
      <Tooltip
        delay={550}
        id='helpTipTwo'
        position='bottom'
        className={classes.helpTipTwo}
      />

      {createCreatePopupVisible && (
        <div
          className='absolute w-[200px] bg-background z-50 rounded-md drop-shadow-md p-2 flex flex-col items-center'
          style={{ top: createPopupPosition.top, left: createPopupPosition.left }}
          onClick={() => setCreatePopupVisible(false)}
        >
          <CreateMenu mapView coordinates={{ lat: createPopupPosition.lat, lng: createPopupPosition.lng }} />
          <button className='mt-2' onClick={() => setCreatePopupVisible(false)}>Close</button>
        </div>
      )}
    </div>
  )
}

export default MapExplorer
