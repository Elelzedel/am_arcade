// The diorama's footprint, in metres. The street corner is the whole world:
// the arcade sits at the back-left, a pavement wraps it, and two roads meet
// at the front-right corner before the ground simply ends.

export const PLINTH = { minX: -5.5, maxX: 5.7, minZ: -4.7, maxZ: 4.7, depth: 1.35 };
export const WALK = { minX: -5.05, maxX: 3.35, minZ: -4.3, maxZ: 2.55, top: 0.14 };
export const ROOM = {
    minX: -4.4, maxX: 0.9, minZ: -3.7, maxZ: 0.5,
    floor: 0.24, wallH: 3.1, wallT: 0.22,
    kneeH: 0.72,                 // the walls facing the viewer are cut down to here
    door: [-0.75, 0.35],         // gap in the front wall (x range)
};
