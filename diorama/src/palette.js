// One palette for the whole diorama. Every colour in the scene comes from here,
// so the night reads as a single, deliberate mood: indigo shadows, warm
// tungsten light, and a handful of neon accents that belong to the machines.

export const P = {
    // the void the diorama floats in
    voidDeep: '#07051a',
    voidMid: '#140d33',
    voidGlow: '#2b1c5c',

    // street
    asphalt: '#262238',
    asphaltWet: '#1d1a2e',
    roadPaint: '#e9d9a6',
    sidewalk: '#4b4566',
    sidewalkSeam: '#3a3553',
    curb: '#716a8f',
    soil: '#1f1733',
    soilDark: '#150f24',
    pipe: '#3d6b7a',

    // building
    wallUpper: '#2a2a5c',
    wallLower: '#6e2a55',
    wallCap: '#d6c6ab',
    trim: '#e8b96a',
    brick: '#5a2f4a',
    floorA: '#1c1e3d',
    floorB: '#b9a78e',
    beam: '#1a1830',

    // light
    tungsten: '#ffc587',
    sodium: '#ffb46b',
    moon: '#8390ff',
    skyFill: '#5a4ea8',
    groundFill: '#3a1d3a',

    // neon accents
    pink: '#ff4fa8',
    cyan: '#48f0ff',
    amber: '#ffb347',
    mint: '#72ffbf',
    violet: '#a98bff',
    red: '#ff5b5b',
    lime: '#9dff5c',
    cream: '#fff1d6',
};

// Each machine gets a livery: a lacquer body and the neon of its trim.
export const LIVERY = {
    'tank-artillery': { body: '#3b1646', trim: '#ff4fb8', accent: '#ffd166', name: 'Tank Artillery' },
    'neon-racer': { body: '#0f2a40', trim: '#48f0ff', accent: '#ff4fa8', name: 'Neon Racer' },
    'star-swarm': { body: '#3d1020', trim: '#ff5b5b', accent: '#ffe066', name: 'Star Swarm' },
    'brick-blitz': { body: '#123424', trim: '#8dff5c', accent: '#48f0ff', name: 'Brick Blitz' },
    'neon-snake': { body: '#3b2610', trim: '#ffb347', accent: '#72ffbf', name: 'Neon Snake' },
};
