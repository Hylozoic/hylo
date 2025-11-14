import { CompositeLayer } from '@deck.gl/core'
import { IconLayer } from '@deck.gl/layers'

const defaultGroupUrl = '/assets/default_group_avatar.png'

// Icon Layer for Groups
export function createIconLayerFromGroups ({ boundingBox, groups, onHover, onClick }) {
  const toMapVariant = url => {
    if (!url) return null
    if (!url.includes('/evo-uploads/')) return url
    const base = url.split('?')[0]
    const mapUrl = base.replace(/(\.[a-zA-Z0-9]{2,4})?$/, '') + '-forMap.png'
    return mapUrl
  }

  const data = groups.filter(group => group.locationObject && group.locationObject.center)
    .map(group => ({
      id: group.id,
      slug: group.slug,
      type: 'group',
      message: 'Group: ' + group.name,
      avatarUrl: toMapVariant(group.avatarUrl) || group.avatarUrl,
      coordinates: [parseFloat(group.locationObject.center.lng), parseFloat(group.locationObject.center.lat)]
    }))

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
      url: d.avatarUrl || defaultGroupUrl,
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
