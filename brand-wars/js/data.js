/* Brand Wars — game data: brands, titles, move sets and the default roster.
   Every wrestler here is an original character. Edit them in-game with the
   Superstar Editor, or change this file directly. */
(function () {
  const BW = (window.BW = window.BW || {});

  BW.BRANDS = {
    ignite: {
      id: 'ignite', name: 'IGNITE', night: 'Monday Night', color: '#ff4d1f', color2: '#ffb21e',
      rope: '#e8361c', mat: '#d9dde6', tagline: 'Where the fire starts',
    },
    uprising: {
      id: 'uprising', name: 'UPRISING', night: 'Friday Night', color: '#2f7cff', color2: '#7fe3ff',
      rope: '#2a6cf0', mat: '#d6dde9', tagline: 'Rise or get left behind',
    },
    exhibition: {
      id: 'exhibition', name: 'BRAND WARS', night: 'Exhibition', color: '#e8b83a', color2: '#ffffff',
      rope: '#f2f2f2', mat: '#dcdde2', tagline: '',
    },
  };

  BW.TITLES = [
    { key: 'world', name: 'World Championship', short: 'World', kind: 'singles', gender: 'm', prestige: 10 },
    { key: 'national', name: 'National Championship', short: 'National', kind: 'singles', gender: 'm', prestige: 6 },
    { key: 'tag', name: 'Tag Team Championship', short: 'Tag', kind: 'tag', gender: 'm', prestige: 5 },
    { key: 'women', name: "Women's Championship", short: "Women's", kind: 'singles', gender: 'f', prestige: 6 },
  ];

  BW.PPVS = ['Collision Course', 'Night of Iron', 'Breaking Point', 'Summer Siege', 'Fever Pitch',
    'Steel Reign', 'Point of Impact', 'Final Bell', 'No Way Back', 'Crown Jewel Rumble', 'Iron Will', 'Thunderdome'];

  BW.MATCH_TYPES = {
    singles: { label: 'Singles', size: 2, teams: false },
    tag: { label: 'Tag Team', size: 4, teams: true },
    triple: { label: 'Triple Threat', size: 3, teams: false },
    fatal4: { label: 'Fatal 4-Way', size: 4, teams: false },
    submission: { label: 'Submission', size: 2, teams: false },
    promo: { label: 'Promo', size: 1, teams: false },
  };

  /* Animation templates every move refers to (see engine.js):
     grapple:  slam suplex powerbomb driver ddt toss stagger chokeslam cutter press german neckbreaker backbreaker bearhug
     strike:   superkick roundhouse knee
     running:  clothesline tackle spear dropkick lariat
     dive:     splash elbow moonsault headbutt legdrop
     ground:   stomp elbowdrop kneedrop gpunch
     sub:      sub_leg sub_neck sub_arm sub_back */
  const m = (name, anim, dmg, part) => ({ name, anim, dmg, part: part || 'body' });

  BW.MOVESETS = {
    powerhouse: {
      strike: 'Forearm Smash', kick: 'Big Boot',
      quick: { neutral: m('Scoop Slam', 'slam', 8), fwd: m('Headbutt', 'stagger', 5, 'head'), back: m('Belly-to-Belly', 'suplex', 9), side: m('Backbreaker', 'backbreaker', 9) },
      strong: { neutral: m('Powerbomb', 'powerbomb', 14), fwd: m('Military Press Slam', 'press', 15), back: m('Fallaway Slam', 'suplex', 12), side: m('Spinebuster', 'slam', 12) },
      rear: m('German Suplex', 'german', 11, 'head'), reversal: m('Sidewalk Slam', 'slam', 8),
      run: m('Shoulder Tackle', 'tackle', 7), rebound: m('Clothesline', 'clothesline', 8, 'head'), catch: m('Powerslam', 'slam', 11),
      ground: { head: m('Elbow Drop', 'elbowdrop', 6, 'head'), legs: m('Knee Drop', 'kneedrop', 6, 'legs') },
      sub: m('Bear Hug', 'bearhug', 0, 'body'), groundSub: m('Camel Clutch', 'sub_back', 0, 'body'), top: m('Diving Shoulder', 'headbutt', 10),
    },
    technician: {
      strike: 'European Uppercut', kick: 'Dropkick',
      quick: { neutral: m('Snap Suplex', 'suplex', 8), fwd: m('Arm Drag', 'toss', 6, 'arms'), back: m('Northern Lights Suplex', 'suplex', 9), side: m('Russian Leg Sweep', 'neckbreaker', 7) },
      strong: { neutral: m('Brainbuster', 'driver', 13, 'head'), fwd: m('Double-Arm Suplex', 'suplex', 12), back: m('Tiger Driver', 'powerbomb', 13), side: m('Shoulder Breaker', 'backbreaker', 11, 'arms') },
      rear: m('Bridging German Suplex', 'german', 12, 'head'), reversal: m('Small Package Drop', 'toss', 7),
      run: m('Running Dropkick', 'dropkick', 7, 'head'), rebound: m('Flying Forearm', 'clothesline', 8, 'head'), catch: m('Belly-to-Back Suplex', 'suplex', 10),
      ground: { head: m('Knee to the Skull', 'kneedrop', 6, 'head'), legs: m('Leg Stomp', 'stomp', 5, 'legs') },
      sub: m('Abdominal Stretch', 'bearhug', 0, 'body'), groundSub: m('Figure-Four Leglock', 'sub_leg', 0, 'legs'), top: m('Diving Elbow', 'elbow', 10),
    },
    highflyer: {
      strike: 'Chop', kick: 'Enzuigiri',
      quick: { neutral: m('Hurricanrana', 'toss', 8, 'head'), fwd: m('Arm Drag', 'toss', 6, 'arms'), back: m('Tornado DDT', 'ddt', 9, 'head'), side: m('Jawbreaker', 'stagger', 5, 'head') },
      strong: { neutral: m('Springboard DDT', 'ddt', 12, 'head'), fwd: m('Spinning Facebuster', 'cutter', 12, 'head'), back: m('Victory Roll Driver', 'driver', 12, 'head'), side: m('Headscissors Takedown', 'toss', 11, 'head') },
      rear: m('Reverse Rana', 'german', 12, 'head'), reversal: m('Sunset Flip', 'toss', 7),
      run: m('Running Crossbody', 'dropkick', 7), rebound: m('Springboard Forearm', 'clothesline', 8, 'head'), catch: m('Satellite DDT', 'ddt', 10, 'head'),
      ground: { head: m('Standing Moonsault', 'elbowdrop', 7, 'body'), legs: m('Double Stomp', 'stomp', 6, 'body') },
      sub: m('Octopus Stretch', 'bearhug', 0, 'body'), groundSub: m('Crossface', 'sub_neck', 0, 'head'), top: m('Diving Crossbody', 'splash', 11),
    },
    brawler: {
      strike: 'Haymaker', kick: 'Gut Kick',
      quick: { neutral: m('Headbutt', 'stagger', 5, 'head'), fwd: m('DDT', 'ddt', 9, 'head'), back: m('Side Russian Leg Sweep', 'neckbreaker', 8), side: m('Knee Lift', 'stagger', 6, 'head') },
      strong: { neutral: m('Piledriver', 'driver', 14, 'head'), fwd: m('Swinging Neckbreaker', 'neckbreaker', 11, 'head'), back: m('Sit-out Powerbomb', 'powerbomb', 13), side: m('Exploder Suplex', 'suplex', 12) },
      rear: m('Reverse DDT', 'cutter', 10, 'head'), reversal: m('Low Blow DDT', 'ddt', 8, 'head'),
      run: m('Running Lariat', 'clothesline', 8, 'head'), rebound: m('Clothesline From Hell', 'clothesline', 9, 'head'), catch: m('Spinebuster', 'slam', 11),
      ground: { head: m('Ground and Pound', 'gpunch', 7, 'head'), legs: m('Stomp', 'stomp', 5, 'legs') },
      sub: m('Sleeper Hold', 'bearhug', 0, 'head'), groundSub: m('Chinlock', 'sub_neck', 0, 'head'), top: m('Diving Elbow', 'elbow', 10),
    },
    giant: {
      strike: 'Overhand Chop', kick: 'Big Boot',
      quick: { neutral: m('Body Slam', 'slam', 9), fwd: m('Headbutt', 'stagger', 6, 'head'), back: m('Side Slam', 'slam', 9), side: m('Choke Toss', 'toss', 8, 'head') },
      strong: { neutral: m('Chokeslam', 'chokeslam', 15, 'head'), fwd: m('Gorilla Press', 'press', 15), back: m('Last Ride Bomb', 'powerbomb', 15), side: m('Tree Slam', 'slam', 13) },
      rear: m('Rear Bearhug Slam', 'german', 11), reversal: m('Choke Throw', 'toss', 8, 'head'),
      run: m('Big Splash Tackle', 'tackle', 9), rebound: m('Big Boot', 'clothesline', 10, 'head'), catch: m('Sidewalk Slam', 'slam', 12),
      ground: { head: m('Leg Drop', 'kneedrop', 8, 'head'), legs: m('Big Stomp', 'stomp', 7, 'legs') },
      sub: m('Bear Hug', 'bearhug', 0, 'body'), groundSub: m('Nerve Hold', 'sub_neck', 0, 'head'), top: m('Big Splash', 'splash', 12),
    },
    striker: {
      strike: 'Jab Combo', kick: 'Roundhouse Kick',
      quick: { neutral: m('Knee Strike', 'stagger', 6, 'head'), fwd: m('Hip Toss', 'toss', 6), back: m('Snap DDT', 'ddt', 9, 'head'), side: m('Leg Sweep', 'neckbreaker', 7, 'legs') },
      strong: { neutral: m('Kitchen-Sink Knee', 'stagger', 11, 'body'), fwd: m('Capture Suplex', 'suplex', 12), back: m('Fisherman Buster', 'driver', 12, 'head'), side: m('Dragon Suplex', 'german', 12, 'head') },
      rear: m('Back Suplex', 'suplex', 10), reversal: m('Spinning Heel Kick', 'stagger', 7, 'head'),
      run: m('Flying Knee', 'tackle', 8, 'head'), rebound: m('Spinning Back Kick', 'clothesline', 9, 'head'), catch: m('Rolling Suplex', 'suplex', 10),
      ground: { head: m('Soccer Kick', 'stomp', 8, 'head'), legs: m('Low Kick', 'stomp', 6, 'legs') },
      sub: m('Standing Guillotine', 'bearhug', 0, 'head'), groundSub: m('Kimura Lock', 'sub_arm', 0, 'arms'), top: m('Diving Knee', 'headbutt', 11, 'head'),
    },
  };

  BW.STYLE_LABELS = {
    powerhouse: 'Powerhouse', technician: 'Technician', highflyer: 'High Flyer',
    brawler: 'Brawler', giant: 'Giant', striker: 'Striker',
  };

  BW.STYLE_STATS = {
    powerhouse: { speed: 0.95, power: 1.15, agility: 0.85, skill: 0.95 },
    technician: { speed: 1.0, power: 1.0, agility: 1.0, skill: 1.2 },
    highflyer: { speed: 1.15, power: 0.85, agility: 1.25, skill: 1.0 },
    brawler: { speed: 1.0, power: 1.05, agility: 0.9, skill: 0.95 },
    giant: { speed: 0.82, power: 1.3, agility: 0.7, skill: 0.9 },
    striker: { speed: 1.08, power: 1.0, agility: 1.05, skill: 1.05 },
  };

  BW.FINISHER_ANIMS = [
    'driver', 'powerbomb', 'chokeslam', 'ddt', 'cutter', 'slam', 'suplex', 'german', 'press', 'neckbreaker', 'backbreaker',
    'superkick', 'roundhouse', 'knee', 'spear', 'lariat', 'splash', 'elbow', 'moonsault', 'legdrop', 'headbutt',
    'sub_leg', 'sub_neck', 'sub_arm', 'sub_back',
  ];

  const W = (o) => Object.assign({
    gender: 'm', height: 1, build: 1, hair: 'short', top: 'none', legs: 'trunks', team: null, mic: 60,
  }, o);

  BW.DEFAULT_ROSTER = [
    W({ id: 'vale', name: 'Marcus Vale', nick: 'The Ace', style: 'powerhouse', align: 'face', ovr: 92, pop: 93, mic: 88, salary: 140, height: 1.04, build: 1.12, skin: '#c48a5a', hairColor: '#20140c', hair: 'buzz', colors: ['#1f3d99', '#e9edf5', '#11131a'], legs: 'trunks', finisher: { name: 'Vale Driver', anim: 'powerbomb' }, signature: { name: 'Ace Spinebuster', anim: 'slam' } }),
    W({ id: 'kessler', name: 'Dorian Kessler', nick: 'The Architect', style: 'technician', align: 'heel', ovr: 91, pop: 88, mic: 92, salary: 130, skin: '#e9c3a0', hairColor: '#5a3a1e', hair: 'slick', colors: ['#121212', '#c9a227', '#121212'], legs: 'tights', finisher: { name: 'Blueprint Lock', anim: 'sub_leg' }, signature: { name: 'Keystone Suplex', anim: 'german' } }),
    W({ id: 'grimm', name: 'Tobias Grimm', nick: 'The Undertow', style: 'giant', align: 'heel', ovr: 86, pop: 84, mic: 55, salary: 110, height: 1.16, build: 1.32, skin: '#ead0b4', hairColor: '#0d0d0d', hair: 'long', colors: ['#141414', '#5d1220', '#0b0b0b'], legs: 'tights', top: 'singlet', finisher: { name: 'Grimm Reckoning', anim: 'chokeslam' }, signature: { name: 'Riptide Bomb', anim: 'powerbomb' } }),
    W({ id: 'santana', name: 'Rico Santana', nick: 'El Cometa', style: 'highflyer', align: 'face', ovr: 87, pop: 86, mic: 74, salary: 95, height: 0.94, build: 0.9, skin: '#b07850', hairColor: '#1a1a1a', hair: 'mask', maskColor: '#ffd23b', colors: ['#ffd23b', '#e3262f', '#e3262f'], legs: 'tights', finisher: { name: 'Comet Splash', anim: 'moonsault' }, signature: { name: 'Cometa DDT', anim: 'ddt' } }),
    W({ id: 'holloway', name: 'Jax Holloway', nick: 'The Hammer', style: 'brawler', align: 'face', ovr: 88, pop: 90, mic: 84, salary: 115, height: 1.02, build: 1.1, skin: '#e4b48c', hairColor: '#b8b8b8', hair: 'bald', beard: '#6a4a2a', colors: ['#232323', '#d8d8d8', '#2b2b2b'], legs: 'trunks', top: 'vest', finisher: { name: 'Holloway Hammer', anim: 'driver' }, signature: { name: 'Bar-Room Lariat', anim: 'lariat' } }),
    W({ id: 'thorne', name: 'Magnus Thorne', nick: 'The Beast of Blackmoor', style: 'giant', align: 'heel', ovr: 85, pop: 80, mic: 50, salary: 95, height: 1.12, build: 1.38, skin: '#d8a982', hairColor: '#2c2016', hair: 'long', beard: '#2c2016', colors: ['#3a2a12', '#a8812e', '#1a1208'], legs: 'tights', finisher: { name: 'Thorn Bomb', anim: 'powerbomb' }, signature: { name: 'Blackmoor Slam', anim: 'slam' } }),
    W({ id: 'arashi', name: 'Kenji Arashi', nick: 'The Storm', style: 'striker', align: 'face', ovr: 88, pop: 83, mic: 62, salary: 100, height: 0.98, build: 0.98, skin: '#e3bf96', hairColor: '#0e0e0e', hair: 'short', colors: ['#f5f5f5', '#c41d2b', '#f5f5f5'], legs: 'trunks', finisher: { name: 'Storm Kick', anim: 'roundhouse' }, signature: { name: 'Thunder Knee', anim: 'knee' } }),
    W({ id: 'lazar', name: 'Victor Lazar', nick: 'The Iron Count', style: 'technician', align: 'heel', ovr: 86, pop: 76, mic: 80, salary: 85, skin: '#efd2b6', hairColor: '#2a1d14', hair: 'slick', colors: ['#5a0f1e', '#d6d6d6', '#1b1b1b'], legs: 'tights', finisher: { name: 'Lazar Clutch', anim: 'sub_neck' }, signature: { name: 'Count Driver', anim: 'driver' } }),
    W({ id: 'mulligan', name: 'Hank Mulligan', nick: 'The Tank', style: 'powerhouse', align: 'face', ovr: 82, pop: 78, mic: 70, salary: 70, height: 1.02, build: 1.28, skin: '#efc29b', hairColor: '#a3441c', hair: 'buzz', beard: '#a3441c', colors: ['#2f5a2a', '#f2c84b', '#24361f'], legs: 'singlet', top: 'singlet', team: 'The Iron Union', finisher: { name: 'Tank Buster', anim: 'spear' }, signature: { name: 'Turret Slam', anim: 'slam' } }),
    W({ id: 'bolt', name: 'Rex Bolt', nick: 'Lightning', style: 'powerhouse', align: 'face', ovr: 80, pop: 74, mic: 66, salary: 60, height: 1.0, build: 1.18, skin: '#8a5a3a', hairColor: '#111', hair: 'mohawk', colors: ['#2f5a2a', '#f2c84b', '#24361f'], legs: 'trunks', team: 'The Iron Union', finisher: { name: 'Bolt Bomb', anim: 'powerbomb' }, signature: { name: 'Shock Slam', anim: 'slam' } }),
    W({ id: 'crowe', name: 'Elijah Crowe', nick: 'The Gravedigger', style: 'brawler', align: 'heel', ovr: 81, pop: 75, mic: 78, salary: 65, height: 1.03, build: 1.08, skin: '#d9c0a8', hairColor: '#0a0a0a', hair: 'long', colors: ['#1a1a1a', '#6b6b6b', '#0e0e0e'], legs: 'tights', top: 'vest', team: 'Night Shift', finisher: { name: 'Murder of Crowes', anim: 'cutter' }, signature: { name: 'Coffin Drop', anim: 'driver' } }),
    W({ id: 'rourke', name: 'Zeke Rourke', nick: 'Mad Dog', style: 'brawler', align: 'heel', ovr: 79, pop: 70, mic: 64, salary: 55, height: 1.0, build: 1.14, skin: '#e7b58f', hairColor: '#3a2618', hair: 'mohawk', beard: '#3a2618', colors: ['#1a1a1a', '#6b6b6b', '#0e0e0e'], legs: 'tights', team: 'Night Shift', finisher: { name: 'Rourke Rampage', anim: 'lariat' }, signature: { name: 'Junkyard DDT', anim: 'ddt' } }),
    W({ id: 'spark', name: 'Danny Spark', nick: 'Live Wire', style: 'highflyer', align: 'face', ovr: 80, pop: 79, mic: 72, salary: 60, height: 0.93, build: 0.88, skin: '#f0c9a6', hairColor: '#e2b232', hair: 'spiky', colors: ['#20c4e0', '#ffffff', '#1b1b1b'], legs: 'tights', team: 'Skyline', finisher: { name: 'Live Wire', anim: 'splash' }, signature: { name: 'Short Circuit', anim: 'cutter' } }),
    W({ id: 'vega', name: 'Nico Vega', nick: 'The Daredevil', style: 'highflyer', align: 'face', ovr: 79, pop: 75, mic: 65, salary: 55, height: 0.94, build: 0.9, skin: '#c99266', hairColor: '#1b1b1b', hair: 'ponytail', colors: ['#20c4e0', '#ffffff', '#1b1b1b'], legs: 'tights', team: 'Skyline', finisher: { name: 'Vega Twist', anim: 'moonsault' }, signature: { name: 'Daredevil DDT', anim: 'ddt' } }),
    W({ id: 'pembroke', name: 'Royce Pembroke', nick: 'His Lordship', style: 'technician', align: 'heel', ovr: 80, pop: 72, mic: 90, salary: 60, skin: '#f2d6bf', hairColor: '#d9b45a', hair: 'slick', colors: ['#2a1a5e', '#d4af37', '#2a1a5e'], legs: 'trunks', team: 'Royal Treasury', finisher: { name: 'Royal Decree', anim: 'driver' }, signature: { name: 'Crown Suplex', anim: 'suplex' } }),
    W({ id: 'blaine', name: 'Carter Blaine', nick: 'The Closer', style: 'striker', align: 'heel', ovr: 78, pop: 68, mic: 82, salary: 50, height: 1.0, build: 1.0, skin: '#e8c4a2', hairColor: '#6a3e1c', hair: 'short', colors: ['#2a1a5e', '#d4af37', '#2a1a5e'], legs: 'trunks', team: 'Royal Treasury', finisher: { name: 'Final Verdict', anim: 'superkick' }, signature: { name: 'Gavel Knee', anim: 'knee' } }),
    W({ id: 'kincaid', name: 'Ozzie Kincaid', nick: 'The Veteran', style: 'technician', align: 'face', ovr: 84, pop: 82, mic: 86, salary: 80, height: 1.0, build: 1.05, skin: '#efc6a2', hairColor: '#8c8c8c', hair: 'short', beard: '#8c8c8c', colors: ['#0e5a8a', '#f2f2f2', '#0e5a8a'], legs: 'tights', finisher: { name: 'Kincaid Cutter', anim: 'cutter' }, signature: { name: 'Old School Suplex', anim: 'suplex' } }),
    W({ id: 'corsair', name: 'The Masked Corsair', nick: 'Terror of the Seas', style: 'highflyer', align: 'heel', ovr: 81, pop: 77, mic: 58, salary: 60, height: 0.95, build: 0.92, skin: '#c48a5a', hairColor: '#111', hair: 'mask', maskColor: '#141414', colors: ['#141414', '#e6e6e6', '#141414'], legs: 'tights', finisher: { name: 'Plank Walk', anim: 'legdrop' }, signature: { name: 'Broadside', anim: 'spear' } }),
    W({ id: 'moreau', name: 'Dante Moreau', nick: 'The Aristocrat of Agony', style: 'striker', align: 'heel', ovr: 83, pop: 79, mic: 84, salary: 75, height: 1.01, build: 1.0, skin: '#d8ad84', hairColor: '#1c120c', hair: 'long', colors: ['#3b0d46', '#e0c060', '#1b0a20'], legs: 'tights', finisher: { name: 'Sweet Agony', anim: 'superkick' }, signature: { name: 'Velvet DDT', anim: 'ddt' } }),
    W({ id: 'hollister', name: 'Bram Hollister', nick: 'The Gentle Giant', style: 'giant', align: 'face', ovr: 80, pop: 78, mic: 60, salary: 65, height: 1.14, build: 1.3, skin: '#f0c7a0', hairColor: '#c99b4a', hair: 'short', beard: '#c99b4a', colors: ['#7a2b14', '#f0e0c0', '#3a1a10'], legs: 'singlet', top: 'singlet', finisher: { name: 'Lumberjack Slam', anim: 'press' }, signature: { name: 'Timber Drop', anim: 'slam' } }),
    W({ id: 'stone', name: 'Malik Stone', nick: 'The Rock Slide', style: 'powerhouse', align: 'face', ovr: 84, pop: 85, mic: 89, salary: 85, height: 1.03, build: 1.15, skin: '#7a4a2e', hairColor: '#111', hair: 'bald', colors: ['#111111', '#e04a1f', '#111111'], legs: 'trunks', finisher: { name: 'Rockfall', anim: 'spear' }, signature: { name: 'Landslide', anim: 'powerbomb' } }),
    W({ id: 'strand', name: 'Torvald Strand', nick: 'The Northman', style: 'brawler', align: 'heel', ovr: 82, pop: 74, mic: 52, salary: 65, height: 1.08, build: 1.22, skin: '#f3d7c0', hairColor: '#e0c27a', hair: 'long', beard: '#d0a85a', colors: ['#2e3a42', '#a9b4bb', '#1b2226'], legs: 'tights', top: 'vest', finisher: { name: 'Ragnarok', anim: 'driver' }, signature: { name: 'Longship Lariat', anim: 'lariat' } }),
    W({ id: 'price', name: 'Leon Price', nick: 'Mr. Precision', style: 'technician', align: 'face', ovr: 79, pop: 70, mic: 68, salary: 50, skin: '#a96e48', hairColor: '#111', hair: 'short', colors: ['#0b6e4f', '#f3f3f3', '#0b6e4f'], legs: 'trunks', finisher: { name: 'Price Cut', anim: 'sub_arm' }, signature: { name: 'Precision Suplex', anim: 'german' } }),
    W({ id: 'marsh', name: 'Theo Marsh', nick: 'Swamp Thing', style: 'brawler', align: 'face', ovr: 70, pop: 58, mic: 55, salary: 25, skin: '#e7bb92', hairColor: '#5a3a1a', hair: 'spiky', colors: ['#4e6b2a', '#c8b06a', '#30401b'], legs: 'trunks', finisher: { name: 'Swamp Slam', anim: 'slam' }, signature: { name: 'Bayou Bulldog', anim: 'ddt' } }),
    W({ id: 'knox', name: 'Rhett Knox', nick: 'The Outlaw', style: 'brawler', align: 'heel', ovr: 76, pop: 66, mic: 75, salary: 40, height: 1.01, build: 1.05, skin: '#e3b088', hairColor: '#3c2414', hair: 'short', beard: '#3c2414', colors: ['#5b3a1e', '#e0d0b0', '#2b1c0e'], legs: 'tights', finisher: { name: 'Last Ride Out', anim: 'neckbreaker' }, signature: { name: 'Saloon Door', anim: 'lariat' } }),
    W({ id: 'okafor', name: 'Femi Okafor', nick: 'The Lion', style: 'striker', align: 'face', ovr: 77, pop: 69, mic: 70, salary: 45, height: 1.02, build: 1.04, skin: '#5e3a24', hairColor: '#0e0e0e', hair: 'buzz', colors: ['#e2a516', '#1b1b1b', '#e2a516'], legs: 'trunks', finisher: { name: 'Pride Kick', anim: 'roundhouse' }, signature: { name: 'Savanna Slam', anim: 'slam' } }),
    W({ id: 'rook', name: 'Vivian Rook', nick: 'The Grandmaster', gender: 'f', style: 'technician', align: 'face', ovr: 86, pop: 84, mic: 82, salary: 70, height: 0.92, build: 0.82, skin: '#f0cfb2', hairColor: '#1a1a1a', hair: 'ponytail', colors: ['#ececec', '#151515', '#151515'], legs: 'tights', top: 'crop', finisher: { name: 'Checkmate', anim: 'sub_arm' }, signature: { name: 'Castling Suplex', anim: 'german' } }),
    W({ id: 'frost', name: 'Lena Frost', nick: 'The Ice Queen', gender: 'f', style: 'striker', align: 'heel', ovr: 85, pop: 82, mic: 85, salary: 65, height: 0.93, build: 0.82, skin: '#f6dfcf', hairColor: '#e8eef5', hair: 'long', colors: ['#7fc6ff', '#ffffff', '#2c4a66'], legs: 'tights', top: 'crop', finisher: { name: 'Frostbite', anim: 'superkick' }, signature: { name: 'Whiteout DDT', anim: 'ddt' } }),
    W({ id: 'monroe', name: 'Tasha Monroe', nick: 'The Doctrine', gender: 'f', style: 'powerhouse', align: 'face', ovr: 82, pop: 79, mic: 78, salary: 55, height: 0.95, build: 0.92, skin: '#7a4a30', hairColor: '#1b1b1b', hair: 'long', colors: ['#c7192e', '#f0f0f0', '#c7192e'], legs: 'tights', top: 'crop', finisher: { name: 'Monroe Doctrine', anim: 'powerbomb' }, signature: { name: 'Executive Slam', anim: 'slam' } }),
    W({ id: 'delacroix', name: 'Ivy Delacroix', nick: 'Nightshade', gender: 'f', style: 'brawler', align: 'heel', ovr: 80, pop: 76, mic: 80, salary: 50, height: 0.92, build: 0.84, skin: '#efd0b8', hairColor: '#5c0f2a', hair: 'long', colors: ['#1c3b1e', '#9b1d4a', '#101010'], legs: 'tights', top: 'crop', finisher: { name: 'Thorned Kiss', anim: 'cutter' }, signature: { name: 'Bayou Bite', anim: 'ddt' } }),
    W({ id: 'ramirez', name: 'Kat Ramirez', nick: 'La Gata', gender: 'f', style: 'highflyer', align: 'face', ovr: 79, pop: 77, mic: 70, salary: 45, height: 0.9, build: 0.78, skin: '#c99068', hairColor: '#2a1508', hair: 'ponytail', colors: ['#ff4fa3', '#1b1b1b', '#ff4fa3'], legs: 'tights', top: 'crop', finisher: { name: 'Kat Scratch', anim: 'moonsault' }, signature: { name: 'Pounce', anim: 'splash' } }),
    W({ id: 'steel', name: 'Gemma Steel', nick: 'The Vice', gender: 'f', style: 'powerhouse', align: 'heel', ovr: 78, pop: 70, mic: 64, salary: 40, height: 0.96, build: 0.96, skin: '#f1d2b8', hairColor: '#2b2b2b', hair: 'buzz', colors: ['#3d3d3d', '#b9b9b9', '#1e1e1e'], legs: 'tights', top: 'crop', finisher: { name: 'Steel Trap', anim: 'sub_back' }, signature: { name: 'Vice Grip Slam', anim: 'chokeslam' } }),
    W({ id: 'okoye', name: 'Adaeze Okoye', nick: 'Thunderclap', gender: 'f', style: 'striker', align: 'face', ovr: 76, pop: 66, mic: 66, salary: 35, height: 0.94, build: 0.86, skin: '#4f2f1e', hairColor: '#0f0f0f', hair: 'short', colors: ['#2fbf71', '#f5f5f5', '#155c36'], legs: 'tights', top: 'crop', finisher: { name: 'Thunderclap', anim: 'knee' }, signature: { name: 'Rolling Thunder', anim: 'neckbreaker' } }),
    W({ id: 'vance', name: 'Paige Vance', nick: 'The Socialite', gender: 'f', style: 'technician', align: 'heel', ovr: 74, pop: 64, mic: 84, salary: 30, height: 0.91, build: 0.8, skin: '#f4d9c4', hairColor: '#e6c35c', hair: 'long', colors: ['#f4a6c8', '#ffffff', '#c45a8a'], legs: 'tights', top: 'crop', finisher: { name: 'Status Update', anim: 'neckbreaker' }, signature: { name: 'VIP Lock', anim: 'sub_leg' } }),
  ];

  BW.SKIN_TONES = ['#f6dfcf', '#f0cfb2', '#e8c4a2', '#e3b088', '#d8ad84', '#c99266', '#b07850', '#8a5a3a', '#7a4a2e', '#5e3a24', '#4f2f1e'];
  BW.HAIR_STYLES = ['short', 'buzz', 'bald', 'slick', 'long', 'ponytail', 'mohawk', 'spiky', 'mask'];
  BW.LEG_STYLES = ['trunks', 'tights', 'singlet'];
  BW.TOP_STYLES = ['none', 'vest', 'singlet', 'crop'];
})();
