import { proxy, subscribe, snapshot } from 'valtio';
import { EngineParams, EngineGeometry, TurboParams, AmbientConditions } from '../engine/types';

const defaultGeometry: EngineGeometry = {
  bore: 89.0,
  stroke: 80.0,
  rodLength: 144.0,
  compressionRatio: 10.5,
  vAngle: 60,
  crankType: 'flat',
  cylinders: 6,
  displacement: 0,
  deckHeight: 210,
  pistonPinOffset: 0.5
};
defaultGeometry.displacement = Math.PI / 4 * defaultGeometry.bore ** 2 * defaultGeometry.stroke * 6 * 1e-3;

const defaultTurbo: TurboParams = {
  type: 'twin',
  compressorTrim: 58,
  compressorAR: 0.61,
  turbineAR: 0.82,
  wastegateSpring: 14,
  intercoolerEff: 0.75,
  boostTarget: 1.2,
  maxBoost: 2.5
};

const defaultAmbient: AmbientConditions = {
  temperature: 20,
  pressure: 101.325,
  humidity: 0.5,
  altitude: 0
};

export const store = proxy<{
  params: EngineParams;
  results: Map<number, any>;
  rpm: number;
  targetRpm: number;
  throttle: number;
  isRunning: boolean;
  soundEnabled: boolean;
  activePanel: string;
  showPV: boolean;
  showWireframe: boolean;
  showXRay: boolean;
  units: 'metric' | 'imperial';
  theme: 'dark' | 'light';
  language: 'en' | 'tr';
}>({
  params: {
    geometry: defaultGeometry,
    rpm: 800,
    throttle: 0,
    ignitionAdvance: 12,
    injectionTiming: 280,
    vvtIntake: 0,
    vvtExhaust: 0,
    afrTarget: 1.0,
    octane: 98,
    ambient: defaultAmbient,
    forcedInduction: defaultTurbo
  },
  results: new Map(),
  rpm: 800,
  targetRpm: 800,
  throttle: 0,
  isRunning: true,
  soundEnabled: true,
  activePanel: 'engine',
  showPV: true,
  showWireframe: false,
  showXRay: false,
  units: 'metric',
  theme: 'dark',
  language: 'en'
});

const STORAGE_KEY = 'v6sim_state_v1';
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    Object.assign(store.params.geometry, parsed.geometry);
    Object.assign(store.params.ambient, parsed.ambient);
    Object.assign(store.params.forcedInduction, parsed.forcedInduction);
    store.params.ignitionAdvance = parsed.ignitionAdvance ?? 12;
    store.params.afrTarget = parsed.afrTarget ?? 1.0;
    store.params.octane = parsed.octane ?? 98;
    store.units = parsed.units ?? 'metric';
    store.theme = parsed.theme ?? 'dark';
    store.language = parsed.language ?? 'en';
    store.soundEnabled = parsed.soundEnabled ?? true;
  } catch { /* ignore */ }
}

subscribe(store, () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    geometry: snapshot(store.params.geometry),
    ambient: snapshot(store.params.ambient),
    forcedInduction: snapshot(store.params.forcedInduction),
    ignitionAdvance: store.params.ignitionAdvance,
    afrTarget: store.params.afrTarget,
    octane: store.params.octane,
    units: store.units,
    theme: store.theme,
    language: store.language,
    soundEnabled: store.soundEnabled
  }));
});

export function getDisplacement(): number {
  const g = store.params.geometry;
  return Math.PI / 4 * g.bore ** 2 * g.stroke * 6 * 1e-3;
}

export function updateDisplacement(): void {
  store.params.geometry.displacement = getDisplacement();
}

export const PARAM_BOUNDS = {
  bore: { min: 70, max: 110, step: 0.1, unit: 'mm' },
  stroke: { min: 60, max: 110, step: 0.1, unit: 'mm' },
  rodLength: { min: 100, max: 200, step: 0.1, unit: 'mm' },
  compressionRatio: { min: 8, max: 14, step: 0.1, unit: ':1' },
  vAngle: { min: 45, max: 120, step: 1, unit: '°', options: [60, 90, 120] },
  rpm: { min: 500, max: 9000, step: 10, unit: ' RPM' },
  throttle: { min: 0, max: 1, step: 0.01, unit: '' },
  ignitionAdvance: { min: -10, max: 50, step: 0.5, unit: '° BTDC' },
  injectionTiming: { min: 180, max: 360, step: 1, unit: '° BTDC' },
  vvtIntake: { min: -40, max: 40, step: 1, unit: '°' },
  vvtExhaust: { min: -40, max: 40, step: 1, unit: '°' },
  afrTarget: { min: 0.75, max: 1.25, step: 0.01, unit: ' λ' },
  octane: { min: 87, max: 110, step: 1, unit: ' RON' },
  boostTarget: { min: 0, max: 3, step: 0.05, unit: ' bar' },
  compressorTrim: { min: 45, max: 80, step: 1, unit: '' },
  compressorAR: { min: 0.4, max: 1.2, step: 0.01, unit: ' A/R' },
  turbineAR: { min: 0.5, max: 1.5, step: 0.01, unit: ' A/R' },
  wastegateSpring: { min: 5, max: 30, step: 1, unit: ' psi' },
  intercoolerEff: { min: 0.5, max: 0.95, step: 0.01, unit: '' },
  temperature: { min: -30, max: 50, step: 1, unit: ' °C' },
  pressure: { min: 80, max: 110, step: 0.1, unit: ' kPa' },
  humidity: { min: 0, max: 1, step: 0.05, unit: '' },
  altitude: { min: 0, max: 4000, step: 50, unit: ' m' }
};