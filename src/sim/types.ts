export type EngineLayout = 'inline6' | 'v6';
export type Severity = 'critical' | 'high' | 'medium' | 'warning' | 'info' | 'success';
export type FaultVisual = 'spark' | 'smoke' | 'steam' | 'crack' | 'shake' | 'stop' | 'timing' | 'none';

export interface SimEvent {
  type: string;
  severity: Severity;
  title: string;
  message?: string;
  silent?: boolean;
  faultId?: string;
  visual?: FaultVisual;
  cyl?: number;
  partCategory?: string;
  optionId?: string;
}

export interface PistonPhase {
  cyl: number;
  angle: number;
  pos: number;
  onPowerStroke: boolean;
  firing: boolean;
  misfire: boolean;
}

export interface EngineSnapshot {
  rpm: number;
  torque: number;
  power: number;
  vibration: number;
  temperature: number;
  boost: number;
  running: boolean;
  crankAngle: number;
  throttle: number;
  faults: string[];
  misfire: boolean[];
  lastFiredCyl: number | null;
  layout: EngineLayout;
  firingOrder: number[];
  rpmLimit: number;
  fuelRate: number;
  time: number;
  targetRpm: number;
}
