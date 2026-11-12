// Aggregates the two v2 world-art modules (each owned by a different workstream).
import terrain from './world2_terrain.mjs';
import buildings from './world2_buildings.mjs';
export default function build() { return [...terrain(), ...buildings()]; }
