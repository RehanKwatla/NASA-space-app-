import { create } from 'zustand';
import { REFERENCE_EPOCH_UTC } from '../science';

export type MissionView = 'orbit' | 'surface' | 'analysis';

interface MissionStore {
  selectedSiteId: string;
  startMs: number;
  durationDays: number;
  progress: number;
  speed: number;
  resolutionHours: number;
  playing: boolean;
  view: MissionView;
  terrainOn: boolean;
  illuminationOn: boolean;
  earthOn: boolean;
  selectSite: (id: string) => void;
  setStartMs: (value: number) => void;
  setDurationDays: (value: number) => void;
  setProgress: (value: number) => void;
  setSpeed: (value: number) => void;
  setResolutionHours: (value: number) => void;
  setPlaying: (value: boolean) => void;
  setView: (view: MissionView) => void;
  toggleTerrain: () => void;
  toggleIllumination: () => void;
  toggleEarth: () => void;
  reset: () => void;
}

export const useMissionStore = create<MissionStore>((set) => ({
  selectedSiteId: 'malapert',
  startMs: REFERENCE_EPOCH_UTC,
  durationDays: 14,
  progress: 0,
  speed: 10,
  resolutionHours: 1,
  playing: false,
  view: 'orbit',
  terrainOn: true,
  illuminationOn: true,
  earthOn: true,
  selectSite: selectedSiteId => set({ selectedSiteId }),
  setStartMs: startMs => set({ startMs, progress: 0 }),
  setDurationDays: durationDays => set({ durationDays }),
  setProgress: progress => set({ progress: Math.max(0, Math.min(1000, progress)) }),
  setSpeed: speed => set({ speed }),
  setResolutionHours: resolutionHours => set({ resolutionHours }),
  setPlaying: playing => set({ playing }),
  setView: view => set({ view }),
  toggleTerrain: () => set(state => ({ terrainOn: !state.terrainOn })),
  toggleIllumination: () => set(state => ({ illuminationOn: !state.illuminationOn })),
  toggleEarth: () => set(state => ({ earthOn: !state.earthOn })),
  reset: () => set({ selectedSiteId: 'malapert', startMs: REFERENCE_EPOCH_UTC, durationDays: 14, progress: 0, speed: 10, resolutionHours: 1, playing: false, view: 'orbit', terrainOn: true, illuminationOn: true, earthOn: true }),
}));
