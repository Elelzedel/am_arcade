// The diorama's footprint, in metres. The street corner is the whole world:
// the arcade sits in the middle of a paved block, two roads meet at the
// front-right corner, a narrow alley runs behind, and then the ground ends.

export const PLINTH = { minX: -7.0, maxX: 7.0, minZ: -6.4, maxZ: 6.2, depth: 1.35 };
export const WALK = { minX: -6.6, maxX: 4.6, minZ: -6.0, maxZ: 4.0, top: 0.14 };
export const ROOM = {
    minX: -4.8, maxX: 2.8, minZ: -3.8, maxZ: 1.8,
    floor: 0.24, wallH: 3.2, wallT: 0.22,
    kneeH: 0.72,                 // walls facing the viewer fold down to here
    door: [-0.7, 0.6],           // gap in the front wall (x range)
    doorH: 2.35,
};
