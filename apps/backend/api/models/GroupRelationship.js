import HasSettings from './mixins/HasSettings'
import Group from './Group'

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'group_relationships',
  requireFetch: false,
  hasTimestamps: true,

  parentGroup () {
    return this.belongsTo(Group, 'parent_group_id')
  },

  childGroup () {
    return this.belongsTo(Group, 'child_group_id')
  },

  // For peer-to-peer relationships, this returns the "other" group from the perspective of the given group
  otherGroup (fromGroupId) {
    const parentId = this.get('parent_group_id')
    const fromId = fromGroupId instanceof Group ? fromGroupId.id : fromGroupId

    if (this.get('relationship_type') === Group.RelationshipType.PEER_TO_PEER) {
      return fromId === parentId ? this.childGroup() : this.parentGroup()
    }

    // For parent-child relationships, maintain existing behavior
    return fromId === parentId ? this.childGroup() : this.parentGroup()
  },

  isPeerToPeer () {
    return this.get('relationship_type') === Group.RelationshipType.PEER_TO_PEER
  },

  isParentChild () {
    return this.get('relationship_type') === Group.RelationshipType.PARENT_CHILD
  }

}, HasSettings), {

  forPair (parentGroup, childGroup) {
    const parentId = parentGroup instanceof Group ? parentGroup.id : parentGroup
    const childId = childGroup instanceof Group ? childGroup.id : childGroup
    if (!parentId || !childId) return null
    return GroupRelationship.where({
      parent_group_id: parentId,
      child_group_id: childId,
      active: true
    })
  },

  childIdsFor (groupIds) {
    const parentGroupIds = Array.isArray(groupIds) ? groupIds : [groupIds]
    return GroupRelationship.query()
      .select('child_group_id')
      .where('group_relationships.active', true)
      .where('group_relationships.relationship_type', Group.RelationshipType.PARENT_CHILD)
      .whereIn('parent_group_id', parentGroupIds)
  },

  parentIdsFor (groupIds) {
    const childGroupIds = Array.isArray(groupIds) ? groupIds : [groupIds]
    return GroupRelationship.query()
      .select('parent_group_id')
      .where('group_relationships.active', true)
      .where('group_relationships.relationship_type', Group.RelationshipType.PARENT_CHILD)
      .whereIn('child_group_id', childGroupIds)
  },

  peerIdsFor (groupIds) {
    // For peer relationships, we need to get both directions since they're stored as single records
    // Use a union approach that's simpler and avoids parameter binding issues
    const parentPeers = GroupRelationship.query()
      .select('child_group_id as group_id')
      .where('group_relationships.active', true)
      .where('group_relationships.relationship_type', Group.RelationshipType.PEER_TO_PEER)
      .whereIn('parent_group_id', groupIds)

    const childPeers = GroupRelationship.query()
      .select('parent_group_id as group_id')
      .where('group_relationships.active', true)
      .where('group_relationships.relationship_type', Group.RelationshipType.PEER_TO_PEER)
      .whereIn('child_group_id', groupIds)

    return parentPeers.union(childPeers)
  }
})
