'use strict'

exports.seed = function (knex, Promise) {
  // create records to be loaded
  const responsibilitiesData = [
    {
      title: 'Administration',
      description: 'Allows for editing group settings, exporting data, and deleting the group.',
      type: 'system'
    },
    {
      title: 'Add Members',
      description: 'The ability to invite and add new people to the group, and to accept or reject join requests.',
      type: 'system'
    },
    {
      title: 'Remove Members',
      description: 'The ability to remove a member from the group.',
      type: 'system'
    },
    {
      title: 'Manage Content',
      description: 'Adjust group topics, custom views and manage content that contradicts the agreements of the group.',
      type: 'system'
    }
  ]

  const commonRolesData = [
    {
      name: 'Coordinator',
      description: 'Coordinators are empowered to do everything related to group administration.',
      emoji: '🪄'
    },
    {
      name: 'Moderator',
      description: 'Moderators are expected to actively engage in discussion, encourage participation, and take corrective action if a member violates group agreements.',
      emoji: '⚖️'
    },
    {
      name: 'Host',
      description: 'Hosts are responsible for cultivating a good atmosphere by welcoming and orienting new members, embodying the group culture and agreements, and helping members connect with relevant content and people.',
      emoji: '👋'
    }
  ]

  const commonRoleResponsibilitiesData = [
    { common_role_id: 1, responsibility_id: 1 },
    { common_role_id: 1, responsibility_id: 2 },
    { common_role_id: 1, responsibility_id: 3 },
    { common_role_id: 1, responsibility_id: 4 },
    { common_role_id: 2, responsibility_id: 3 },
    { common_role_id: 2, responsibility_id: 4 },
    { common_role_id: 3, responsibility_id: 2 }
  ]

  const initialStarterGroup = {
    name: 'starter-posts',
    slug: 'starter-posts',
    avatar_url: 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_avatar.png',
    banner_url: 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_banner.jpg',
    group_data_type: 1,
    visibility: 1,
    accessibility: 1,
    settings: { allow_group_invites: false, public_member_directory: false }
  }

  const now = new Date().toISOString()
  const initialWidgets = `
    INSERT INTO "public"."widgets"("id","name","created_at") VALUES
      (1,E'text_block','${now}'),
      (2,E'announcements','${now}'),
      (3,E'active_members','${now}'),
      (4,E'requests_offers','${now}'),
      (5,E'posts','${now}'),
      (6,E'community_topics','${now}'),
      (7,E'events','${now}'),
      (8,E'project_activity','${now}'),
      (9,E'group_affiliations','${now}'),
      (10,E'map','${now}');`

  const axolotlUser = {
    email: 'edward+axolotl@hylo.com',
    name: 'Hylo the Axolotl',
    avatar_url: 'https://d3ngex8q79bk55.cloudfront.net/evo-uploads/user/13986/userAvatar/13986/Hylo%20the%20Axolotl%20Face.png',
    active: true,
    email_validated: true,
    created_at: now,
    bio: "Hi! I'm Hylo the Axolotl. I'm here to help you make your community a more connected, collaborative, and creative place.",
    banner_url: 'https://d3ngex8q79bk55.cloudfront.net/misc/default_user_banner.jpg',
    extra_info: '[www.hylo.com](http://www.hylo.com/)',
    new_notification_count: 0,
    settings: '{"locale": "en", "dm_notifications": "email", "comment_notifications": "email"}',
    url: 'http://www.hylo.com/'
  }

  const initialPost = {
    name: 'Welcome to your community on Hylo! Here are a few tips.',
    description: `<p>Hylo makes it easy for you to reach out to people in your community with special skills, connections and resources that can help you achieve your goals.</p>
      <p>Here&rsquo;s how to get the most out of Hylo:</p>
      <p>Start off by making a post. Looking for help on something? Try creating a Request. Have a special skill or resource to share? Try making an Offer.</p>
      <p>Know someone who might be able to help out on a Request? You can @tag other users in a community, or click on someone&rsquo;s name to message them directly.</p>
      <p>Need more help? Please check out our User Guide at engage.hylo.com or email us at <a href="mailto:hello@hylo.com,">hello@hylo.com</a>&nbsp;</p>
      <p>Happy connecting,</p>
      <p>&lt;3 Hylo Helper</p>`,
    type: 'offer',
    created_at: now,
    active: true,
    visibility: 0,
    user_id: 1
  }

  // now wipe and initialize the database
  // NB: Deletes ALL existing users, groups, and posts, etc
  return knex('groups_posts').del()
    .then(() => knex('group_memberships_common_roles').del())
    .then(() => knex('groups_tags').del())
    .then(() => knex('tag_follows').del())
    .then(() => knex('linked_account').del())
    .then(() => knex('group_memberships').del())
    .then(() => knex('group_widgets').del())
    .then(() => knex('posts_users').del())
    .then(() => knex('posts').del())
    .then(async () => {
      await knex('groups').del()
      await knex.raw('ALTER SEQUENCE groups_id_seq RESTART WITH 1')
      await knex('groups').insert(initialStarterGroup)

      await knex('responsibilities').del()
      await knex.raw('ALTER SEQUENCE responsibilities_id_seq RESTART WITH 1')
      await knex('responsibilities').insert(responsibilitiesData)

      await knex('common_roles').del()
      await knex.raw('ALTER SEQUENCE common_roles_id_seq RESTART WITH 1')
      await knex('common_roles').insert(commonRolesData)

      await knex('common_roles_responsibilities').del()
      await knex.raw('ALTER SEQUENCE common_roles_responsibilities_id_seq RESTART WITH 1')
      await knex('common_roles_responsibilities').insert(commonRoleResponsibilitiesData)

      await knex('widgets').del()
      await knex.raw('ALTER SEQUENCE widgets_id_seq RESTART WITH 1')
      await knex.raw(initialWidgets)

      await knex('users').del()
      await knex.raw('ALTER SEQUENCE users_seq RESTART WITH 1')
      await knex('users').insert(axolotlUser)

      // await knex('posts').del() <== have to delete before deleting users
      await knex.raw('ALTER SEQUENCE post_seq RESTART WITH 1')
      await knex('posts').insert(initialPost)

      await knex('groups_posts').del()
      await knex.raw('ALTER SEQUENCE post_community_id_seq RESTART WITH 1')
      await knex('groups_posts').insert({
        post_id: 1,
        group_id: 1
      })
    })
}
