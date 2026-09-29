export default {
  isProject () {
    return this.get('type') === Post.Type.PROJECT
  },

  // Not this.followers(): a member who unfollows the project to stop comment notifications stays a member
  members: function () {
    if (!this.isProject()) return false
    return this.belongsToMany(User).through(PostUser)
      .where({ 'posts_users.active': true, 'users.active': true })
      .query(q => q.whereNotNull('posts_users.project_role_id'))
  },

  addProjectMembers: async function (usersOrIds, opts) {
    // need to fetchId for ProjectRole
    const projectRole = await this.getOrCreateMemberProjectRole(opts)
    return this.addFollowers(usersOrIds, {
      project_role_id: projectRole.id,
      following: true
    }, opts)
  },

  isProjectMember: async function (userId, opts) {
    const postUser = await PostUser.query(q => {
      q.where({ post_id: this.id, user_id: userId, active: true })
      q.whereNotNull('project_role_id')
    }).fetch(opts)
    return !!postUser
  },

  // D57: the project's creator hears when someone joins, in-app and by push
  notifyCreatorOfJoin: async function (userId) {
    const creatorId = this.get('user_id')
    if (!creatorId || String(creatorId) === String(userId)) return null
    return Activity.saveForReasons([{
      reader_id: creatorId,
      actor_id: userId,
      post_id: this.id,
      reason: 'projectJoined'
    }])
  },

  removeProjectMembers: async function (usersOrIds, opts) {
    return this.updateFollowers(usersOrIds, {
      project_role_id: null,
      following: false
    }, opts)
  },

  setProjectMembers: async function (userIds, opts) {
    const members = await this.members().fetch(opts)
    await this.removeProjectMembers(members, opts)
    await this.addProjectMembers(userIds, opts)
  },

  getOrCreateMemberProjectRole: async function (opts) {
    const memberRole = await ProjectRole.where({
      name: ProjectRole.MEMBER_ROLE_NAME,
      post_id: this.id
    }).fetch(opts)
    if (memberRole) {
      return memberRole
    } else {
      return ProjectRole.forge({
        post_id: this.id,
        name: ProjectRole.MEMBER_ROLE_NAME
      })
        .save({}, opts)
    }
  }
}
