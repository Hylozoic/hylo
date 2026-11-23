export default {
  isProject () {
    return this.get('type') === Post.Type.PROJECT
  },

  isTask () {
    return this.get('type') === Post.Type.TASK
  },

  // Membership is the project role, not the follow flag. Unfollowing a post
  // must not drop someone from the member list.
  // On a task the members are its assignees.
  members: function () {
    if (!this.isProject() && !this.isTask()) return false
    return this.belongsToMany(User).through(PostUser)
      .where({ 'posts_users.active': true, 'users.active': true })
      .query(q => q.whereNotNull('posts_users.project_role_id'))
  },

  // The add/remove/set helpers serve both kinds of post that have members: legacy project
  // posts (their members) and tasks (their assignees). Both are stored as a posts_users row
  // holding the post's member project role.
  addPostMembers: async function (usersOrIds, opts) {
    // need to fetchId for ProjectRole
    const projectRole = await this.getOrCreateMemberProjectRole(opts)
    return this.addFollowers(usersOrIds, {
      project_role_id: projectRole.id,
      following: true
    }, opts)
  },

  removePostMembers: async function (usersOrIds, opts) {
    return this.updateFollowers(usersOrIds, {
      project_role_id: null,
      following: false
    }, opts)
  },

  setPostMembers: async function (userIds, opts) {
    const members = await this.members().fetch(opts)
    await this.removePostMembers(members, opts)
    await this.addPostMembers(userIds, opts)
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
