const BRAND_HOSTS = [
  { brand: 'facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  { brand: 'twitter', hosts: ['x.com', 'twitter.com'] },
  { brand: 'linkedin', hosts: ['linkedin.com'] },
  { brand: 'instagram', hosts: ['instagram.com'] },
  { brand: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { brand: 'github', hosts: ['github.com'] },
  { brand: 'tiktok', hosts: ['tiktok.com'] },
  { brand: 'bluesky', hosts: ['bsky.app'] },
  { brand: 'substack', hosts: ['substack.com'] },
  { brand: 'medium', hosts: ['medium.com'] },
  { brand: 'threads', hosts: ['threads.net'] },
  { brand: 'twitch', hosts: ['twitch.tv'] },
  { brand: 'discord', hosts: ['discord.com', 'discord.gg'] },
  { brand: 'patreon', hosts: ['patreon.com'] },
  { brand: 'spotify', hosts: ['spotify.com'] },
  { brand: 'soundcloud', hosts: ['soundcloud.com'] },
  { brand: 'bandcamp', hosts: ['bandcamp.com'] },
  { brand: 'vimeo', hosts: ['vimeo.com'] },
  { brand: 'pinterest', hosts: ['pinterest.com'] },
  { brand: 'reddit', hosts: ['reddit.com'] },
  { brand: 'telegram', hosts: ['t.me', 'telegram.org'] },
  { brand: 'kofi', hosts: ['ko-fi.com'] },
  { brand: 'linktree', hosts: ['linktr.ee'] },
  { brand: 'etsy', hosts: ['etsy.com'] },
  { brand: 'meetup', hosts: ['meetup.com'] }
]

/** Brand name for a profile link URL, or null when the host is unknown or the URL is invalid. */
export function brandForUrl (url) {
  let hostname
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  hostname = hostname.replace(/^(www|m)\./, '')
  const match = BRAND_HOSTS.find(({ hosts }) =>
    hosts.some(host => hostname === host || hostname.endsWith('.' + host))
  )
  return match ? match.brand : null
}
