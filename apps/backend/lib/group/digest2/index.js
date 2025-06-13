import { compact, merge, startCase } from 'lodash'
import sampleData from './sampleData.json'
import formatData from './formatData'
import personalizeData from './personalizeData'
import {
  defaultTimeRange,
  getPostsAndComments,
  getRecipients,
  shouldSendData
} from './util'

const DIGEST_TEMPLATE_ID = 'tem_eCnLj6q75A7Ruu9zsLgppN'
const SAVED_SEARCH_TEMPLATE_ID = 'tem_GqjMtFKdPHjPHvkqyHBD7C3P'

const timePeriod = type => {
  switch (type) {
    case 'daily': return 'day'
    case 'weekly': return 'week'
  }
}

export const prepareDigestData = async (id, type, opts = {}) => {
  let startTime = opts.startTime
  let endTime = opts.endTime
  if (!opts.startTime) {
    const range = defaultTimeRange(type)
    startTime = range[0]
    endTime = range[1]
  }
  const group = await Group.find(id)
  const data = await getPostsAndComments(group, startTime, endTime, type)
  if (!data) return false
  const formattedData = await formatData(group, data)
  return merge({
    group_id: group.id,
    group_name: group.get('name'),
    group_avatar_url: group.get('avatar_url'),
    group_slug: group.get('slug'),
    group_url: Frontend.Route.group(group),
    time_period: timePeriod(type)
  }, formattedData)
}

export const sendToUser = (user, type, data, opts = {}) => {
  const versionName = 'Redesign 2025'
  const templateId = data.search ? SAVED_SEARCH_TEMPLATE_ID : DIGEST_TEMPLATE_ID
  let senderName
  if (data.search) {
    senderName = data.context === 'all' ? 'All My Groups' : data.context === 'public' ? 'Public' : data.group_name
    senderName += ' Saved Search'
  } else {
    senderName = `${data.group_name} ${startCase(type)} Digest`
  }

  return personalizeData(user, type, data, merge(opts, { versionName }))
    .then(data => {
      return opts.dryRun || !data
        ? false
        : Email.sendSimpleEmail(user.get('email'), templateId, data, {
          sender: {
            name: senderName,
            reply_to: 'DoNotReply@hylo.com'
          },
          version_name: versionName
        })
    })
}

export const sendDigest = (id, type, opts = {}) => {
  return prepareDigestData(id, type, opts).then(data =>
    shouldSendData(data, id)
      .then(ok => ok && getRecipients(id, type)
        .then(users => Promise.each(users, user => sendToUser(user, type, data, opts)))
        .then(users => users.length)))
}

export const sendAllDigests = (type, opts) =>
  Group.where({ active: true }).query().pluck('id')
    .then(ids => Promise.map(ids, id =>
      sendDigest(id, type, opts).then(count => count && [id, count]))
      .then(compact))

export const sendSampleData = address =>
  Email.sendSimpleEmail(address, DIGEST_TEMPLATE_ID, sampleData)
