/**
 * Resolve a published offering id by group slug + offering name (sequence-independent).
 * @param {import('@playwright/test').Page} page
 * @param {string} groupSlug
 * @param {string} offeringName
 */
export async function fetchOfferingIdForGroup (page, groupSlug, offeringName) {
  return page.evaluate(
    async ({ slug, name }) => {
      const gRes = await fetch('/noo/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `query ($slug: String) {
            group(slug: $slug) { id }
          }`,
          variables: { slug }
        })
      })
      const gText = await gRes.text()
      if (!gRes.ok) {
        throw new Error(`group query HTTP ${gRes.status}: ${gText.slice(0, 240)}`)
      }
      let gJson
      try {
        gJson = JSON.parse(gText)
      } catch {
        throw new Error(`group query non-JSON: ${gText.slice(0, 240)}`)
      }
      const groupId = gJson?.data?.group?.id
      if (!groupId) return null

      const oRes = await fetch('/noo/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `query ($groupId: ID!) {
            publicStripeOfferings(groupId: $groupId) {
              offerings { id name }
            }
          }`,
          variables: { groupId }
        })
      })
      const oText = await oRes.text()
      if (!oRes.ok) {
        throw new Error(`offerings query HTTP ${oRes.status}: ${oText.slice(0, 240)}`)
      }
      let oJson
      try {
        oJson = JSON.parse(oText)
      } catch {
        throw new Error(`offerings query non-JSON: ${oText.slice(0, 240)}`)
      }
      const items = oJson?.data?.publicStripeOfferings?.offerings || []
      const row = items.find(o => o.name === name)
      return row?.id ?? null
    },
    { slug: groupSlug, name: offeringName }
  )
}
