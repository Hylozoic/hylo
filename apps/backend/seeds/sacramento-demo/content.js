/**
 * Posts, chat, and direct messages for the River City demo.
 * Times are [dayOffset, hour, minute] in America/Los_Angeles, or minutesAgo.
 */

const PLACES = {
  franklin: ['5th Ave & Franklin Blvd', 38.5492, -121.4718],
  rio: ['Rio Linda Blvd & Grand Ave', 38.6362, -121.4434],
  marysville: ['Marysville Blvd & South Ave', 38.6124, -121.4462],
  jstreet: ['21st & J St', 38.5766, -121.4808],
  sutterville: ['Land Park Dr & Sutterville Rd', 38.5438, -121.5012],
  fourth: ['24th St & 4th Ave', 38.5516, -121.4774],
  farm: ['Del Paso Blvd & Grand Ave', 38.6088, -121.4526],
  sixteenth: ['16th & P St', 38.5724, -121.4886],
  fifth: ['35th St & 5th Ave', 38.5476, -121.4618],
  broadway: ['Broadway & 33rd St', 38.5564, -121.4648],
  twentyThird: ['23rd & N St', 38.5738, -121.4786],
  capitol: ['19th & Capitol Ave', 38.5782, -121.4834],
  third: ['3rd Ave & 36th St', 38.5506, -121.4602],
  twentieth: ['20th & K St', 38.5774, -121.4822],
  norwood: ['Norwood Ave', 38.621, -121.451],
  riverside: ['Riverside Blvd', 38.5412, -121.5088],
  twentySecond: ['22nd & P St', 38.5712, -121.4796],
  figs: ['4th Ave & 38th St', 38.5494, -121.4578],
  clay: ['Grand Ave & Clay St', 38.6042, -121.4388],
  vallejo: ['Riverside Blvd & Vallejo Way', 38.5388, -121.5064],
  fridge: ['3rd Ave & 34th St', 38.5512, -121.4632],
  shed: ['5th Ave & 40th St', 38.5472, -121.4554],
  altos: ['Grand Ave & Altos Ave', 38.6004, -121.4326]
}

/**
 * @param {string} key
 * @returns {[string, number, number]}
 */
function place (key) {
  return PLACES[key]
}

/**
 * Posts that show up on the map, in spaces, and in the storylines.
 * @returns {object[]}
 */
function posts () {
  return [
    // Requests
    req('R1', 'aisha', 'Convertible car seat for my 2-year-old', 'Daycare will not take him in the old one. If you have a convertible seat your kid outgrew, we can pick it up.', 'del-paso', 'rio', [-9, 9, 10], {
      topics: ['childcare'],
      image: 'carseat',
      fulfilled: { at: [-9, 14, 5], by: ['nia'] },
      reactions: 8,
      comments: [
        { by: 'nia', at: [-9, 9, 42], text: 'I have a Graco Extend2Fit, outgrown, never in a crash. Messaging you.' },
        { by: 'aisha', at: [-9, 14, 20], text: 'Nia brought it over this afternoon. He is in it tomorrow. Thank you.', reactions: 6 }
      ]
    }),
    req('R2', 'farid', 'Beds for 3 kids (ages 6, 9, 12)', 'We got here in August and the kids are still on the floor. Twin or bunk is fine. I can help carry.', 'del-paso', 'marysville', [-14, 11, 0], {
      topics: ['furniture', 'housing'],
      image: 'bunk',
      fulfilled: { at: [-8, 16, 0], by: ['tomas'] },
      project: true,
      comments: [
        { by: 'tomas', at: [-10, 9, 0], text: 'A Midtown family has bunks. I can haul them Saturday.' }
      ]
    }),
    req('R3', 'farid', 'Kitchen table that seats 5', 'We are eating on the floor too. Nothing fancy. A table and a few chairs would change the evenings.', 'del-paso', 'marysville', [-14, 11, 20], {
      topics: ['furniture'],
      image: 'table',
      fulfilled: { at: [-5, 15, 0], by: ['jorge'] },
      project: true,
      comments: [
        { by: 'jorge', at: [-6, 18, 0], text: 'I can build one from shop scraps this week. What height works for the kids?' }
      ]
    }),
    req('R4', 'farid', 'Winter coats, kids sizes 6, 9, 12', 'Coats are the piece we still do not have. Sizes 6, 9, and 12. Used is perfect.', 'del-paso', 'marysville', [-6, 17, 0], {
      topics: ['welcome'],
      image: 'coats',
      project: true,
      commentTarget: 3,
      comments: [
        { by: 'lin', at: [-1, 19, 10], text: 'I have a size 9 puffer and a size 6 raincoat. They are clean. I can leave them with Rosa.' },
        { by: 'rosa', at: [0, 8, 40], text: 'Drop them at the fridge porch. I will text Farid.' }
      ]
    }),
    req('R5', 'farid', 'Dari speaker for a school meeting Thursday', 'The school meeting is Thursday and I do not want to miss what they are asking of us. If you speak Dari, I can meet you there.', 'del-paso', 'marysville', [-4, 12, 0], {
      topics: ['welcome'],
      project: true,
      comments: [
        { by: 'laila', at: [-3, 15, 0], text: 'I can come Thursday. Send me the time and the school name.' }
      ]
    }),
    req('R6', 'sam', 'Ride to a job interview in Rancho Cordova', 'Interview is Thursday morning in Rancho Cordova. I do not have a car and the bus gets me there late. I can chip in gas.', 'midtown', 'jstreet', [-5, 16, 0], {
      topics: ['rides'],
      fulfilled: { at: [-3, 12, 30], by: ['tomas'] },
      reactions: 6,
      comments: [
        { by: 'dev', at: [-5, 17, 0], text: 'My car is in the shop or I would take you.' },
        { by: 'tomas', at: [-5, 18, 10], text: 'I can do it. I will be at 21st and J at 8.' },
        { by: 'sam', at: [-3, 13, 0], text: 'Got the job!', reactions: 15 }
      ]
    }),
    req('R7', 'sam', 'Borrow a drill to hang shelves', 'Need a drill and a few bits for shelves tonight or tomorrow. I will bring it back to the shed.', 'tools', 'jstreet', [-2, 18, 0], {
      topics: ['tools'],
      image: 'drill',
      comments: [
        { by: 'dev', at: [-1, 9, 15], text: 'Grab mine from the shed. It is the blue case on the left. No need to ask Jorge, I already told him.' },
        { by: 'jorge', at: [0, 7, 50], text: 'Blue case is still there. Put it back on the left when you are done.' }
      ]
    }),
    req('R8', 'bea', 'Grab bars installed in my bathroom', 'The tub is getting harder. If someone can put up two grab bars, the hardware can be mine or yours.', 'land-park', 'franklin', [-17, 10, 0], {
      topics: ['housing'],
      fulfilled: { at: [-15, 14, 0], by: ['jorge'] },
      comments: [
        { by: 'jorge', at: [-16, 11, 0], text: 'I can do it Thursday. I will bring the bars so you do not have to shop.' }
      ]
    }),
    req('R9', 'lin', '2 more drivers for elder check-ins during storms', 'When the atmospheric river hits I still need two more drivers to call and visit elders in Land Park. An hour, a phone, and a car.', 'ready', 'sutterville', [-4, 9, 0], {
      topics: ['flood'],
      commentTarget: 2
    }),
    req('R10', 'walt', 'Generator to borrow for the warming hub', 'The church hall on 24th will be the warming hub if the power goes. A quiet generator for two nights would cover the cots and the radio.', 'ready', 'fourth', [-3, 11, 0], {
      topics: ['flood'],
      image: 'generator',
      comments: [
        { by: 'marcus', at: [-2, 8, 0], text: 'The farm has a small one. It is loud. Yours if nobody has a quieter one.' }
      ]
    }),
    req('R11', 'marcus', 'Working rototiller to borrow for a weekend', 'I want to open two more beds before the planting workday. A working tiller for a weekend, I will return it full of gas.', 'del-paso', 'farm', [-8, 15, 0], {
      topics: ['food'],
      image: 'tiller',
      comments: [
        { by: 'jorge', at: [-7, 19, 0], text: 'The library does not have one yet. If the fundraiser proposal passes we could buy one and keep it at the shed.' }
      ]
    }),
    req('R12', 'kai', 'Help carrying a couch to a 3rd-floor walkup, Saturday', 'A neighbor on P Street is giving a couch to someone on the third floor. We need two more people Saturday morning. No truck, just stairs.', 'midtown', 'sixteenth', [-1, 14, 0], {
      topics: ['furniture'],
      image: 'couch',
      commentTarget: 2
    }),
    req('R13', 'lin', 'Box fans for elders without AC (heat wave)', 'Checking on elders in the last heat wave. Several apartments have no AC. Box fans, working, any color.', 'ready', 'sutterville', [-40, 9, 0], {
      topics: ['heat'],
      fulfilled: { at: [-38, 17, 0], by: ['walt', 'tibet'] },
      comments: [
        { by: 'walt', at: [-40, 11, 0], text: 'I have six box fans in the garage from the old shop.' },
        { by: 'tibet', at: [-40, 12, 30], text: 'I can bring two more and help Walt drop them off.' }
      ]
    }),
    req('R14', 'nia', 'Crib or pack-n-play for a client due next week', 'A client is due next week and does not have a safe place for the baby to sleep. Crib or pack-n-play, I can pick up.', 'oak-park', 'fifth', [-2, 13, 0], {
      topics: ['childcare'],
      image: 'crib',
      comments: [
        { by: 'jorge', at: [-1, 20, 0], text: 'I think there is a pack-n-play in the shed. Checking tonight.' }
      ]
    }),
    req('R15', 'rosa', 'Rides to dialysis, Tue/Thu mornings, for my neighbor', 'My neighbor on Broadway has dialysis Tuesday and Thursday mornings. One ride a week from anyone with a car would cover the gap the medical van misses.', 'oak-park', 'broadway', [-6, 8, 0], {
      topics: ['rides'],
      image: 'rides',
      comments: [
        { by: 'imani', at: [-1, 18, 0], text: 'I can take Tuesdays. I am already headed that direction for work.' },
        { by: 'peter', at: [0, 7, 20], text: 'Thursdays work for me through the end of the month.' }
      ]
    }),
    req('R16', 'aisha', 'Kitchen faucet leaking, anyone handy?', 'The kitchen faucet started dripping hard this morning. I cannot get the water to stop all the way. If you are handy and free today, I can make tea.', 'del-paso', 'rio', null, {
      hoursAgo: 3,
      topics: ['housing'],
      image: 'faucet'
    }),
    req('R17', 'bea', 'Sandbags along the garage before Friday\'s rain', 'The last storm came over the curb on Franklin and into the garage. I cannot lift the bags. If two people can fill them and stack them along the garage door, I will have coffee on.', 'land-park', 'franklin', null, {
      hoursAgo: 4,
      spaces: ['land-park', 'ready'],
      topics: ['flood'],
      image: 'sandbags',
      reactions: 3,
      comments: [
        { by: 'walt', at: [0, 9, 10], text: 'The filled bags at the farm are by the orange cone. I can set ten aside with your name on them.' }
      ]
    }),
    req('R18', 'priya', 'Sump pump or wet vac, the garage took water again', 'Four inches in the garage after the last storm, right under the water heater. I need a pump or a wet vac for a day so it does not sit there. I can pick it up in Land Park.', 'land-park', 'riverside', null, {
      hoursAgo: 9,
      spaces: ['land-park', 'ready'],
      topics: ['flood'],
      image: 'pump',
      comments: [
        { by: 'jorge', at: [0, 8, 15], text: 'The shed has a wet vac. Yellow shop vac, bottom shelf. Bring it back emptied.' }
      ]
    }),

    // Offers
    offer('O1', 'tibet', '24 ft ladder + pole fruit picker, borrow anytime', 'Both live in my garage in Midtown. Borrow them whenever, including for gleaning. Bring the ladder back with all the parts.', ['midtown', 'tools'], 'twentyThird', [-25, 10, 0], {
      topics: ['tools', 'gleaning'],
      image: 'ladder',
      reactions: 5,
      comments: [
        { by: 'hannah', at: [-1, 16, 0], text: 'Ladder is back on your porch. Thank you, the persimmons would still be in the tree.' }
      ]
    }),
    offer('O2', 'grace', 'Day-old bread every Friday, 2–4pm', 'The bakery lets me take what is left. Fridays 2 to 4 on Capitol. Farid, there is a loaf with your name on it every week now.', ['midtown'], 'capitol', [-28, 14, 0], {
      topics: ['food'],
      image: 'bread',
      project: true,
      reactions: 7
    }),
    offer('O3', 'marcus', 'Free winter veg starts: kale, chard, garlic, 200+ plants', 'Two hundred starts on the farm table. Kale, chard, and garlic. Come take a flat. They were gone by the middle of the month.', ['del-paso', 'gleaning'], 'farm', [-30, 9, 0], {
      topics: ['food', 'seeds'],
      fulfilled: { at: [-15, 12, 0], by: ['rosa', 'bea', 'lin', 'ellie', 'grace', 'hannah', 'pa', 'ramon'] },
      image: 'farm',
      reactions: 9
    }),
    offer('O4', 'ellie', 'Meyer lemon marmalade, 24 jars', 'Twenty-four jars from the Curtis Park fruit and the canning class. First come, bring a story if you want a second jar.', ['oak-park'], 'third', [-10, 15, 0], {
      topics: ['food', 'gleaning'],
      fulfilled: { at: [-6, 11, 0], by: ['nia', 'aisha', 'bea'] },
      image: 'marmalade',
      reactions: 8
    }),
    offer('O5', 'dev', 'Free bike tune-ups Sundays', 'Sundays at 20th and K, bring the bike. Flats, brakes, and gears. Parts at cost if I have them, otherwise we make a list.', ['midtown'], 'twentieth', [-20, 11, 0], {
      topics: ['tools'],
      image: 'bikes'
    }),
    offer('O6', 'sam', 'Free algebra and calculus tutoring, Tuesdays', 'Tuesdays after 4 at the library or a cafe. Algebra through calc. Parents, your kid can come. I got help when I needed it.', ['midtown'], 'jstreet', [-15, 16, 0], {
      topics: ['welcome'],
      commentTarget: 3
    }),
    offer('O7', 'farid', 'Brakes and oil changes, free, bring parts', 'I was a mechanic before we moved. Brakes and oil changes, free, you bring the parts. It feels good to be useful here.', ['del-paso'], 'marysville', [-3, 18, 0], {
      topics: ['welcome'],
      image: 'brakes'
    }),
    offer('O8', 'tomas', 'Truck + muscle for moves, most Saturdays', 'Truck is free most Saturdays. Moves inside the city, no dump runs. Message me the night before.', ['del-paso'], 'norwood', [-18, 8, 0], {
      topics: ['rides'],
      image: 'truck'
    }),
    offer('O9', 'kai', 'Help with rental assistance applications', 'I know the rental assistance forms and which office actually answers. Bring your lease and a recent bill. English or Spanish.', ['midtown'], 'sixteenth', [-12, 13, 0], {
      topics: ['housing']
    }),
    offer('O10', 'nia', 'Meal train for new parents', 'If you just had a baby, or your neighbor did, I will set up a meal train. Oak Park and nearby. Tell me dietary needs.', ['oak-park'], 'fifth', [-7, 10, 0], {
      topics: ['childcare', 'food'],
      image: 'meals'
    }),
    offer('O11', 'walt', '6 box fans', 'Six working box fans from the old shop. They all went to Lin\'s elder list during the heat wave.', ['ready'], 'fourth', [-40, 11, 30], {
      topics: ['heat'],
      fulfilled: { at: [-38, 17, 0], by: ['lin'] }
    }),
    offer('O12', 'ellie', 'Canning class, bring 6 jars', 'Next session uses the lemons if you still have them. Bring 6 jars. The water-bath kit is in the tool shed.', ['oak-park'], 'third', [-9, 12, 0], {
      topics: ['food'],
      image: 'canning'
    }),
    offer('O13', 'walt', 'Ham radio license study group', 'Technician license study group, a few evenings. Useful when the cell network is down in a storm. No equipment required to start.', ['ready'], 'fourth', [-5, 19, 0], {
      topics: ['flood'],
      image: 'radio'
    }),
    offer('O14', 'priya', 'Box of 40 N95 masks for smoke days', 'Forty N95s from a clinic surplus. Take a few for your household before the next smoke day. I am keeping ten for the elder visits.', ['ready'], 'riverside', [-2, 8, 0], {
      topics: ['smoke'],
      image: 'masks'
    }),
    offer('O15', 'walt', 'Filled sandbags at the farm, come take them', 'Twenty bags are filled and stacked by the orange cone at the Del Paso farm. Take them before Friday\'s rain. If you cannot lift them, say so and we will find a truck.', ['ready', 'del-paso'], 'farm', null, {
      hoursAgo: 1,
      topics: ['flood'],
      image: 'sandbagpile',
      reactions: 5,
      comments: [
        { by: 'tomas', at: [0, 10, 20], text: 'I can run a load to Land Park this afternoon. Bea, I will start with your garage.' }
      ]
    }),
    offer('O16', 'tomas', 'Saturday truck for sandbags and furniture off the floor', 'Before the river comes up I can haul a load of sandbags or move a couch and a mattress upstairs. Del Paso and Land Park. Message me Friday night with the address.', ['del-paso', 'ready'], 'norwood', null, {
      hoursAgo: 14,
      topics: ['flood'],
      image: 'tarps',
      comments: [
        { by: 'aisha', at: [0, 8, 5], text: 'Our block in Del Paso floods at the corner. Can you take two mattresses up Saturday?' }
      ]
    }),

    // Resources
    resource('F1', 'bea', 'Meyer lemon + Fuyu persimmon trees, glean anytime', 'Two trees in the yard near 5th and Franklin. I cannot climb anymore. Take what you need, just leave me a dozen.', ['land-park', 'gleaning'], 'franklin', [-21, 9, 0], {
      topics: ['gleaning'],
      image: 'lemons',
      isPublic: true,
      reactions: 11,
      comments: [
        { by: 'bea', at: [-21, 9, 5], text: 'I cannot climb anymore. Take what you need, just leave me a dozen.' },
        { by: 'hannah', at: [-20, 8, 30], text: 'Bea, these are gorgeous. Can the crew come through one morning? I will message you.' }
      ]
    }),
    resource('F2', 'hannah', 'Loquat tree on the public strip', 'Loquats on the parking strip at 22nd and P. Public side of the sidewalk, ripe now, bring a bag.', ['midtown', 'gleaning'], 'twentySecond', [-16, 10, 0], { topics: ['gleaning'] }),
    resource('F3', 'hannah', 'Two fig trees along the alley', 'Two fig trees on the alley side of 4th and 38th. The owner said the crew is welcome. They ripen in a wave.', ['oak-park', 'gleaning'], 'figs', [-15, 11, 0], { topics: ['gleaning'] }),
    resource('F4', 'marcus', 'Pomegranate hedge, ask the owner first', 'A hedge of pomegranates at Grand and Clay. The fruit hangs over the sidewalk. Knock and ask, they have said yes before.', ['del-paso', 'gleaning'], 'clay', [-12, 9, 0], { topics: ['gleaning'] }),
    resource('F5', 'lin', 'Navel orange trees, ripe Dec–Feb', 'Navel oranges in the front yard, ripe December through February. Take a bag. Please do not climb the fence.', ['land-park', 'gleaning'], 'vallejo', [-9, 10, 0], { topics: ['gleaning'] }),
    resource('F6', 'rosa', 'Oak Park community fridge, open 24/7', 'The fridge on the 3rd Ave porch is open all night. Take what you need, leave what you can. It is full of Hannah\'s lemons this week.', ['oak-park'], 'fridge', [-40, 12, 0], {
      topics: ['food'],
      image: 'fridge',
      isPublic: true,
      reactions: 8
    }),
    resource('F7', 'ellie', 'Little Free Pantry', 'Dry goods cupboard next to the canning porch. Pasta, rice, and jars when we have them.', ['oak-park'], 'third', [-30, 12, 0], { topics: ['food'], image: 'pantry' }),
    resource('F8', 'marcus', 'Del Paso urban farm, free produce Saturdays', 'The half acre is open Saturdays for anyone to take produce. Bring a bag. The sandbag pile will be here too.', ['del-paso'], 'farm', [-28, 8, 0], { topics: ['food'], image: 'farm' }),
    resource('F9', 'jorge', 'Oak Park tool shed (hours, how to borrow)', 'Garage shed at 5th and 40th. Borrowing works like a library: write your name, the tool, and when it comes back. Open most evenings.', ['tools'], 'shed', [-16, 17, 0], { topics: ['tools'], image: 'tools' }),
    resource('F10', 'jorge', 'Pressure washer', 'Pressure washer lives at the Oak Park shed. Good for sidewalks and not for paint. Back in two days.', ['tools'], 'shed', [-16, 17, 10], { topics: ['tools'] }),
    resource('F11', 'jorge', 'Wet tile saw', 'Wet tile saw at the shed. Messy, so use it in the driveway. Ask Jorge before you take it off the stand.', ['tools'], 'shed', [-16, 17, 20], { topics: ['tools'] }),
    resource('F12', 'jorge', 'Post-hole digger + 2 shovels', 'Post-hole digger and two shovels. The digger is heavier than it looks. Bring it back cleaned.', ['tools'], 'shed', [-16, 17, 30], { topics: ['tools'] }),
    resource('F13', 'ellie', 'Water-bath canning kit', 'Big pot, rack, and jar lifter. Used for the lemon class. It lives at the shed between classes.', ['tools'], 'shed', [-9, 12, 10], { topics: ['tools', 'food'] }),
    resource('F14', 'walt', 'Sandbag pickup, free, bring a shovel', 'Sand is piled at the Del Paso farm for anyone filling bags before the storm. Bring a shovel and a way to haul them.', ['ready'], 'farm', [-6, 9, 0], { topics: ['flood'] }),

    // Events
    event('E1', 'hannah', 'Curtis Park Gleaning Day', 'Meet at Bea\'s lemon and persimmon trees. Bring bags, gloves, and a ladder if you have one. Half the fruit goes to the Oak Park fridge.', ['gleaning', 'land-park'], 'franklin', [-18, 15, 0], [-12, 9, 0], [-12, 11, 0], {
      topics: ['gleaning'],
      going: ['tibet', 'grace', 'ellie', 'hannah', 'rosa', 'bea', 'lin']
    }),
    event('E2', 'dev', 'Fix-it Clinic: bikes and small appliances', 'Bikes and small appliances at the Oak Park shed. Jorge is on appliances, Dev is on bikes. Bring the thing and the story of what it used to do.', ['midtown', 'tools'], 'shed', [-8, 12, 0], [2, 13, 0], [2, 16, 0], {
      topics: ['tools'],
      going: ['dev', 'jorge', 'sam', 'maya'],
      inviteTibet: true
    }),
    event('E3', 'walt', 'Sandbag Day at the Del Paso Heights farm', 'Fill bags for households that flood first. 9 to noon at the urban farm. Shovels on site, gloves if you have them.', ['ready', 'del-paso'], 'farm', [-12, 10, 0], [4, 9, 0], [4, 12, 0], {
      topics: ['flood'],
      going: ['tibet', 'walt', 'lin', 'marcus', 'tomas', 'rosa', 'priya', 'kai', 'pa'],
      interested: ['hannah', 'jorge'],
      inviteTibet: true,
      comments: [
        { by: 'walt', at: [-1, 8, 0], text: 'Sandbag Day is coming up. Tibet, you still in for the morning shift?', mention: 'tibet' }
      ]
    }),
    event('E4', 'rosa', 'Oak Park Potluck & Skill Swap', 'Sunday evening at the park picnic tables. Bring a dish if you can and one thing you know how to do. Folding tables are spoken for.', ['oak-park'], 'broadway', [-10, 11, 0], [6, 17, 0], [6, 20, 0], {
      topics: ['welcome', 'food'],
      goingCount: 11,
      going: ['tibet', 'rosa', 'ellie', 'nia', 'jorge', 'hannah'],
      inviteTibet: true
    }),
    event('E5', 'priya', 'Wildfire smoke & first aid class', 'How to seal a room, when to leave, and the first aid that shows up on smoke days. Library meeting room.', ['ready', 'land-park'], 'riverside', [-7, 18, 0], [9, 18, 0], [9, 20, 0], {
      topics: ['smoke'],
      going: ['priya', 'lin', 'walt', 'bea', 'rosa', 'kai'],
      inviteTibet: true
    }),
    event('E6', 'marcus', 'Winter Planting Workday', 'Beds, starts, and garlic at the Del Paso farm. Beginners welcome. We stop at noon and eat whatever is ready.', ['del-paso', 'gleaning'], 'farm', [-8, 9, 0], [11, 8, 0], [11, 12, 0], {
      topics: ['food'],
      going: ['marcus', 'pa', 'ramon', 'hannah', 'lin'],
      inviteTibet: true
    }),

    // Discussions
    discussion('D1', 'rosa', 'Welcome! Introduce yourself here', 'Say where you live and one thing you could share. This thread stays at the top so new people can find us.', [], [-45, 10, 0], {
      topics: ['welcome'],
      pin: true,
      commentTarget: 16,
      comments: [
        { by: 'hannah', at: [-44, 11, 0], text: 'Hannah, East Sac and Midtown. I glean fruit that would otherwise hit the sidewalk.' },
        { by: 'marcus', at: [-44, 12, 0], text: 'Marcus, Del Paso Heights. Seedlings if you have a pot.' }
      ]
    }),
    discussion('D2', 'jorge', 'Should we start a tool library?', 'My garage is already half a library. If we name it and write things down, more people can borrow without asking me first. What would you want on the shelf?', ['oak-park'], [-22, 19, 0], {
      topics: ['tools'],
      commentTarget: 14
    }),
    discussion('D3', 'hannah', 'Gleaning Day recap: 140 lbs!', '140 pounds of lemons and persimmons off Bea\'s trees. Half went to the Oak Park fridge, 30 pounds to Ellie\'s canning class. Thanks Tibet for the ladder.', ['gleaning'], [-11, 16, 0], {
      topics: ['gleaning'],
      image: 'crates',
      reactions: 12,
      mention: 'tibet',
      commentTarget: 9,
      comments: [
        { by: 'rosa', at: [-11, 17, 0], text: 'The fridge was full by evening. People kept coming back with bags.' },
        { by: 'bea', at: [-11, 18, 0], text: 'You left me my dozen, and the trees look relieved. Come back for the last persimmons.' }
      ]
    }),
    discussion('D4', 'walt', 'What\'s in your outage kit?', 'Radio, water, meds, a way to charge a phone. What do you actually have, and what do you wish a neighbor had?', ['ready'], [-9, 20, 0], {
      topics: ['flood'],
      commentTarget: 11
    }),
    discussion('D5', 'kai', 'Rent hikes on P Street, tenants meeting?', 'Several buildings on P got notices the same week. If you rent nearby and want a meeting, say so here and I will find a room.', ['midtown'], [-4, 18, 0], {
      topics: ['housing'],
      commentTarget: 6
    }),
    discussion('D6', 'hannah', 'What\'s in season right now?', 'Loquats are ready. Persimmons need another week in the shade. What are you seeing in your alley?', ['gleaning'], [-1, 9, 0], {
      topics: ['gleaning'],
      comments: [
        { by: 'bea', at: [-1, 10, 0], text: 'Persimmons on my tree are still sharp. Give them a week.' },
        { by: 'ramon', at: [-1, 14, 0], text: 'Los limones de Grand ya están buenos. Pueden pasar.' },
        { by: 'grace', at: [0, 8, 10], text: 'The loquat on 22nd dropped fruit on the sidewalk this morning. It is time.' },
        { by: 'ellie', at: [0, 9, 5], text: 'I will take a bag of loquats if someone is already going.' }
      ]
    }),

    // Proposals
    proposal('P1', 'rosa', 'How should we spend the $2,400 from the fall fundraiser?', 'The block party raised $2,400. One choice. Voting closes in a few days. We need 20% of the network for quorum.', ['ready'], [-6, 12, 0], {
      topics: ['heat'],
      voting: true,
      closes: [5, 18, 0],
      quorum: 20,
      options: [
        ['HEPA air purifiers for elders', '🌬️'],
        ['Emergency radios + battery banks', '📻'],
        ['Expand the tool library', '🔧']
      ],
      votes: [6, 4, 3]
    }),
    proposal('P2', 'rosa', 'Move the Oak Park potluck to Sundays?', 'Weeknights were leaving out the night-shift folks. Sundays 5 to 8?', ['oak-park'], [-20, 11, 0], {
      topics: ['welcome'],
      completed: true,
      closes: [-12, 18, 0],
      options: [
        ['Yes, Sundays', '✅'],
        ['No, keep weeknights', '❌']
      ],
      votes: [9, 1]
    }),

    // Project
    project('J1', 'kai', 'Welcome Home kit for Farid\'s family', 'A few of us are pulling together beds, a table, coats, and a Dari speaker for Farid, his wife, and their three kids. Add yourself if you can carry something.', ['del-paso'], [-14, 10, 0], {
      topics: ['welcome', 'housing'],
      members: ['kai', 'tomas', 'grace', 'rosa', 'jorge', 'farid']
    }),

    // Supporting neighbor posts
    req('S1', 'maribel', 'Busco cuna para mi bebé, nace en diciembre', 'Mi bebé nace en diciembre y no tenemos cuna. Si alguien tiene una, o un corralito, la paso a buscar. Gracias.', 'oak-park', 'fifth', [-3, 19, 0], {
      topics: ['childcare'],
      image: 'cuna',
      comments: [
        { by: 'jorge', at: [-2, 21, 0], text: 'Creo que hay un corralito en el cobertizo. Lo reviso y te escribo.' }
      ]
    }),
    offer('S2', 'luz', 'Clases de inglés gratis los sábados / Free English classes Saturdays', 'Sábados por la mañana en Oak Park, inglés práctico: escuela, clínica, trabajo. English for school, clinic, and work. Free.', 'oak-park', 'broadway', [-8, 9, 0], {
      topics: ['welcome'],
      image: 'english'
    }),
    event('S3', 'tomas', 'Taller: cómo prepararse para las tormentas (en español)', 'Una hora en español: agua, documentos, a quién llamar, cómo llenar sacos. Traigan a quien necesite oírlo.', ['del-paso', 'ready'], 'farm', [-5, 12, 0], [7, 10, 0], [7, 11, 30], {
      topics: ['flood'],
      goingCount: 12,
      going: ['tomas', 'rosa', 'maribel', 'graciela', 'ramon', 'yesenia']
    }),
    discussion('S4', 'graciela', '¿Alguien sabe de ayuda para pagar la renta?', 'Nos subieron la renta y no sé por dónde empezar. ¿Alguien ha pedido ayuda y le contestaron?', ['del-paso'], [-4, 20, 0], {
      topics: ['housing'],
      commentTarget: 5,
      comments: [
        { by: 'kai', at: [-3, 9, 0], text: 'Sí. Trae el contrato y un recibo. Te ayudo con la solicitud en español o en inglés, the rental assistance office on Power Inn is the one that actually answers. Puedo verte esta semana.' }
      ]
    }),
    resource('S5', 'ramon', 'Árbol de limones, pueden tomar lo que necesiten', 'Limones en Grand y Altos. Están buenos. Toquen la puerta, o pasen si la reja está abierta. Dejen unos cuantos.', ['del-paso', 'gleaning'], 'altos', [-6, 8, 0], {
      topics: ['gleaning']
    }),
    offer('X1', 'pa', 'Cucumbers and long beans from my garden', 'More cucumbers and long beans than we can eat. A box on the steps Saturday morning.', ['del-paso'], 'farm', [-9, 8, 0], {
      topics: ['food'],
      image: 'cucumbers',
      fulfilled: { at: [-7, 12, 0], by: ['marcus', 'mai', 'graciela', 'farid'] }
    }),
    req('X2', 'jordan', 'Ride to the airport Friday at 5am', 'Flight Friday, need to be at the airport by 5am. I can give gas money and I am a quiet passenger.', 'midtown', 'jstreet', [-2, 21, 0], {
      topics: ['rides'],
      image: 'airport',
      comments: [
        { by: 'tomas', at: [-1, 7, 0], text: 'I am up anyway. I will take you if you are at 21st and J at 4:20.' }
      ]
    }),

    // Grant submissions. Tokens are applied separately to the nine funders who already voted.
    submission('G1', 'ellie', 'New compressor + shade cover for the Oak Park fridge', 'The compressor is loud and tired, and the porch bakes in the afternoon. A new compressor and a shade cover keep food safe in September.', 650, [-18, 11, 0]),
    submission('G5', 'walt', 'Cots and blankets for the winter warming hub', 'Twelve cots and blankets for the hall we open when the power fails. They stay in the Ready Sac closet the rest of the year.', 900, [-16, 14, 0]),
    submission('G2', 'jorge', 'Bilingual storm-prep flyers + door-knocking', 'Flyers in Spanish and English, and a Saturday of door-knocking in Oak Park and Del Paso before the first big storm.', 400, [-15, 10, 0]),
    submission('G6', 'farid', 'Interpreter stipends (Dari, Spanish, Hmong) for school and clinic visits', 'Small stipends so neighbors who interpret at schools and clinics are not doing it unpaid every week.', 750, [-14, 16, 0]),
    submission('G3', 'pa', 'Del Paso seed library', 'Jars, labels, and a shelf at the farm for seeds people already save. Anyone can take a packet and bring some back.', 350, [-13, 9, 0]),
    submission('G4', 'dev', 'Bike trailer for hauling gleaned fruit', 'A trailer behind a bike moves lemons without waiting on a truck. It would live with the gleaning crew.', 450, [-12, 15, 0]),
    submission('G7', 'sam', 'Kids\' bike repair camp', 'Two Saturdays where kids learn to fix a flat and leave with a working bike. Parts are the budget.', 300, [-10, 13, 0])
  ]
}

/**
 * Chat rooms. Oak Park ends with the six lines visitors see.
 * @returns {object[]}
 */
function chats () {
  return [
    {
      room: 'parent',
      messages: [
        { by: 'rosa', at: [-45, 10, 30], text: 'This is the neighborhood thread. Say hello when you arrive.' },
        { by: 'hannah', at: [-30, 9, 0], text: 'Gleaning crew is meeting at Bea\'s next week. Details are in events.' },
        { by: 'marcus', at: [-14, 18, 0], text: 'Farm stand Saturday. Kale starts are free until they are gone.' },
        { by: 'walt', at: [-6, 7, 0], text: 'Atmospheric river is on the weekend maps. Sandbags at the farm.' },
        { by: 'kai', at: [-4, 12, 0], text: 'If your rent notice came this month, look at the P Street thread.' },
        { by: 'tomas', at: [-2, 8, 0], text: 'Who has a truck Saturday besides me? Couch on P, third floor.' },
        { by: 'lin', at: [-2, 9, 0], text: 'I can drive elders that morning if the couch is covered.' },
        { by: 'grace', at: [-1, 14, 0], text: 'Friday bread is two loaves heavier than usual. Come by Capitol.' },
        { by: 'priya', at: [-1, 18, 0], text: 'N95s are in a box at my porch. Take a few before the next smoke day.' },
        { by: 'rosa', at: [0, 8, 0], text: 'Join requests: if you asked to join and have not heard, we are reading them today.' },
        { by: 'ellie', at: [0, 9, 30], text: 'Canning class still has four open seats.' },
        { by: 'hannah', minutesAgo: 50, text: 'Loquats on 22nd are dropping. Bags in the gleaning thread.' }
      ]
    },
    {
      room: 'oak-park',
      messages: [
        { by: 'rosa', at: [-6, 9, 0], text: 'Fridge was empty at dawn and full by noon. That is a good day.' },
        { by: 'maribel', at: [-5, 20, 0], text: '¿Alguien tiene una cuna pequeña? Publiqué un pedido.' },
        { by: 'jorge', at: [-4, 18, 0], text: 'Tool shed is open tonight until 8. Drill bits are restocked.' },
        { by: 'nia', at: [-3, 11, 0], text: 'Meal train for a family on 35th starts Thursday. Soup is covered, we need two dinners.' },
        { by: 'ellie', at: [-2, 16, 0], text: 'Marmalade is gone. Thank you for taking it to people who will actually eat it.' },
        { by: 'luz', at: [-2, 10, 0], text: 'Clase de inglés este sábado, misma esquina de siempre.' },
        { by: 'imani', at: [-1, 8, 0], text: 'I can do Tuesday dialysis rides. I put it on Rosa\'s request.' },
        { by: 'andre', at: [-1, 19, 0], text: 'Does anyone have a folding table that is not already promised to the potluck?' },
        { by: 'rosa', minutesAgo: 110, text: 'Fridge is FULL of Hannah\'s lemons, come grab some 🍋' },
        { by: 'ellie', minutesAgo: 90, text: 'Taking 2 bags for canning class, thank you!' },
        { by: 'nia', minutesAgo: 70, text: 'Anyone have a pack-n-play? Posted a request, client is due next week.' },
        { by: 'jorge', minutesAgo: 50, text: 'I think there is one in the shed, checking tonight.' },
        { by: 'rosa', minutesAgo: 35, text: 'can you bring the folding tables to the potluck Sunday?', mention: 'tibet' },
        { by: 'jorge', minutesAgo: 20, text: 'Found it. Nia I will drop it by tomorrow 👍' }
      ]
    },
    {
      room: 'midtown',
      messages: [
        { by: 'grace', at: [-10, 13, 0], text: 'Bread Friday is on. Two to four, Capitol side.' },
        { by: 'dev', at: [-8, 11, 0], text: 'Fix-it clinic needs one more person who is not afraid of toasters.' },
        { by: 'sam', at: [-5, 16, 30], text: 'If anyone is already going toward Rancho Thursday morning, I posted a ride request.' },
        { by: 'kai', at: [-4, 19, 0], text: 'P Street notices went up. Thread is in discussions if you want the meeting.' },
        { by: 'maya', at: [-3, 12, 0], text: 'I can help carry the couch if it is after 10.' },
        { by: 'jordan', at: [-2, 21, 10], text: 'Early airport ride Friday if anyone is a morning person.' },
        { by: 'tibet', at: [-1, 15, 0], text: 'Ladder is back in the garage. Fruit picker too. Borrow either.' },
        { by: 'grace', at: [-1, 14, 20], text: 'Loaf set aside for Farid\'s family. Tomás, it can ride with you.' }
      ]
    },
    {
      room: 'del-paso',
      messages: [
        { by: 'marcus', at: [-14, 9, 0], text: 'Starts are on the table. Take a flat, leave the tray.' },
        { by: 'farid', at: [-8, 17, 0], text: 'The bunks are in the kids\' room. They made their beds before I finished tightening the frame.', image: 'bunk' },
        { by: 'tomas', at: [-8, 18, 0], text: 'Easiest haul of the month. Happy to do the table next if Jorge needs a truck.' },
        { by: 'graciela', at: [-4, 20, 30], text: '¿Alguien ha pedido ayuda para la renta? Dejé una pregunta en discusiones.' },
        { by: 'pa', at: [-3, 8, 0], text: 'Cucumbers on the steps until noon.' },
        { by: 'ramon', at: [-2, 9, 0], text: 'Los limones de Grand están listos. Pasen.' },
        { by: 'walt', at: [-1, 10, 0], text: 'Sandbag pile is marked with an orange cone. Bring a shovel.' },
        { by: 'aisha', minutesAgo: 200, text: 'Faucet request is up. If you are nearby today I am home after 2.' }
      ]
    },
    {
      room: 'gleaning',
      messages: [
        { by: 'hannah', at: [-20, 9, 0], text: 'Bea said yes to a morning. We need a tall ladder.' },
        { by: 'tibet', at: [-19, 8, 0], text: 'Ladder and the fruit picker are yours. I will drop them the night before.' },
        { by: 'ellie', at: [-12, 15, 0], text: 'I will take the bruised ones for marmalade. Leave the pretty ones for the fridge.' },
        { by: 'bea', at: [-11, 18, 30], text: 'You all left the yard cleaner than you found it. That is new.' },
        { by: 'hannah', at: [-6, 10, 0], text: 'Figs in the Oak Park alley are close. Another week.' },
        { by: 'marcus', at: [-4, 9, 0], text: 'Pomegranates are splitting. Ask at the house, then pick the sidewalk side.' },
        { by: 'grace', at: [-2, 11, 0], text: 'I can take a crate to the fridge Friday on my way back from the bakery.' },
        { by: 'hannah', at: [-1, 9, 30], text: 'Persimmons need another week. Loquats do not.' }
      ]
    },
    {
      room: 'ready',
      messages: [
        { by: 'walt', at: [-6, 7, 30], text: 'Forecast is getting serious. Check the sandbag post before the weekend.' },
        { by: 'lin', at: [-4, 9, 30], text: 'Still short two drivers for elder checks. The request is up.' },
        { by: 'priya', at: [-3, 18, 0], text: 'Smoke class is on the calendar. Tell elders who will not come to a website.' },
        { by: 'rosa', at: [-2, 12, 0], text: 'Fundraiser vote is open. Read the three options before you pick.' },
        { by: 'marcus', at: [-1, 8, 30], text: 'Farm generator is the backup. It is loud and it works.' },
        { by: 'walt', minutesAgo: 80, text: 'Radio net check-in tonight at 7. If you have a handheld, say your call sign or just hello.' }
      ]
    },
    {
      room: 'grants',
      messages: [
        { by: 'rosa', at: [-20, 11, 0], text: 'Submissions are in. Read the budgets before you move tokens.' },
        { by: 'kai', at: [-10, 14, 0], text: 'Farid\'s interpreter proposal is the one I keep coming back to.' },
        { by: 'lin', at: [-4, 16, 0], text: 'The cots and the purifiers are both winter. Hard to split them in my head.' },
        { by: 'walt', at: [-2, 9, 0], text: 'Voting is open. You can see the totals move, so do not all wait until the last hour.' },
        { by: 'ellie', at: [-1, 11, 0], text: 'I did not put tokens on the fridge. Someone else should decide that one.' },
        { by: 'hannah', at: [-1, 15, 0], text: 'Tibet, your hundred are still sitting there when you want them.' }
      ]
    },
    {
      room: 'welcome',
      messages: [
        { by: 'maya', at: [-2, 10, 0], text: 'Just joined. I am in Midtown and I love the loquat trees nobody admits to owning.' },
        { by: 'yesenia', at: [-1, 19, 0], text: 'Acabo de entrar. Vivo en Del Paso y puedo cuidar niños entre semana.' },
        { by: 'brian', at: [-1, 12, 0], text: 'West Sac here. I have a truck on Sundays.' },
        { by: 'fatima', minutesAgo: 400, text: 'Joined from Elk Grove. I can help with clinic paperwork.' },
        { by: 'chue', minutesAgo: 180, text: 'Just joined. I can translate Hmong if you tell me the day.' }
      ]
    }
  ]
}

/**
 * Direct messages. The three threads marked unread are unread for Tibet.
 * @returns {object[]}
 */
function threads () {
  return [
    {
      key: 'ladder',
      people: ['tibet', 'hannah'],
      unread: true,
      messages: [
        { by: 'hannah', at: [-19, 8, 0], text: 'Can I borrow the 24 ft ladder and the fruit picker for Bea\'s trees? Thursday morning.' },
        { by: 'tibet', at: [-19, 8, 20], text: 'Yes. I will leave both on the porch Wednesday night.' },
        { by: 'hannah', at: [-18, 21, 0], text: 'Got them. I will bring a friend to carry the ladder, it is a long one.' },
        { by: 'tibet', at: [-18, 21, 15], text: 'The picker is in the blue bag. Do not stand on the top rung, Bea will tell you the same thing.' },
        { by: 'hannah', at: [-12, 12, 0], text: '140 pounds. Your ladder did the high persimmons.' },
        { by: 'tibet', at: [-12, 12, 40], text: 'Good. Leave it whenever.' },
        { by: 'hannah', at: [-1, 16, 10], text: 'Ladder back on your porch, thank you!' }
      ]
    },
    {
      key: 'proposal',
      people: ['tibet', 'rosa', 'lin'],
      unread: true,
      messages: [
        { by: 'rosa', at: [-6, 12, 30], text: 'I posted the $2,400 question. Three options. Tell me if I missed one before votes pile up.' },
        { by: 'lin', at: [-6, 13, 0], text: 'The radios are Walt\'s, the purifiers are what the elders actually ask me for.' },
        { by: 'tibet', at: [-6, 14, 0], text: 'The tool library option is Jorge\'s tiller and a few things we keep borrowing from his garage.' },
        { by: 'rosa', at: [-5, 9, 0], text: 'I am leaving it at three. More options and nobody finishes.' },
        { by: 'lin', at: [-3, 11, 0], text: 'Can we add warming-hub supplies if the cots do not win the flow fund?' },
        { by: 'rosa', at: [-3, 11, 40], text: 'If I add it now I have to reset votes. I do not want to do that to people.' },
        { by: 'tibet', at: [-2, 8, 0], text: 'Agree. Mention it in the thread so people know the cots exist as the other pot of money.' },
        { by: 'lin', at: [-1, 17, 0], text: 'I will. And I want the purifiers. I am not pretending otherwise.' },
        { by: 'rosa', at: [-1, 18, 0], text: 'Tibet, you still have not voted. People at the table will watch the bar move if you do it live.' }
      ]
    },
    {
      key: 'shed',
      people: ['tibet', 'sam'],
      unread: true,
      messages: [
        { by: 'sam', at: [-2, 18, 30], text: 'Dev said his drill is at the shed. Is the shed open Saturday?' },
        { by: 'tibet', at: [-2, 19, 0], text: 'Jorge usually opens it by 10. I can meet you there if the door is locked.' },
        { by: 'sam', minutesAgo: 45, text: 'Is the tool shed open Saturday?' }
      ]
    },
    {
      key: 'fans',
      people: ['tibet', 'walt'],
      messages: [
        { by: 'walt', at: [-40, 11, 0], text: 'Lin needs fans. I have six. Can you bring two more and help deliver?' },
        { by: 'tibet', at: [-40, 11, 20], text: 'Yes. I will be at your garage at 4.' },
        { by: 'walt', at: [-40, 16, 0], text: 'Loaded. Land Park first, then the apartments off Sutterville.' },
        { by: 'tibet', at: [-38, 18, 0], text: 'All eight are in windows. Lin has the list of who still needs one.' }
      ]
    },
    {
      key: 'carseat',
      people: ['nia', 'aisha'],
      messages: [
        { by: 'nia', at: [-9, 9, 50], text: 'The Graco is in my closet. It expires next year, never in a crash. Want it?' },
        { by: 'aisha', at: [-9, 10, 5], text: 'Yes. I am off at 1. I can come to you or you can come here, whichever is easier.' },
        { by: 'nia', at: [-9, 10, 12], text: 'I will come to you. Send the address here, not on the post.' },
        { by: 'aisha', at: [-9, 10, 18], text: 'Apartment 2, the building with the blue door just off Rio Linda. I will meet you in the lot so you do not have to find the stairs.' },
        { by: 'nia', at: [-9, 13, 40], text: 'In the lot. I see you.' },
        { by: 'aisha', at: [-9, 14, 10], text: 'He sat in it in the driveway and did not complain. That is a review. Thank you.' }
      ]
    },
    {
      key: 'glean-date',
      people: ['hannah', 'bea'],
      messages: [
        { by: 'hannah', at: [-20, 9, 0], text: 'Bea, your lemon post is the best thing on the map. Can we bring a small crew one morning?' },
        { by: 'bea', at: [-20, 10, 0], text: 'Mornings, not afternoons. I nap. And leave me a dozen lemons and a few persimmons.' },
        { by: 'hannah', at: [-19, 8, 0], text: 'Thursday morning, 9 to 11. We will stay in the yard, not the house.' },
        { by: 'bea', at: [-19, 8, 30], text: 'The side gate sticks. Lift it. And do not let anyone stand on the top of that ladder.' },
        { by: 'hannah', at: [-12, 12, 0], text: 'Dozen lemons and a bowl of persimmons are on your kitchen chair. The rest is already at the fridge.' }
      ]
    },
    {
      key: 'farid-kai',
      people: ['kai', 'farid'],
      messages: [
        { by: 'kai', at: [-14, 10, 0], text: 'I wrote a project so people can see the whole list, not five separate surprises. Want to read it before it goes up?' },
        { by: 'farid', at: [-14, 10, 30], text: 'Yes. Please say we can help too. I do not want it to sound like we only receive.' },
        { by: 'kai', at: [-14, 11, 0], text: 'Beds, a table, coats, and a Dari speaker for Thursday. I will add that you fix cars.' },
        { by: 'farid', at: [-14, 11, 20], text: 'The lease says we cannot paint. Is that a problem for the table? It is only furniture.' },
        { by: 'kai', at: [-14, 12, 0], text: 'Furniture is fine. Do not drill into the walls for the beds if the lease says so. Jorge will know.' },
        { by: 'farid', at: [-8, 17, 30], text: 'The bunks are up. The kids are arguing about the top bed, which means it worked.' },
        { by: 'kai', at: [-5, 16, 0], text: 'Jorge is bringing the table tomorrow. I will be there to carry.' },
        { by: 'farid', at: [-3, 18, 30], text: 'I posted that I can do brakes. It felt right after the table arrived.' }
      ]
    },
    {
      key: 'ride',
      people: ['tomas', 'sam'],
      messages: [
        { by: 'tomas', at: [-5, 18, 20], text: 'I can take you. 21st and J at 8. Interview clothes are fine in the truck.' },
        { by: 'sam', at: [-5, 18, 40], text: 'I will be on the corner. Thank you. I have been rehearsing answers out loud.' },
        { by: 'tomas', at: [-3, 8, 5], text: 'Outside. Take your time, we are early.' },
        { by: 'sam', at: [-3, 12, 40], text: 'Good luck was the right thing to say. I got it.' }
      ]
    }
  ]
}

/**
 * Five onboarding steps, in order.
 * @returns {object[]}
 */
function trackActions () {
  return [
    {
      key: 'step1',
      title: 'Read and accept our agreements',
      details: 'Four agreements. Solidarity, no selling, privacy, and closing the loop. Accept them here.',
      completion: 'button',
      settings: { instructions: 'Mark this step complete after you have read the agreements.' }
    },
    {
      key: 'step2',
      title: 'Say hi in #general: where you live and one thing you love about it',
      details: 'One or two sentences. Where you are, and one thing you love about that place.',
      completion: 'comment',
      settings: { instructions: 'Comment here with where you live and one thing you love about it.' }
    },
    {
      key: 'step3',
      title: 'Pick your neighborhood space',
      details: 'Join the space for the neighborhood you live in or near. You can change it later.',
      completion: 'selectOne',
      settings: {
        instructions: 'Choose one.',
        options: ['Oak Park', 'Midtown & Downtown', 'Land Park & Curtis Park', 'Del Paso Heights & North Sac', 'None yet']
      }
    },
    {
      key: 'step4',
      title: 'Share one thing you could offer neighbors',
      details: 'A skill, a tool, a ride, a language, an hour. Small is fine.',
      completion: 'text',
      settings: { instructions: 'Write one thing you could offer.' }
    },
    {
      key: 'step5',
      title: 'Map a fruit tree, fridge, or pantry near you',
      details: 'Add a resource pin, or confirm you know how. The map is how people find the lemons.',
      completion: 'button',
      settings: { instructions: 'Mark this complete after you map a resource, or open Create Resource and look at the form.' }
    }
  ]
}

/**
 * Nine funders already allocated these tokens. Columns are G1 G5 G2 G6 G3 G4 G7.
 * Ellie does not fund her own fridge proposal. Walt does not fund his own cots.
 * Each row sums to 100. Columns sum to 172, 155, 145, 138, 121, 110, 59.
 */
const ALLOCATIONS = {
  rosa: [40, 20, 10, 10, 10, 10, 0],
  kai: [20, 35, 15, 10, 10, 10, 0],
  lin: [20, 20, 20, 20, 10, 10, 0],
  marcus: [20, 20, 20, 15, 15, 10, 0],
  hannah: [20, 20, 20, 20, 10, 5, 5],
  walt: [35, 0, 20, 20, 15, 5, 5],
  priya: [12, 15, 20, 18, 15, 10, 10],
  ellie: [0, 20, 10, 15, 20, 25, 10],
  tomas: [5, 5, 10, 10, 16, 25, 29]
}

const GRANT_KEYS = ['G1', 'G5', 'G2', 'G6', 'G3', 'G4', 'G7']

function req (key, by, title, details, space, placeKey, at, extra = {}) {
  return row(key, 'request', by, title, details, [space], placeKey, at, extra)
}

function offer (key, by, title, details, spaces, placeKey, at, extra = {}) {
  return row(key, 'offer', by, title, details, spaces, placeKey, at, extra)
}

function resource (key, by, title, details, spaces, placeKey, at, extra = {}) {
  return row(key, 'resource', by, title, details, spaces, placeKey, at, extra)
}

function discussion (key, by, title, details, spaces, at, extra = {}) {
  return row(key, 'discussion', by, title, details, spaces, null, at, extra)
}

function project (key, by, title, details, spaces, at, extra = {}) {
  return row(key, 'project', by, title, details, spaces, 'marysville', at, extra)
}

/**
 * @returns {object}
 */
function event (key, by, title, details, spaces, placeKey, posted, start, end, extra = {}) {
  return row(key, 'event', by, title, details, spaces, placeKey, posted, { ...extra, start, end })
}

/**
 * @returns {object}
 */
function proposal (key, by, title, details, spaces, at, extra = {}) {
  return row(key, 'proposal', by, title, details, spaces, null, at, extra)
}

/**
 * @returns {object}
 */
function submission (key, by, title, details, budget, at) {
  return row(key, 'submission', by, title, details, ['grants'], null, at, {
    topics: [],
    budget,
    reactions: 3
  })
}

/**
 * @returns {object}
 */
function row (key, type, by, title, details, spaces, placeKey, at, extra) {
  const located = placeKey ? PLACES[placeKey] : null
  return {
    key,
    type,
    by,
    title,
    details,
    spaces,
    place: located ? located[0] : null,
    lat: located ? located[1] : null,
    lng: located ? located[2] : null,
    at,
    topics: extra.topics || [],
    ...extra
  }
}

module.exports = {
  posts,
  chats,
  threads,
  trackActions,
  ALLOCATIONS,
  GRANT_KEYS,
  place
}
