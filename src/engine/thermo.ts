import { EngineParams, ThermoState, PVPoint, AmbientConditions, EngineGeometry, SolverInput, SolverOutput } from './types';

const R = 8.314462618;
const GAMMA_AIR = 1.4;
const GAMMA_BURN = 1.3;
const STOICH_AFR = 14.7;
const LHV_GASOLINE = 44.0e6;
const CV_AIR = 718;
const CP_AIR = 1005;

export function solveThermo(params: EngineParams, rpmArray: number[]): Map<number, ThermoState> {
  const results = new Map<number, ThermoState>();

  for (const rpm of rpmArray) {
    const state = solveSingleRPM(params, rpm);
    results.set(rpm, state);
  }
  return results;
}

function solveSingleRPM(params: EngineParams, rpm: number): ThermoState {
  const { geometry, throttle, ignitionAdvance, injectionTiming, afrTarget, octane, ambient, forcedInduction } = params;
  const { bore, stroke, rodLength, compressionRatio, displacement } = geometry;

  const T_amb = ambient.temperature + 273.15;
  const P_amb = ambient.pressure * 100;
  const rho_amb = P_amb / (287.058 * T_amb * (1 + 0.608 * ambient.humidity));

  const ve_base = 0.85 + 0.1 * Math.sin((rpm - 1000) / 4000 * Math.PI);
  const ve_throttle = 0.3 + 0.7 * throttle;
  const ve_wave = 1 + 0.05 * Math.sin(rpm / 1500 * Math.PI);
  let ve = ve_base * ve_throttle * ve_wave;

  let boost_gauge = 0;
  let P_manifold = P_amb;
  let T_manifold = T_amb;

  if (forcedInduction) {
    const turbo = solveTurbo(params, rpm, ve, rho_amb);
    boost_gauge = turbo.boost_gauge;
    P_manifold = turbo.P_manifold;
    T_manifold = turbo.T_manifold;
    ve *= turbo.ve_multiplier;
  }

  ve = Math.min(1.15, Math.max(0.15, ve));

  const V_d = displacement * 1e-6;
  const m_air = P_manifold * V_d * ve / (287.058 * T_manifold);
  const m_fuel = m_air / (STOICH_AFR * afrTarget);
  const Q_in = m_fuel * LHV_GASOLINE * 0.98;

  const V_c = V_d / (compressionRatio - 1);
  const V_s = V_d / 6;
  const P_ivc = P_manifold * 0.95;
  const T_ivc = T_manifold * 1.05;

  const n_comp = 1.32;
  const P_tdc = P_ivc * Math.pow(compressionRatio, n_comp);
  const T_tdc = T_ivc * Math.pow(compressionRatio, n_comp - 1);

  const burn_duration = 40 * Math.PI / 180;
  const burn_start = -ignitionAdvance * Math.PI / 180;
  const m = 2.5;
  const a = 5;

  const pvDiagram: PVPoint[] = [];
  const n_points = 720;
  let maxP = 0;
  let work_cycle = 0;
  let Q_released = 0;

  const cylinderPressures: number[][] = [[], [], [], [], [], []];

  for (let i = 0; i < n_points; i++) {
    const theta = (i / n_points) * 4 * Math.PI;
    const V = cylinderVolume(theta, V_c, V_s, rodLength, stroke);

    const stroke_phase = Math.floor(theta / Math.PI);

    let P, T;

    if (stroke_phase === 0) {
      P = P_manifold * 0.98;
      T = T_manifold;
    } else if (stroke_phase === 1) {
      const comp_ratio_inst = (V_c + V_s) / V;
      P = P_ivc * Math.pow(comp_ratio_inst, n_comp);
      T = T_ivc * Math.pow(comp_ratio_inst, n_comp - 1);
    } else if (stroke_phase === 2) {
      const theta_burn = theta - Math.PI - burn_start;
      let x_b = 0;
      if (theta_burn > 0 && theta_burn < burn_duration) {
        x_b = 1 - Math.exp(-a * Math.pow(theta_burn / burn_duration, m + 1));
      } else if (theta_burn >= burn_duration) {
        x_b = 1;
      }
      const dQ = Q_in * x_b - Q_released;
      Q_released = Q_in * x_b;

      const gamma = GAMMA_AIR * (1 - x_b) + GAMMA_BURN * x_b;
      if (i === 180) {
        P = P_tdc;
        T = T_tdc;
      } else {
        const V_prev = cylinderVolume(theta - 4 * Math.PI / n_points, V_c, V_s, rodLength, stroke);
        const n_poly = gamma;
        P = P_tdc * Math.pow((V_c + V_s) / V, n_poly) + dQ / (V - V_prev) * 0.5;
        T = P * V / (m_air / 6 * 287.058);
      }
    } else {
      P = P_amb * 1.05;
      T = T_amb * 1.3;
    }

    maxP = Math.max(maxP, P);
    pvDiagram.push({ v: V * 1000, p: P / 1e5, q: Q_released });

    for (let c = 0; c < 6; c++) {
      cylinderPressures[c].push(P / 1e5);
    }

    if (i > 0) {
      const V_prev = pvDiagram[i - 1].v / 1000;
      work_cycle += (P + pvDiagram[i - 1].p * 1e5) / 2 * (V - V_prev);
    }
  }

  const work_net = work_cycle * 6;
  const cycles_per_sec = rpm / 120;
  const power_W = work_net * cycles_per_sec;
  const torque_Nm = power_W / (rpm * 2 * Math.PI / 60);

  const fmep = 0.3 + 0.005 * rpm + 0.00002 * rpm * rpm + 0.05 * maxP / 1e5;
  const friction_power = fmep * 1e5 * V_d * cycles_per_sec;
  const brake_power = power_W - friction_power;
  const brake_torque = brake_power / (rpm * 2 * Math.PI / 60);

  const fuel_flow_kg_s = m_fuel * cycles_per_sec * 6;
  const bsfc = fuel_flow_kg_s > 0 ? (fuel_flow_kg_s * 3.6e6) / brake_power : 0;

  const T_exh = T_tdc * Math.pow(compressionRatio, 1 - GAMMA_BURN) * 0.85 + 200;
  const egt_c = T_exh - 273.15;

  const knock_limit = 10 + 0.5 * (octane - 95) - 0.1 * (maxP / 1e5 - 80) - 0.05 * (rpm / 1000);
  const actual_advance = ignitionAdvance;
  const knock_margin = knock_limit - actual_advance;

  const lambda = afrTarget;

  return {
    rpm,
    torque: brake_torque,
    power: brake_power / 1000,
    bmep: brake_torque * 2 * Math.PI / V_d / 1e5,
    bsfc,
    egt: egt_c,
    boost: boost_gauge,
    lambda,
    knockMargin: Math.max(0, knock_margin),
    volumetricEff: ve,
    pvDiagram,
    cylinderPressures
  };
}

function cylinderVolume(theta: number, V_c: number, V_s: number, rodLen: number, stroke: number): number {
  const r = stroke / 2;
  const x = r * Math.cos(theta) + Math.sqrt(rodLen * rodLen - r * r * Math.sin(theta) * Math.sin(theta));
  return V_c + V_s / 2 * (1 - Math.cos(theta) + r / rodLen * (1 - Math.cos(2 * theta)) / 2);
}

interface TurboResult {
  boost_gauge: number;
  P_manifold: number;
  T_manifold: number;
  ve_multiplier: number;
}

function solveTurbo(params: EngineParams, rpm: number, ve: number, rho_amb: number): TurboResult {
  const { forcedInduction, geometry, throttle } = params;
  if (!forcedInduction) return { boost_gauge: 0, P_manifold: params.ambient.pressure * 100, T_manifold: params.ambient.temperature + 273.15, ve_multiplier: 1 };

  const { compressorTrim, compressorAR, turbineAR, wastegateSpring, intercoolerEff, boostTarget } = forcedInduction;
  const V_d = geometry.displacement * 1e-6;

  const m_dot_air = rho_amb * V_d * ve * (rpm / 120) * throttle;

  const PR_target = 1 + boostTarget;
  const corrected_flow = m_dot_air * Math.sqrt(288.15 / (params.ambient.temperature + 273.15)) / (params.ambient.pressure / 101.325);
  const max_flow = 0.15 * compressorTrim / 50;
  const choke_flow = max_flow * 1.1;

  let PR = 1 + (PR_target - 1) * Math.min(1, corrected_flow / max_flow * 1.2);
  PR = Math.min(PR, 3.5);

  const flow_ratio = corrected_flow / max_flow;
  const comp_eff = 0.75 - 0.25 * Math.pow(flow_ratio - 0.7, 2);
  const T_out = (params.ambient.temperature + 273.15) * (1 + (Math.pow(PR, (GAMMA_AIR - 1) / GAMMA_AIR) - 1) / Math.max(0.5, comp_eff));

  const T_manifold = T_out - intercoolerEff * (T_out - (params.ambient.temperature + 273.15));

  const boost_gauge = (PR - 1) * 1.01325;
  const wg_error = boost_gauge - boostTarget;
  let ve_mult = 1;
  if (wg_error > 0) {
    ve_mult = 1 - Math.min(0.3, wg_error * 0.1);
  }

  return {
    boost_gauge,
    P_manifold: PR * params.ambient.pressure * 100,
    T_manifold,
    ve_multiplier: ve_mult
  };
}

export type { SolverInput, SolverOutput };