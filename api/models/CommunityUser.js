module.exports = {

  tableName: 'users_community',
  autoCreatedAt: false,
  autoUpdatedAt: false,
  autoPK: false,

  attributes: {
    role: 'integer',
    user: {
      model: 'user',
      columnName: 'users_id'
    },
    community: {
      model: 'community',
      columnName: 'community_id'
    }
  }

};

