export interface Vec3 { x: number; y: number; z: number }
export interface Mat4 { elements: Float32Array }

export interface EngineGeometry {
  bore: number;
  stroke: number;
  rodLength: number;
  compressionRatio: number;
  vAngle: number;
  crankType: 'flat' | 'cross';
  cylinders: 6;
  displacement: number;
  deckHeight: number;
  pistonPinOffset: number;
}

export interface EngineParams {
  geometry: EngineGeometry;
  rpm: number;
  throttle: number;
  ignitionAdvance: number;
  injectionTiming: number;
  vvtIntake: number;
  vvtExhaust: number;
  afrTarget: number;
  octane: number;
  ambient: AmbientConditions;
  forcedInduction: TurboParams | null;
}

export interface AmbientConditions {
  temperature: number;
  pressure: number;
  humidity: number;
  altitude: number;
}

export interface TurboParams {
  type: 'single' | 'twin';
  compressorTrim: number;
  compressorAR: number;
  turbineAR: number;
  wastegateSpring: number;
  intercoolerEff: number;
  boostTarget: number;
  maxBoost: number;
}

export interface ThermoState {
  rpm: number;
  torque: number;
  power: number;
  bmep: number;
  bsfc: number;
  egt: number;
  boost: number;
  lambda: number;
  knockMargin: number;
  volumetricEff: number;
  pvDiagram: PVPoint[];
  cylinderPressures: number[][];
}

export interface PVPoint { v: number; p: number; q: number }

export interface SolverInput {
  params: EngineParams;
  rpmSweep: number[];
}

export interface SolverOutput {
  curves: Map<number, ThermoState>;
  compressorMap: MapPoint[];
  turbineMap: MapPoint[];
}

export interface MapPoint { x: number; y: number; eff: number; pr: number }