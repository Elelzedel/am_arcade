import { bakeSurface } from './lightmapKernel.js';

// Bakes a batch of surfaces off the main thread; see lightmap.js.
self.onmessage = (event) => {
    const { surfaces, lights, hemisphere, occluders } = event.data;
    const results = surfaces.map((surface) => bakeSurface(surface, lights, hemisphere, occluders));
    self.postMessage({ results }, results.map((data) => data.buffer));
};
