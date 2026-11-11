import { solveThermo, SolverInput, SolverOutput } from '../engine/thermo';

self.onmessage = (e: MessageEvent<SolverInput>) => {
  const { params, rpmSweep } = e.data;
  console.log('[Worker] Solving for', rpmSweep.length, 'RPM points');

  try {
    const curves = solveThermo(params, rpmSweep);

    const compressorMap = generateCompressorMap(params.forcedInduction!);
    const turbineMap = generateTurbineMap(params.forcedInduction!);

    const output: SolverOutput = { curves, compressorMap, turbineMap };
    self.postMessage(output, undefined);
  } catch (err) {
    console.error('[Worker] Error:', err);
    self.postMessage({ error: String(err) });
  }
};

function generateCompressorMap(turbo: any): any[] {
  if (!turbo) return [];
  const points = [];
  const maxFlow = 0.15 * turbo.compressorTrim / 50;
  for (let pr = 1.0; pr <= 3.5; pr += 0.15) {
    for (let flow = 0.02; flow <= maxFlow * 1.1; flow += maxFlow / 15) {
      const fr = flow / maxFlow;
      const prr = (pr - 1) / 2.5;
      const dist = Math.sqrt((fr - 0.7) ** 2 / 0.15 ** 2 + (prr - 0.6) ** 2 / 0.3 ** 2);
      let eff = 0.78 * Math.exp(-dist * 1.5);
      eff = Math.max(0.45, Math.min(0.78, eff));
      if (fr > 0.95 + 0.05 * prr) eff *= 0.5;
      points.push({ x: flow, y: pr, eff, pr });
    }
  }
  return points;
}

function generateTurbineMap(turbo: any): any[] {
  if (!turbo) return [];
  const points = [];
  const maxFlow = 0.12 / turbo.turbineAR;
  for (let pr = 1.0; pr <= 4.0; pr += 0.2) {
    for (let flow = 0.01; flow <= maxFlow; flow += maxFlow / 12) {
      const fr = flow / maxFlow;
      const prr = (pr - 1) / 3;
      let eff = 0.72 - 0.2 * Math.abs(fr - 0.65) - 0.1 * Math.abs(prr - 0.5);
      eff = Math.max(0.5, Math.min(0.75, eff));
      points.push({ x: flow, y: pr, eff, pr });
    }
  }
  return points;
}