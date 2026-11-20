import React from 'react'
import { Globe } from 'lucide-react'
import SimpleIcon from 'components/SimpleIcon'
import { brandForUrl } from 'util/brandForUrl'

/** Brand icon for a known site, otherwise a globe. */
export default function ProfileLinkIcon ({ url, className }) {
  const brand = brandForUrl(url)
  if (brand) return <SimpleIcon name={brand} className={className} />
  return <Globe className={className} aria-hidden />
}
