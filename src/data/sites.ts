import type { LandingSite } from '../science';

export const LANDING_SITES: LandingSite[] = [
  { id: 'malapert', name: 'Malapert Massif', short: 'MALAPERT MASSIF', lat: -85.91, lon: -4.16, terrain: 'HIGH RELIEF', description: 'Elevated massif terrain with broad polar sightlines and nearby permanently shadowed regions.' },
  { id: 'shackleton', name: 'Shackleton Rim', short: 'SHACKLETON RIM', lat: -89.90, lon: 0.0, terrain: 'CRATER RIM', description: 'Rim crest near the lunar south pole; steep local slopes and a long polar horizon.' },
  { id: 'ridge', name: 'Connecting Ridge', short: 'CONNECTING RIDGE', lat: -84.72, lon: 33.40, terrain: 'RIDGELINE', description: 'A narrow ridge linking elevated polar terrain, with nearby crater walls.' },
  { id: 'haworth', name: 'Haworth Crater Rim', short: 'HAWORTH CRATER', lat: -87.60, lon: -4.10, terrain: 'CRATER RIM', description: 'Rugged highland bordering a permanently shadowed crater interior.' },
];
