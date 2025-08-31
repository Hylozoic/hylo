export function mapNodesAndLinks (parentGroups, childGroups, currentGroup, peerGroups = []) {
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

  const links = parentGroups.map(group => {
    return { source: group.id, target: currentGroup.id, value: 120 }
  })
  childGroups.forEach(group => {
    links.push({ source: currentGroup.id, target: group.id, value: 120 })
  })
  // Peer relationships are bidirectional, so we'll use a different visual style (value: 80)
  peerGroups.forEach(group => {
    links.push({ source: currentGroup.id, target: group.id, value: 80, type: 'peer' })
  })

  return {
    nodes,
    links
  }
}
