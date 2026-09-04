import { CompositeLayer } from '@deck.gl/core'
import { IconLayer } from '@deck.gl/layers'
import { lucideIconDataUrl } from './lucideIconDataUrl'

const defaultGroupUrl = '/assets/default_group_avatar.png'

const resolvedMapAvatarUrls = new Map()
const pendingMapAvatarChecks = new Set()

const toMapVariant = url => {
  if (!url) return null
  if (!url.includes('/evo-uploads/')) return url
  const base = url.split('?')[0]
  return base.replace(/(\.[a-zA-Z0-9]{2,4})?$/, '') + '-forMap.png'
}

/**
 * Prefer the pre-sized -forMap.png variant when it exists; fall back to the original
 * avatar URL. Legacy uploads often never got a map variant (403 on CloudFront).
 */
function getMapAvatarUrl (avatarUrl) {
  if (!avatarUrl) return null
  if (!avatarUrl.includes('/evo-uploads/')) return avatarUrl

  if (resolvedMapAvatarUrls.has(avatarUrl)) {
    return resolvedMapAvatarUrls.get(avatarUrl)
  }

  const forMapUrl = toMapVariant(avatarUrl)
  resolvedMapAvatarUrls.set(avatarUrl, avatarUrl)

  if (!pendingMapAvatarChecks.has(avatarUrl)) {
    pendingMapAvatarChecks.add(avatarUrl)
    fetch(forMapUrl, { method: 'HEAD', mode: 'cors' })
      .then(res => {
        if (res.ok) resolvedMapAvatarUrls.set(avatarUrl, forMapUrl)
      })
      .catch(() => {})
      .finally(() => pendingMapAvatarChecks.delete(avatarUrl))
  }

  return avatarUrl
}

// Icon Layer for Groups and Spaces (spaces use Lucide icons at the same size as group avatars)
export function createIconLayerFromGroups ({ boundingBox, groups, onHover, onClick }) {
  const data = groups.filter(group => group.locationObject && group.locationObject.center)
    .map(group => {
      const isSpace = group.type === 'space'
      return {
        id: group.id,
        slug: group.slug,
        homeRoute: group.homeRoute,
        parentSlug: group.parentGroup?.slug || null,
        type: isSpace ? 'space' : 'group',
        message: (isSpace ? 'Space: ' : 'Group: ') + group.name,
        avatarUrl: getMapAvatarUrl(group.avatarUrl),
        icon: group.icon,
        coordinates: [parseFloat(group.locationObject.center.lng), parseFloat(group.locationObject.center.lat)]
      }
    })

  return new IconLayer({
    loadOptions: {
      image: { crossOrigin: 'anonymous' }
    },
    id: 'group-icon-layer',
    data,
    sizeScale: 1,
    getPosition: d => d.coordinates,
    // getIcon return an object which contains url to fetch icon of each data point
    getIcon: d => ({
      url: d.type === 'space'
        ? lucideIconDataUrl(d.icon)
        : (d.avatarUrl || defaultGroupUrl),
      width: 42,
      height: 42,
      anchorY: 0
    }),
    getSize: d => 32,
    sizeUnits: 'pixels',
    // sizeMinPixels: 20,
    pickable: true,
    onHover,
    onClick
  })
  // return new GroupIconLayer({ boundingBox, data, onHover, onClick, getPosition: d => d.coordinates })
}

// XXX: Not currently used
export default class GroupIconLayer extends CompositeLayer {
  getPickingInfo ({ info, mode }) {
    const pickedObject = info.object && info.object.properties
    if (pickedObject) {
      info.object = pickedObject
    }
    return info
  }

  renderLayers () {
    const { data, onHover, onClick } = this.props

    const groupIconLayer = new IconLayer({
      loadOptions: {
        image: { crossOrigin: 'anonymous' }
      },
      id: 'group-icon-layer',
      data,
      sizeScale: 1,
      getPosition: d => d.coordinates,
      // getIcon return an object which contains url to fetch icon of each data point
      //  || '/assets/all-groups-avatar.png'
      getIcon: d => ({
        url: d.avatarUrl || defaultGroupUrl,
        width: 40,
        height: 40,
        anchorY: 40
      }),
      getSize: d => 40,
      sizeUnits: 'pixels',
      sizeMinPixels: 20,
      pickable: true,
      onHover,
      onClick
    })

    return [groupIconLayer]
  }
}
