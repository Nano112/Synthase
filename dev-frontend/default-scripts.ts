// Default scripts for the Synthase Playground - now with clean static imports

// Import scripts as raw text (much cleaner than escaped strings!)
import cuboidScript from './scripts/cuboid.synthase.js?raw';
import cityScript from './scripts/city.synthase.js?raw';
import templateScript from './scripts/template.synthase.js?raw';
import houseScript  from './scripts/house.synthase.js?raw';
import treeScript  from './scripts/tree.synthase.js?raw';
import roadScript  from './scripts/road.synthase.js?raw';

// Export the same way as before
export const CUBOID_SCRIPT = cuboidScript;
export const CITY_SCRIPT = cityScript;
export const NEW_SCRIPT_TEMPLATE = templateScript;
export const HOUSE_SCRIPT = houseScript;
export const TREE_SCRIPT = treeScript;
export const ROAD_SCRIPT = roadScript;
