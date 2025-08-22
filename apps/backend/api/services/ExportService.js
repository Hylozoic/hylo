import stringify from 'csv-stringify'
import { DateTime } from 'luxon'
import { groupFilter } from '../graphql/filters'

// Toplevel API entrypoint to check auth & route to desired exporter flow based on parameters
module.exports = {

  /**
   * Group members export by Group ID
   */
  exportMembers: async function ({ groupId, userId, email }) {
    const users = await new Group({ id: groupId })
      .members()
      .fetch()

    const group = await new Group({ id: groupId })
      .fetch()

    const results = []
    const questions = {}

    for (const u of users) {
      const userData = u.pick([
        'id', 'name', 'contact_email', 'contact_phone', 'avatar_url', 'tagline', 'bio',
        'url', 'twitter_name', 'facebook_url', 'linkedin_url'
      ])
      const membership = await GroupMembership.forPair(u.id, groupId).fetch()
      userData.last_active_at = membership.getSetting('lastReadAt') ? DateTime.fromISO(membership.getSetting('lastReadAt'))?.toFormat('yyyy-MM-dd HH:mm:ss Z') : ''

      const locationObject = await u.locationObject().fetch()
      userData.location = renderLocation(locationObject)

      const affiliations = await u.affiliations().fetch()
      userData.affiliations = accumulatePivotCell(affiliations, renderAffiliation)

      const skills = await u.skills().fetch()
      userData.skills = accumulatePivotCell(skills, renderSkill)

      const skillsToLearn = await u.skillsToLearn().fetch()
      userData.skills_to_learn = accumulatePivotCell(skillsToLearn, renderSkill)

      const joinQuestionAnswers = await u.groupJoinQuestionAnswers()
        .where({ group_id: parseInt(groupId) })
        .orderBy('created_at', 'DESC')
        .fetch({ withRelated: ['question'] })

      const answers = joinQuestionAnswers.map(qa =>
        [
          qa.relations.question,
          qa
        ]
      )

      userData.join_question_answers = accumulateJoinQA(answers, questions)

      // other groups the requesting member has acccess to
      const groups = await groupFilter(userId)(u.groups()).fetch()
      userData.groups = accumulatePivotCell(groups, renderGroup)

      results.push(userData)
    }

    // send data as CSV response
    output(results, [
      'id', 'name', 'contact_email', 'contact_phone', 'location', 'avatar_url', 'tagline', 'bio',
      { key: 'url', header: 'personal_url' },
      'twitter_name', 'facebook_url', 'linkedin_url',
      'skills', 'skills_to_learn',
      'affiliations',
      'groups',
      'last_active_at'
    ], email, group.get('name'), questions)
  },

  /**
   * User account data export including posts, comments, and media
   */
  exportUserAccount: async function ({ userId }) {
    try {
      const user = await new User({ id: userId }).fetch()
      if (!user) {
        throw new Error('User not found')
      }

      const userData = user.pick([
        'id', 'name', 'email', 'contact_email', 'contact_phone', 'avatar_url', 'tagline', 'bio',
        'url', 'twitter_name', 'facebook_url', 'linkedin_url', 'created_at', 'updated_at'
      ])

      const locationObject = await user.locationObject().fetch()
      userData.location = locationObject ? {
        full_text: locationObject.get('full_text'),
        center: locationObject.get('center'),
        country: locationObject.get('country'),
        city: locationObject.get('city'),
        region: locationObject.get('region'),
        postcode: locationObject.get('postcode')
      } : null

      const posts = await Post.query(q => q.where('user_id', userId).where('active', true).orderBy('created_at', 'DESC')).fetchAll()

      const postsData = []
      if (posts && posts.models && posts.models.length > 0) {
        for (const post of posts.models) {
          const postData = post.pick([
            'id', 'name', 'description', 'type', 'is_public', 'created_at', 'updated_at'
          ])

          const media = await Media.query(q => q.where('post_id', post.id)).fetchAll()
          postData.media = media && media.models ? media.models.map(m => ({
            id: m.get('id'),
            url: m.get('url'),
            thumbnail_url: m.get('thumbnail_url'),
            type: m.get('type'),
            name: m.get('name'),
            width: m.get('width'),
            height: m.get('height'),
            position: m.get('position')
          })) : []

          const tags = await post.tags().fetch()
          postData.tags = tags && tags.models ? tags.models.map(t => ({
            id: t.get('id'),
            name: t.get('name')
          })) : []

          postsData.push(postData)
        }
      }

      const comments = await Comment.query(q => q.where('user_id', userId).where('active', true).orderBy('created_at', 'DESC')).fetchAll()

      const commentsData = []
      if (comments && comments.models && comments.models.length > 0) {
        for (const comment of comments.models) {
          const commentData = comment.pick([
            'id', 'text', 'created_at', 'updated_at'
          ])

          const post = await comment.post().fetch()
          commentData.post = post ? {
            id: post.get('id'),
            name: post.get('name'),
            type: post.get('type')
          } : null

          const media = await Media.query(q => q.where('comment_id', comment.id)).fetchAll()
          commentData.media = media && media.models ? media.models.map(m => ({
            id: m.get('id'),
            url: m.get('url'),
            thumbnail_url: m.get('thumbnail_url'),
            type: m.get('type'),
            name: m.get('name'),
            width: m.get('width'),
            height: m.get('height')
          })) : []

          commentsData.push(commentData)
        }
      }

      const memberships = await user.memberships().fetch()
      const membershipsData = []
      if (memberships && memberships.models && memberships.models.length > 0) {
        for (const membership of memberships.models) {
          const group = await membership.group().fetch()
          if (group) {
            membershipsData.push({
              group_id: group.get('id'),
              group_name: group.get('name'),
              group_slug: group.get('slug'),
              role: membership.get('role'),
              created_at: membership.get('created_at'),
              settings: membership.get('settings')
            })
          }
        }
      }

      const exportData = {
        user: userData,
        posts: postsData,
        comments: commentsData,
        group_memberships: membershipsData,
        export_date: new Date().toISOString()
      }

      const jsonData = JSON.stringify(exportData, null, 2)
      const buff = Buffer.from(jsonData)
      const base64output = buff.toString('base64')

      Queue.classMethod('Email', 'sendExportUserAccount', {
        email: user.get('email'),
        files: [
          {
            id: `user-account-export-${user.get('name')}-${new Date().toISOString().slice(0, 10)}.json`,
            data: base64output
          }
        ]
      })

    } catch (error) {
      console.error('Error exporting user account:', error)
      throw error
    }
  }
}

// toplevel output function for specific endpoints to complete with
function output (data, columns, email, groupName, questions) {
  // Add each question as a column in the results
  const questionsArray = Object.values(questions)
  questionsArray.forEach((question) => {
    columns.push(`${question.get('text')}`)
  })

  // Add rows for each user to match their answers with the added question colums
  const transformedData = data.map((user) => {
    const answers = user.join_question_answers
    questionsArray.forEach((question) => {
      const questionText = question.get('text')
      if (!answers) {
        user[`${questionText}`] = '-'
      } else {
        const foundAnswer = answers.find((answer) => `${question.id}` === `${answer.question_id}`)
        user[`${questionText}`] = foundAnswer
          ? user[`${questionText}`] = foundAnswer.answer
          : user[`${questionText}`] = '-'
      }
    })
    return user
  })

  stringify(transformedData, {
    header: true,
    columns
  }, (err, output) => {
    if (err) {
      console.error(err)
      return
    }
    const formattedDate = new Date().toISOString().slice(0, 10)
    const buff = Buffer.from(output)
    const base64output = buff.toString('base64')

    Queue.classMethod('Email', 'sendExportMembersList', {
      email: email,
      files: [
        {
          id: `members-export-${groupName}-${formattedDate}.csv`,
          data: base64output
        }
      ]
    })
  })
}

// reduce helper to format lists of records into single CSV cells
function accumulatePivotCell (records, renderValue) {
  return records.reduce((joined, a) => joined ? (joined + `,${renderValue(a)}`) : renderValue(a), null)
}

const accumulateJoinQA = (records, questions) => {
  // an array of question/answer pairs
  if (records[0] && records[0][0]) {
    records.forEach((record) => {
      const question = record[0]
      questions[question.id] = question
    })
  }
  return records.reduce((accum, record) => accum.concat(renderJoinQuestionAnswersToJSON(record)), [])
}

// formatting for individual sub-cell record types

function renderLocation (l) {
  if (l === null || l.get('center') === null) {
    return ''
  }

  const geometry = l.get('center') // :TODO: make this work for polygonal locations, if needed
  const lat = geometry.lat
  const lng = geometry.lng
  return `${l.get('full_text')}${lat && lng ? ` (${lat.toFixed(3)},${lng.toFixed(3)})` : ''}`
}

function renderAffiliation (a) {
  return `${a.get('role')} ${a.get('preposition')} ${a.get('org_name')} ${a.get('url') ? `(${a.get('url')})` : ''}`
}

function renderSkill (s) {
  return s.get('name')
}

function renderJoinQuestionAnswersToJSON (QApair) {
  if (QApair.length === 0) { return [] }
  return [QApair[1].toJSON()]
}

function renderGroup (g) {
  return `${g.get('name')} (${Frontend.Route.group(g)})`
}
