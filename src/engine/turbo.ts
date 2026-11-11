import { TurboParams, MapPoint } from './types';

export class TurboModel {
  private compressorMap: MapPoint[] = [];
  private turbineMap: MapPoint[] = [];

  constructor(params: TurboParams) {
    this.generateMaps(params);
  }

  private generateMaps(params: TurboParams): void {
    const trim = params.compressorTrim;
    const maxFlow = 0.08 * (trim / 50) ** 1.2;
    const maxPR = 3.5;

    for (let pr = 1.0; pr <= maxPR; pr += 0.1) {
      for (let flow = 0.02; flow <= maxFlow * 1.1; flow += maxFlow / 20) {
        const flowRatio = flow / maxFlow;
        const prRatio = (pr - 1) / (maxPR - 1);

        const distFromPeak = Math.sqrt(
          Math.pow(flowRatio - 0.7, 2) / 0.15 ** 2 +
          Math.pow(prRatio - 0.6, 2) / 0.3 ** 2
        );
        let eff = 0.78 * Math.exp(-distFromPeak * 1.5);
        eff = Math.max(0.45, Math.min(0.78, eff));

        if (flowRatio > 0.95 + 0.05 * prRatio) eff *= 0.5;

        this.compressorMap.push({ x: flow, y: pr, eff, pr });
      }
    }

    const aR = params.turbineAR;
    const maxTurbFlow = 0.12 / aR;

    for (let pr = 1.0; pr <= 4.0; pr += 0.15) {
      for (let flow = 0.01; flow <= maxTurbFlow; flow += maxTurbFlow / 15) {
        const flowRatio = flow / maxTurbFlow;
        const prRatio = (pr - 1) / 3.0;

        let eff = 0.72 - 0.2 * Math.abs(flowRatio - 0.65) - 0.1 * Math.abs(prRatio - 0.5);
        eff = Math.max(0.5, Math.min(0.75, eff));

        this.turbineMap.push({ x: flow, y: pr, eff, pr });
      }
    }
  }

  getCompressorMap(): MapPoint[] { return this.compressorMap; }
  getTurbineMap(): MapPoint[] { return this.turbineMap; }

  getCompressorEff(correctedFlow: number, pressureRatio: number): number {
    let best = this.compressorMap[0];
    let bestDist = Infinity;
    for (const p of this.compressorMap) {
      const dist = Math.abs(p.x - correctedFlow) + Math.abs(p.y - pressureRatio) * 10;
      if (dist < bestDist) { bestDist = dist; best = p; }
    }
    return best.eff;
  }

  getTurbineEff(correctedFlow: number, pressureRatio: number): number {
    let best = this.turbineMap[0];
    let bestDist = Infinity;
    for (const p of this.turbineMap) {
      const dist = Math.abs(p.x - correctedFlow) + Math.abs(p.y - pressureRatio) * 10;
      if (dist < bestDist) { bestDist = dist; best = p; }
    }
    return best.eff;
  }
}

export class WastegateController {
  private integral = 0;
  private prevError = 0;

  constructor(
    private kp = 0.15,
    private ki = 0.02,
    private kd = 0.05,
    private min = 0,
    private max = 1
  ) {}

  update(setpoint: number, measured: number, dt: number): number {
    const error = setpoint - measured;
    this.integral += error * dt;
    this.integral = Math.max(-1, Math.min(1, this.integral));
    const derivative = (error - this.prevError) / dt;
    this.prevError = error;

    const output = this.kp * error + this.ki * this.integral + this.kd * derivative;
    return Math.max(this.min, Math.min(this.max, output));
  }

  reset(): void { this.integral = 0; this.prevError = 0; }
}

export function calculateBoostTarget(
  rpm: number,
  throttle: number,
  params: TurboParams
): number {
  const { boostTarget, maxBoost, wastegateSpring } = params;

  let target = boostTarget * throttle;

  const spoolRPM = 2500;
  if (rpm < spoolRPM) {
    target *= Math.pow(rpm / spoolRPM, 2);
  }

  const springBar = wastegateSpring * 0.0689476;
  target = Math.max(target, springBar * throttle);

  target = Math.min(target, maxBoost - 1.01325);

  return target;
}