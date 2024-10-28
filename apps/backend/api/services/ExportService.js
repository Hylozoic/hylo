import stringify from 'csv-stringify'
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

    // iterate over all group members
    await Promise.all(users.map((u, idx) => {
      // pluck core user data into results
      results.push(u.pick([
        'id', 'name', 'contact_email', 'contact_phone', 'avatar_url', 'tagline', 'bio',
        'url', 'twitter_name', 'facebook_url', 'linkedin_url'
      ]))

      // return combined promise to load all dependent user data and
      // assign final child query results back onto matching result objects upon completion
      return Promise.all([

        // location (full details)
        u.locationObject().fetch()
          .then(location => {
            results[idx].location = renderLocation(location)
          }),

        // affiliations
        u.affiliations().fetch()
          .then(affils => {
            results[idx].affiliations = accumulatePivotCell(affils, renderAffiliation)
          }),

        // skills
        u.skills().fetch()
          .then(skills => {
            results[idx].skills = accumulatePivotCell(skills, renderSkill)
          }),

        // skills to learn
        u.skillsToLearn().fetch()
          .then(skills => {
            results[idx].skills_to_learn = accumulatePivotCell(skills, renderSkill)
          }),

        // Join questions & answers
        // TODO: pull direectly from groupJoinQuestionAnswers. how to sort by latest of each question within that group?
        // https://stackoverflow.com/questions/12245289/select-unique-values-sorted-by-date
        u.groupJoinQuestionAnswers()
          .where({ group_id: parseInt(groupId) })
          .orderBy('created_at', 'DESC')
          .fetch({ withRelated: ['question'] })
          .then(answers => {
            return Promise.all(answers.map(qa =>
              Promise.all([
                qa.load(['question']),
                Promise.resolve(qa)
              ])
            ))
          })
          .then(data => {
            if (!data) return
            results[idx].join_question_answers = accumulateJoinQA(data, questions)
          }),

        // other groups the requesting member has acccess to
        groupFilter(userId)(u.groups()).fetch()
          .then(groups => {
            results[idx].groups = accumulatePivotCell(groups, renderGroup)
          })

      ])
    }))

    // send data as CSV response
    output(results, [
      'id', 'name', 'contact_email', 'contact_phone', 'location', 'avatar_url', 'tagline', 'bio',
      { key: 'url', header: 'personal_url' },
      'twitter_name', 'facebook_url', 'linkedin_url',
      'skills', 'skills_to_learn',
      'affiliations',
      'groups'
    ], email, group.get('name'), questions)
  }
}

// toplevel output function for specific endpoints to complete with
function output (data, columns, email, groupName, questions) {
  // Add each question as a column in the results
  const questionsArray = Object.values(questions)
  questionsArray.forEach((question) => {
    columns.push(`${question.text}`)
  })

  // Add rows for each user to match their answers with the added question colums
  const transformedData = data.map((user) => {
    const answers = user.join_question_answers
    questionsArray.forEach((question) => {
      if (!answers) {
        user[`${question.text}`] = '-'
      } else {
        const foundAnswer = answers.find((answer) => `${question.id}` === `${answer.question_id}`)
        user[`${question.text}`] = foundAnswer
          ? user[`${question.text}`] = foundAnswer.answer
          : user[`${question.text}`] = '-'
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
      const question = record[0].toJSON().question
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
