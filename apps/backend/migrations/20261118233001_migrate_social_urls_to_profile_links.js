const validator = require('validator')

// Prefix http(s) when a stored value has no protocol.
function addProtocol (url) {
  if (/^https?:\/\//i.test(url)) return url
  return 'https://' + url
}

// Trim, add a protocol, and drop values that are blank or not a URL.
function normalizedUrl (value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const withProtocol = addProtocol(trimmed)
  if (!validator.isURL(withProtocol)) return null
  return withProtocol
}

// Append one profile link and return the next sort_order.
function pushLink (profileLinks, userId, url, title, sortOrder) {
  profileLinks.push({
    user_id: userId,
    url,
    title,
    icon_url: null,
    sort_order: sortOrder,
    created_at: new Date(),
    updated_at: new Date()
  })
  return sortOrder + 1
}

// Handle from an https://x.com/{handle} url.
function twitterNameFromUrl (url) {
  const path = String(url).replace(/^https?:\/\/(?:www\.)?x\.com\//i, '')
  const handle = path.split(/[/?#]/)[0]
  return handle || null
}

exports.up = async function (knex) {
  const users = await knex('users')
    .select('id', 'url', 'facebook_url', 'linkedin_url', 'twitter_name')
    .where(function () {
      this.whereNotNull('url')
        .orWhereNotNull('facebook_url')
        .orWhereNotNull('linkedin_url')
        .orWhereNotNull('twitter_name')
    })

  const profileLinks = []

  for (const user of users) {
    let sortOrder = 0
    const website = normalizedUrl(user.url)
    if (website) {
      sortOrder = pushLink(profileLinks, user.id, website, null, sortOrder)
    }

    const facebook = normalizedUrl(user.facebook_url)
    if (facebook) {
      sortOrder = pushLink(profileLinks, user.id, facebook, 'Facebook Profile', sortOrder)
    }

    const linkedin = normalizedUrl(user.linkedin_url)
    if (linkedin) {
      sortOrder = pushLink(profileLinks, user.id, linkedin, 'LinkedIn Profile', sortOrder)
    }

    const handle = user.twitter_name && String(user.twitter_name).trim().replace('@', '')
    if (handle) {
      const twitterUrl = `https://x.com/${handle}`
      if (validator.isURL(twitterUrl)) {
        pushLink(profileLinks, user.id, twitterUrl, 'X Profile', sortOrder)
      }
    }
  }

  if (profileLinks.length > 0) {
    await knex.batchInsert('user_profile_links', profileLinks, 100)
  }
}

exports.down = async function (knex) {
  // Columns exist again because the drop migration's down runs first.
  const links = await knex('user_profile_links')
    .where(function () {
      this.where(function () {
        this.whereNull('title').andWhere('sort_order', 0)
      }).orWhereIn('title', ['Facebook Profile', 'LinkedIn Profile', 'X Profile'])
    })

  const byUser = {}
  for (const link of links) {
    if (!byUser[link.user_id]) byUser[link.user_id] = []
    byUser[link.user_id].push(link)
  }

  for (const userId of Object.keys(byUser)) {
    const userLinks = byUser[userId]
    const update = {}
    const website = userLinks.find(link => link.title == null && Number(link.sort_order) === 0)
    if (website) update.url = website.url
    const facebook = userLinks.find(link => link.title === 'Facebook Profile')
    if (facebook) update.facebook_url = facebook.url
    const linkedin = userLinks.find(link => link.title === 'LinkedIn Profile')
    if (linkedin) update.linkedin_url = linkedin.url
    const xProfile = userLinks.find(link => link.title === 'X Profile')
    if (xProfile) {
      const handle = twitterNameFromUrl(xProfile.url)
      if (handle) update.twitter_name = handle
    }
    if (Object.keys(update).length > 0) {
      await knex('users').where('id', userId).update(update)
    }
  }

  const ids = links.map(link => link.id)
  if (ids.length > 0) {
    await knex('user_profile_links').whereIn('id', ids).del()
  }
}
