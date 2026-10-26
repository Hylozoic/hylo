/**
 * Fixed cast for the River City demo. Re-runs produce the same people.
 * Tibet is the existing tibet@terran.io account and is not created.
 */

const SKILL_POOL = [
  'gardening', 'fruit picking', 'carpentry', 'bike repair', 'pickup truck',
  'childcare', 'cooking', 'first aid', 'spanish', 'vietnamese', 'dari',
  'hmong', 'tech help', 'ham radio'
]

const BIOS_EN = [
  'Happy to lend tools if you bring them back clean.',
  'I bake on Fridays and always have extra.',
  'Retired, and I like knowing my neighbors.',
  'Can haul a couch if the date works.',
  'Learning to garden in a small yard.',
  'Night shift, so mornings are when I can help.',
  'I keep a bin of kids clothes on the porch.',
  'Good with a drill, bad at asking for help.',
  'Walks the neighborhood and notices fruit going to waste.',
  'Has a folding table and two chairs to lend.',
  'Student, no car, will trade tutoring for rides.',
  'Keeps seedlings on the back steps every spring.'
]

const BIOS_ES = [
  'Mamá de tres, cocino tamales para todos en diciembre.',
  'Tengo una troca y los sábados estoy libre.',
  'Me gusta compartir lo que sobra de la cocina.',
  'Cuido niños de la cuadra después de la escuela.',
  'Sé arreglar bicicletas, traigan las suyas el domingo.',
  'Busco maneras de ayudar sin que se sienta a caridad.',
  'Tengo frascos de más si alguien va a hacer conservas.',
  'Puedo traducir en citas si me avisan con tiempo.'
]

const BIOS_HMONG = [
  'Grow long beans and cucumbers, come take some.',
  'I can translate for clinic visits if you need Hmong.',
  'New to the neighborhood and glad this network exists.'
]

const BIOS_DARI = [
  'I can translate Dari for school meetings.',
  'Happy to help fix small things around the house.'
]

/** Eighteen people who carry the storylines. Dana has a pending join request. */
const MAINS = [
  {
    key: 'tibet',
    name: 'Tibet Sprague',
    email: 'tibet@terran.io',
    existing: true,
    neighborhood: 'midtown',
    tagline: 'Co-weaver. Has a ladder and a fruit picker, will lend both.',
    skills: ['carpentry', 'tech help'],
    spaces: ['midtown', 'oak-park', 'gleaning', 'tools', 'ready', 'grants', 'welcome'],
    roles: ['administrator', 'neighborhood-host', 'flow-funder']
  },
  {
    key: 'rosa',
    name: 'Rosa Delgado',
    email: 'rosa.delgado@example.com',
    neighborhood: 'oak',
    tagline: 'Co-founder. Keeps the 3rd Ave community fridge stocked.',
    skills: ['cooking', 'spanish'],
    spaces: ['oak-park', 'gleaning', 'ready', 'grants', 'welcome'],
    roles: ['administrator', 'neighborhood-host', 'flow-funder'],
    spanish: true
  },
  {
    key: 'marcus',
    name: 'Marcus Bell',
    email: 'marcus.bell@example.com',
    neighborhood: 'delpaso',
    tagline: 'Runs a half-acre urban farm on a vacant lot. Seedlings for anyone.',
    skills: ['gardening', 'pickup truck'],
    spaces: ['del-paso', 'gleaning', 'grants'],
    roles: ['moderator', 'neighborhood-host', 'flow-funder']
  },
  {
    key: 'lin',
    name: 'Lin Nguyen',
    email: 'lin.nguyen@example.com',
    neighborhood: 'land',
    tagline: 'Retired teacher. Calls elders on hot days.',
    skills: ['vietnamese', 'first aid'],
    spaces: ['land-park', 'ready', 'grants', 'welcome'],
    roles: ['neighborhood-host', 'flow-funder']
  },
  {
    key: 'hannah',
    name: 'Hannah Kim',
    email: 'hannah.kim@example.com',
    neighborhood: 'midtown',
    tagline: 'Leads the Gleaning Crew. 3,000 lbs of fruit saved so far.',
    skills: ['fruit picking'],
    spaces: ['gleaning', 'midtown', 'grants', 'welcome'],
    roles: ['host', 'neighborhood-host', 'flow-funder']
  },
  {
    key: 'jorge',
    name: 'Jorge Ramirez',
    email: 'jorge.ramirez@example.com',
    neighborhood: 'oak',
    tagline: 'Carpenter. Runs the tool library out of his garage.',
    skills: ['carpentry', 'spanish'],
    spaces: ['oak-park', 'tools', 'grants'],
    roles: ['neighborhood-host'],
    spanish: true
  },
  {
    key: 'walt',
    name: 'Walt Jensen',
    email: 'walt.jensen@example.com',
    neighborhood: 'land',
    tagline: 'Retired electrician, ham radio operator.',
    skills: ['ham radio', 'first aid'],
    spaces: ['land-park', 'ready', 'grants'],
    roles: ['neighborhood-host', 'flow-funder']
  },
  {
    key: 'bea',
    name: 'Bea Thompson',
    email: 'bea.thompson@example.com',
    neighborhood: 'land',
    tagline: '78, gardener for 50 years. Lemons, persimmons, opinions.',
    skills: ['gardening'],
    spaces: ['land-park', 'gleaning', 'welcome']
  },
  {
    key: 'aisha',
    name: 'Aisha Rahman',
    email: 'aisha.rahman@example.com',
    neighborhood: 'delpaso',
    tagline: 'Mom of two, night-shift CNA.',
    skills: ['childcare'],
    spaces: ['del-paso', 'welcome']
  },
  {
    key: 'nia',
    name: 'Nia Carter',
    email: 'nia.carter@example.com',
    neighborhood: 'oak',
    tagline: 'Doula. Organizes meal trains for new parents.',
    skills: ['cooking', 'childcare'],
    spaces: ['oak-park', 'welcome']
  },
  {
    key: 'dev',
    name: 'Dev Patel',
    email: 'dev.patel@example.com',
    neighborhood: 'midtown',
    tagline: 'Bike mechanic, fixes bikes for free on Sundays.',
    skills: ['bike repair'],
    spaces: ['midtown', 'tools', 'grants']
  },
  {
    key: 'sam',
    name: 'Sam Okafor',
    email: 'sam.okafor@example.com',
    neighborhood: 'midtown',
    tagline: 'Sac State junior, math tutor, no car.',
    skills: ['tech help'],
    spaces: ['midtown', 'tools', 'grants', 'welcome']
  },
  {
    key: 'tomas',
    name: 'Tomás Herrera',
    email: 'tomas.herrera@example.com',
    neighborhood: 'delpaso',
    tagline: 'Has a truck and a free Saturday most weeks.',
    skills: ['pickup truck', 'spanish'],
    spaces: ['del-paso', 'ready', 'grants'],
    roles: ['flow-funder'],
    spanish: true
  },
  {
    key: 'grace',
    name: 'Grace Liu',
    email: 'grace.liu@example.com',
    neighborhood: 'midtown',
    tagline: 'Baker. Day-old bread every Friday.',
    skills: ['cooking'],
    spaces: ['midtown', 'gleaning', 'welcome']
  },
  {
    key: 'kai',
    name: 'Kai Whitehorse',
    email: 'kai.whitehorse@example.com',
    neighborhood: 'midtown',
    tagline: 'Tenant organizer. Knows the rental assistance maze.',
    skills: ['tech help'],
    spaces: ['midtown', 'ready', 'grants'],
    roles: ['flow-funder']
  },
  {
    key: 'farid',
    name: 'Farid Haddad',
    email: 'farid.haddad@example.com',
    neighborhood: 'delpaso',
    tagline: 'Arrived in Sacramento in August with his wife and three kids.',
    skills: ['dari'],
    spaces: ['del-paso', 'grants', 'welcome']
  },
  {
    key: 'ellie',
    name: 'Ellie Moreno',
    email: 'ellie.moreno@example.com',
    neighborhood: 'oak',
    tagline: 'Fridge volunteer, teaches canning.',
    skills: ['cooking'],
    spaces: ['oak-park', 'gleaning', 'ready', 'tools', 'grants'],
    roles: ['flow-funder']
  },
  {
    key: 'priya',
    name: 'Priya Shah',
    email: 'priya.shah@example.com',
    neighborhood: 'land',
    tagline: 'ER nurse. Teaches free first aid and smoke-safety classes.',
    skills: ['first aid'],
    spaces: ['land-park', 'ready', 'grants'],
    roles: ['flow-funder']
  },
  {
    key: 'dana',
    name: 'Dana Ortiz',
    email: 'dana.ortiz@example.com',
    neighborhood: 'arden',
    tagline: 'Heard about the network from a coworker. Lives in Arden-Arcade.',
    skills: [],
    spaces: [],
    pending: true
  }
]

/** Eighty-two neighbors. Named storyline posters are pinned to the right neighborhood. */
const SUPPORTING = [
  // Oak Park, 8 Spanish-first then 13 more (21)
  person('maribel', 'Maribel Cruz', 'oak', { spanish: true }),
  person('luz', 'Luz Herrera', 'oak', { spanish: true }),
  person('camila', 'Camila Reyes', 'oak', { spanish: true }),
  person('diego', 'Diego Morales', 'oak', { spanish: true }),
  person('sofia', 'Sofia Alvarez', 'oak', { spanish: true }),
  person('elena', 'Elena Vasquez', 'oak', { spanish: true }),
  person('mateo', 'Mateo Ruiz', 'oak', { spanish: true }),
  person('valeria', 'Valeria Santos', 'oak', { spanish: true }),
  person('andre', 'Andre Washington', 'oak'),
  person('imani', 'Imani Brooks', 'oak'),
  person('chrisd', 'Chris Dalton', 'oak'),
  person('naomi', 'Naomi Reed', 'oak'),
  person('malik', 'Malik Johnson', 'oak'),
  person('helen', 'Helen Cho', 'oak'),
  person('peter', 'Peter Grant', 'oak'),
  person('amina', 'Amina Diallo', 'oak'),
  person('ruthie', 'Ruthie Owens', 'oak'),
  person('benc', 'Ben Carter', 'oak'),
  person('lila', 'Lila Nguyen', 'oak'),
  person('omar', 'Omar Farooq', 'oak'),
  person('june', 'June Park', 'oak'),

  // Midtown & Downtown (18)
  person('jordan', 'Jordan Ellis', 'midtown'),
  person('maya', 'Maya Chen', 'midtown'),
  person('alexr', 'Alex Romero', 'midtown'),
  person('noah', 'Noah Kim', 'midtown'),
  person('taylor', 'Taylor Brooks', 'midtown'),
  person('samira', 'Samira Noori', 'midtown'),
  person('chrisp', 'Chris Pham', 'midtown'),
  person('riley', 'Riley Santos', 'midtown'),
  person('avery', 'Avery Cole', 'midtown'),
  person('mina', 'Mina Park', 'midtown'),
  person('leo', 'Leo Martins', 'midtown'),
  person('harper', 'Harper Nguyen', 'midtown'),
  person('quinn', 'Quinn Adler', 'midtown'),
  person('jules', 'Jules Okonkwo', 'midtown'),
  person('remy', 'Remy Brooks', 'midtown'),
  person('sasha', 'Sasha Ivanov', 'midtown'),
  person('casey', 'Casey Nguyen', 'midtown'),
  person('drew', 'Drew Alvarez', 'midtown'),

  // Land Park & Curtis Park (13)
  person('dorothy', 'Dorothy Chen', 'land'),
  person('arthur', 'Arthur Blake', 'land'),
  person('margaret', 'Margaret Olsen', 'land'),
  person('frank', 'Frank Ito', 'land'),
  person('carol', 'Carol Nguyen', 'land'),
  person('henry', 'Henry Walsh', 'land'),
  person('irene', 'Irene Cho', 'land'),
  person('susan', 'Susan Blake', 'land'),
  person('george', 'George Nguyen', 'land'),
  person('patricia', 'Patricia Moore', 'land'),
  person('alan', 'Alan Cho', 'land'),
  person('ruthf', 'Ruth Feldman', 'land'),
  person('victor', 'Victor Tran', 'land'),

  // Del Paso: 7 Spanish, 3 Hmong, 2 Dari, 5 more (17)
  person('ramon', 'Ramón Ortega', 'delpaso', { spanish: true }),
  person('graciela', 'Graciela Ruiz', 'delpaso', { spanish: true }),
  person('yesenia', 'Yesenia Lopez', 'delpaso', { spanish: true }),
  person('hector', 'Hector Mendoza', 'delpaso', { spanish: true }),
  person('carmen', 'Carmen Diaz', 'delpaso', { spanish: true }),
  person('luis', 'Luis Ortega', 'delpaso', { spanish: true }),
  person('anaf', 'Ana Flores', 'delpaso', { spanish: true }),
  person('pa', 'Pa Vang', 'delpaso', { hmong: true }),
  person('mai', 'Mai Yang', 'delpaso', { hmong: true }),
  person('chue', 'Chue Lor', 'delpaso', { hmong: true }),
  person('laila', 'Laila Ahmadi', 'delpaso', { dari: true }),
  person('yusuf', 'Yusuf Karimi', 'delpaso', { dari: true }),
  person('jamal', 'Jamal Wright', 'delpaso'),
  person('keisha', 'Keisha Brown', 'delpaso'),
  person('tony', 'Tony Nguyen', 'delpaso'),
  person('amber', 'Amber Cole', 'delpaso'),
  person('ray', 'Ray Santos', 'delpaso'),

  // Parent group only (13)
  person('brian', 'Brian Holt', 'westsac'),
  person('angela', 'Angela Reyes', 'westsac'),
  person('pete', 'Pete Nguyen', 'westsac'),
  person('megan', 'Megan Cho', 'arden'),
  person('sandra', 'Sandra Ortiz', 'arden'),
  person('kevin', 'Kevin Park', 'arden'),
  person('tina', 'Tina Vang', 'elkgrove'),
  person('nicole', 'Nicole Brooks', 'elkgrove'),
  person('jason', 'Jason Lee', 'elkgrove'),
  person('fatima', 'Fatima Noori', 'elkgrove'),
  person('andres', 'Andre Silva', 'elkgrove'),
  person('lily', 'Lily Chen', 'elkgrove'),
  person('markj', 'Mark Johnson', 'elkgrove')
]

const NEIGHBORHOOD_SPACE = {
  oak: 'oak-park',
  midtown: 'midtown',
  land: 'land-park',
  delpaso: 'del-paso'
}

const NEIGHBORHOOD_LABEL = {
  oak: 'Oak Park',
  midtown: 'Midtown',
  land: 'Land Park',
  delpaso: 'Del Paso Heights',
  westsac: 'West Sacramento',
  arden: 'Arden-Arcade',
  elkgrove: 'Elk Grove'
}

/**
 * Build one supporting neighbor.
 * @param {string} key
 * @param {string} name
 * @param {string} neighborhood
 * @param {{ spanish?: boolean, hmong?: boolean, dari?: boolean }} [flags]
 */
function person (key, name, neighborhood, flags = {}) {
  return {
    key,
    name,
    email: `${key}@example.com`,
    neighborhood,
    spanish: !!flags.spanish,
    hmong: !!flags.hmong,
    dari: !!flags.dari,
    supporting: true
  }
}

/**
 * Skills, bio, and space memberships for a supporting neighbor. Deterministic from index.
 * @param {object} member
 * @param {number} index
 */
function decorateSupporting (member, index) {
  const skillCount = (index % 3) + 1
  const skills = []
  for (let n = 0; n < skillCount; n++) {
    skills.push(SKILL_POOL[(index + n * 5) % SKILL_POOL.length])
  }
  if (member.spanish && !skills.includes('spanish')) skills[0] = 'spanish'
  if (member.hmong) skills[0] = 'hmong'
  if (member.dari) skills[0] = 'dari'

  let tagline
  if (member.spanish) tagline = BIOS_ES[index % BIOS_ES.length]
  else if (member.hmong) tagline = BIOS_HMONG[index % BIOS_HMONG.length]
  else if (member.dari) tagline = BIOS_DARI[index % BIOS_DARI.length]
  else tagline = BIOS_EN[index % BIOS_EN.length]

  const space = NEIGHBORHOOD_SPACE[member.neighborhood]
  const spaces = space ? [space] : []
  // Spread people into working groups so the rooms feel occupied. Fixed slices, not random.
  if (index < 20) spaces.push('gleaning')
  if (index >= 8 && index < 24) spaces.push('tools')
  if (index % 3 === 1) spaces.push('ready')
  if (index % 5 === 0) spaces.push('grants')
  if (index < 24 || index % 7 === 0) spaces.push('welcome')
  if (member.key === 'ramon' && !spaces.includes('gleaning')) spaces.push('gleaning')
  if (member.key === 'pa') {
    if (!spaces.includes('gleaning')) spaces.push('gleaning')
    if (!spaces.includes('grants')) spaces.push('grants')
  }

  const recent = index % 20 < 11
  return { ...member, skills, tagline, spaces, recent }
}

/**
 * Everyone in the network, including Tibet and Dana.
 * @returns {object[]}
 */
function cast () {
  const supporting = SUPPORTING.map(decorateSupporting)
  return MAINS.concat(supporting)
}

/**
 * Emails of accounts this script creates (never tibet@terran.io).
 * @returns {string[]}
 */
function demoEmails () {
  return cast().filter(member => !member.existing).map(member => member.email)
}

/**
 * Which stock-photo pool a neighbor draws from. Tibet keeps his real account photo.
 * The pool is only a search bucket so the face fits the character.
 */
const PORTRAIT_GROUPS = {
  latina: ['rosa', 'ellie', 'dana', 'maribel', 'luz', 'camila', 'sofia', 'elena', 'valeria', 'graciela', 'yesenia', 'carmen', 'anaf', 'angela', 'sandra', 'riley'],
  latino: ['jorge', 'tomas', 'diego', 'mateo', 'ramon', 'hector', 'luis', 'ray', 'alexr', 'leo', 'andres', 'drew'],
  'black-woman': ['nia', 'imani', 'naomi', 'amina', 'keisha', 'nicole'],
  'black-man': ['marcus', 'sam', 'andre', 'malik', 'jamal', 'jules', 'markj'],
  'east-asian-woman': ['hannah', 'grace', 'helen', 'june', 'lila', 'maya', 'mina', 'harper', 'casey', 'carol', 'irene', 'megan', 'lily'],
  'east-asian-man': ['noah', 'chrisp', 'george', 'alan', 'victor', 'tony', 'pete', 'kevin', 'jason'],
  'south-asian-woman': ['priya', 'aisha'],
  'south-asian-man': ['dev'],
  'middle-eastern-woman': ['samira', 'laila', 'fatima'],
  'middle-eastern-man': ['farid', 'omar', 'yusuf'],
  'southeast-asian-woman': ['pa', 'mai', 'tina'],
  'southeast-asian-man': ['chue'],
  'older-woman': ['bea', 'margaret', 'susan', 'patricia', 'ruthf'],
  'older-man': ['walt', 'arthur', 'henry'],
  'older-east-asian-woman': ['lin', 'dorothy'],
  'older-east-asian-man': ['frank'],
  'indigenous-man': ['kai'],
  woman: ['ruthie', 'amber'],
  man: ['chrisd', 'peter', 'benc', 'brian'],
  person: ['jordan', 'taylor', 'avery', 'quinn', 'remy', 'sasha']
}

const PORTRAIT_OF = {}
for (const [pool, keys] of Object.entries(PORTRAIT_GROUPS)) {
  for (const key of keys) {
    PORTRAIT_OF[key] = pool
  }
}

/**
 * Stock-photo pool for one neighbor, or null for the existing account.
 * @param {string} key
 * @returns {string|null}
 */
function portraitPool (key) {
  return PORTRAIT_OF[key] || null
}

module.exports = {
  cast,
  demoEmails,
  portraitPool,
  NEIGHBORHOOD_LABEL,
  SKILL_POOL
}
