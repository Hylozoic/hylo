export function mapNodesAndLinks (parentGroups, childGroups, currentGroup, peerGroups = [], peerGroupRelationships = []) {
  const nodes = [{ id: currentGroup.id, name: currentGroup.name, slug: currentGroup.slug, avatarUrl: currentGroup.avatarUrl }]
  parentGroups.forEach(group => {
    nodes.push({ id: group.id, name: group.name, slug: group.slug, avatarUrl: group.avatarUrl })
  })
  childGroups.forEach(group => {
    nodes.push({ id: group.id, name: group.name, slug: group.slug, avatarUrl: group.avatarUrl })
  })
  peerGroups.forEach(group => {
    nodes.push({ id: group.id, name: group.name, slug: group.slug, avatarUrl: group.avatarUrl })
  })

  // Helper function to find relationship description
  const findRelationshipDescription = (groupId) => {
    const relationship = peerGroupRelationships.find(rel => {
      return (rel.parentGroup.id === currentGroup.id && rel.childGroup.id === groupId) ||
             (rel.childGroup.id === currentGroup.id && rel.parentGroup.id === groupId)
    })
    return relationship?.description || ''
  }

  const links = parentGroups.map(group => {
    return { source: group.id, target: currentGroup.id, value: 120, type: 'parent' }
  })
  childGroups.forEach(group => {
    links.push({ source: currentGroup.id, target: group.id, value: 120, type: 'child' })
  })
  // Peer relationships are bidirectional, so we'll use a different visual style (value: 80)
  peerGroups.forEach(group => {
    links.push({
      source: currentGroup.id,
      target: group.id,
      value: 80,
      type: 'peer',
      description: findRelationshipDescription(group.id)
    })
  })

  return {
    nodes,
    links
  }
}
