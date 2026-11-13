/** Deterministic preview geometry. This is not SPICE or flight-dynamics data. */
export const REFERENCE_EPOCH_UTC = Date.UTC(2026, 10, 13, 19, 0, 0);
const LUNAR_SOLAR_DAY_HOURS = 708.7;

export interface LandingSite {
  id: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  terrain: string;
  description: string;
}

export interface Vector3Tuple { x: number; y: number; z: number }

export interface Conditions {
  elapsedMissionHours: number;
  sunDir: Vector3Tuple;
  elevation: number;
  sunAz: number;
  illumination: number;
  earthDir: Vector3Tuple;
  earthElevation: number;
  earthAz: number;
  sunAvailable: boolean;
  earthAvailable: boolean;
  hour: Date;
}

export interface MissionPoint {
  hours: number;
  sunElevDeg: number;
  earthElevDeg: number;
  illumination: number;
  comm: number;
  lit: number;
}

export interface MissionAnalysis {
  site: LandingSite;
  points: MissionPoint[];
  intervalHours: number;
  averageIllumination: number;
  averageSunElevation: number;
  sunlightHours: number;
  darknessHours: number;
  longestDarkness: number;
  earthVisibilityHours: number;
  communicationPercent: number;
  communicationBlackouts: number;
  longestCommBlackout: number;
  incidentSolarKwhM2: number;
}

export interface MissionAnalysisOptions {
  durationDays: number;
  startMs: number;
  intervalHours: number;
  referenceSite: LandingSite;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const toRad = (degrees: number) => degrees * Math.PI / 180;
const wrapDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

export function calculateConditions(
  site: LandingSite,
  progress: number,
  durationDays: number,
  startMs: number,
  referenceSite: LandingSite,
): Conditions {
  const missionOffsetHours = (startMs - REFERENCE_EPOCH_UTC) / 3_600_000;
  const elapsedMissionHours = progress / 1000 * durationDays * 24;
  const epochHours = missionOffsetHours + elapsedMissionHours;
  const sunLongitude = toRad(referenceSite.lon + 91.9 - epochHours * 360 / LUNAR_SOLAR_DAY_HOURS);
  const solarDeclination = toRad(1.54 * Math.sin(2 * Math.PI * epochHours / (18.6 * 365.25 * 24) + .8));
  const sunDir = {
    x: Math.cos(solarDeclination) * Math.cos(sunLongitude),
    y: Math.sin(solarDeclination),
    z: Math.cos(solarDeclination) * Math.sin(sunLongitude),
  };

  const latitude = toRad(site.lat), longitude = toRad(site.lon);
  const normal = { x: Math.cos(latitude) * Math.cos(longitude), y: Math.sin(latitude), z: Math.cos(latitude) * Math.sin(longitude) };
  const east = { x: -Math.sin(longitude), y: 0, z: Math.cos(longitude) };
  const north = { x: -Math.sin(latitude) * Math.cos(longitude), y: Math.cos(latitude), z: -Math.sin(latitude) * Math.sin(longitude) };
  const dot = (a: Vector3Tuple, b: Vector3Tuple) => a.x * b.x + a.y * b.y + a.z * b.z;
  const elevation = Math.asin(clamp(dot(normal, sunDir), -1, 1));
  const sunAz = wrapDegrees(Math.atan2(dot(sunDir, east), dot(sunDir, north)) * 180 / Math.PI);

  // A small, deterministic optical-libration approximation provides the Earth direction.
  const librationDays = ((epochHours / 24) % 27.32 + 27.32) % 27.32;
  const earthLatitude = toRad(6.68 * Math.sin(2 * Math.PI * librationDays / 27.32 + .6));
  const earthLongitude = toRad(7.9 * Math.sin(2 * Math.PI * librationDays / 27.32 - .4));
  const earthDir = {
    x: Math.cos(earthLatitude) * Math.cos(earthLongitude),
    y: Math.sin(earthLatitude),
    z: Math.cos(earthLatitude) * Math.sin(earthLongitude),
  };
  const earthElevation = Math.asin(clamp(dot(normal, earthDir), -1, 1));
  const earthAz = wrapDegrees(Math.atan2(dot(earthDir, east), dot(earthDir, north)) * 180 / Math.PI);

  return {
    elapsedMissionHours,
    sunDir,
    elevation,
    sunAz,
    illumination: Math.max(0, Math.sin(elevation)) * 100,
    earthDir,
    earthElevation,
    earthAz,
    sunAvailable: elevation > 0,
    earthAvailable: earthElevation > 0,
    hour: new Date(startMs + elapsedMissionHours * 3_600_000),
  };
}

export function analyzeMission(site: LandingSite, options: MissionAnalysisOptions): MissionAnalysis {
  const { durationDays, startMs, intervalHours, referenceSite } = options;
  const totalHours = durationDays * 24;
  const count = Math.ceil(totalHours / intervalHours);
  const points: MissionPoint[] = [];
  let sunlightHours = 0, earthVisibilityHours = 0, illuminationSum = 0, sunElevationSum = 0, incidentSolarKwhM2 = 0;
  let longestDarkness = 0, currentDarkness = 0, longestCommBlackout = 0, currentCommBlackout = 0, communicationBlackouts = 0;
  let wasCommVisible = false;

  for (let i = 0; i <= count; i++) {
    const hours = Math.min(totalHours, i * intervalHours);
    const state = calculateConditions(site, hours / totalHours * 1000, durationDays, startMs, referenceSite);
    const sunElevDeg = state.elevation * 180 / Math.PI;
    const earthElevDeg = state.earthElevation * 180 / Math.PI;
    const lit = state.sunAvailable;
    const earthVisible = state.earthAvailable;
    const illumination = Math.max(0, Math.sin(state.elevation));
    points.push({ hours, sunElevDeg, earthElevDeg, illumination, comm: Number(earthVisible), lit: Number(lit) });
    illuminationSum += illumination;
    sunElevationSum += sunElevDeg;
    incidentSolarKwhM2 += illumination * 1.361 * Math.min(intervalHours, totalHours - hours);

    if (i < count) {
      if (lit) { sunlightHours += intervalHours; currentDarkness = 0; }
      else { currentDarkness += intervalHours; longestDarkness = Math.max(longestDarkness, currentDarkness); }
      if (earthVisible) { earthVisibilityHours += intervalHours; currentCommBlackout = 0; }
      else {
        if (i === 0 || wasCommVisible) communicationBlackouts++;
        currentCommBlackout += intervalHours;
        longestCommBlackout = Math.max(longestCommBlackout, currentCommBlackout);
      }
    }
    wasCommVisible = earthVisible;
  }

  return {
    site,
    points,
    intervalHours,
    averageIllumination: illuminationSum / points.length * 100,
    averageSunElevation: sunElevationSum / points.length,
    sunlightHours,
    darknessHours: totalHours - sunlightHours,
    longestDarkness,
    earthVisibilityHours,
    communicationPercent: earthVisibilityHours / totalHours * 100,
    communicationBlackouts,
    longestCommBlackout,
    incidentSolarKwhM2,
  };
}
