export const MIN_THRESHOLD = 1
export const MAX_THRESHOLD = 8

// A force layout stays fluid up to roughly this many edges; the smart default
// picks the loosest threshold that fits under it
const LINK_BUDGET = 350

// Skills are freeform tags, so group them case-insensitively. Each threshold
// option reports how many skill nodes and edges that minimum-holder count
// would put on the map, for the filter dropdown ("1 person" shows everything,
// "8+ people" only the group's most common skills).
export function analyzeSkills (members) {
  const skillMap = new Map()

  members.forEach(member => {
    const seen = new Set()
    const skills = member.skills || []
    skills.forEach(memberSkill => {
      const key = memberSkill.name?.trim().toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      if (!skillMap.has(key)) {
        skillMap.set(key, { name: memberSkill.name.trim(), memberIds: [] })
      }
      skillMap.get(key).memberIds.push(member.id)
    })
  })

  const skillGroups = []
  const thresholdOptions = []
  for (let t = MIN_THRESHOLD; t <= MAX_THRESHOLD; t++) {
    thresholdOptions.push({ threshold: t, skillCount: 0, linkCount: 0 })
  }

  skillMap.forEach((skill, key) => {
    const holders = skill.memberIds.length
    skillGroups.push({ key, name: skill.name, memberIds: skill.memberIds })
    thresholdOptions.forEach(option => {
      if (holders >= option.threshold) {
        option.skillCount++
        option.linkCount += holders
      }
    })
  })

  return { skillGroups, thresholdOptions }
}

export function smartThreshold (thresholdOptions) {
  const fit = thresholdOptions.find(option => option.linkCount <= LINK_BUDGET)
  return fit ? fit.threshold : MAX_THRESHOLD
}

export function buildGraphNodes (members, skillGroups, minCount) {
  const nodes = []
  const links = []
  const connectedMemberIds = new Set()

  skillGroups.forEach(skill => {
    if (skill.memberIds.length < minCount) return
    nodes.push({ id: `s-${skill.key}`, type: 'skill', name: skill.name, count: skill.memberIds.length })
    skill.memberIds.forEach(memberId => {
      connectedMemberIds.add(memberId)
      links.push({ source: `p-${memberId}`, target: `s-${skill.key}` })
    })
  })

  members.forEach(member => {
    if (connectedMemberIds.has(member.id)) {
      nodes.push({ id: `p-${member.id}`, type: 'person', personId: member.id, name: member.name, avatarUrl: member.avatarUrl })
    }
  })

  return { nodes, links }
}
