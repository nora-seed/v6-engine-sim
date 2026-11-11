import * as THREE from 'three';
import { createRenderer, setupSafariFixes, resizeRenderer } from './view/renderer';
import { createControls } from './view/gizmo';
import { EngineScene } from './view/scene';
import { createPanels } from './ui/panels';
import { initCharts, updateDynoChart, updatePVChart } from './ui/charts';
import { store, updateDisplacement } from './ui/store';
import { EngineSound } from './engine/sound';
import { V6Engine } from './engine/v6';
import { solveThermo } from './engine/thermo';
import { EngineGeometry } from './engine/types';

let renderer: THREE.WebGLRenderer;
let scene: EngineScene;
let controls: ReturnType<typeof createControls>;
let sound: EngineSound;
let worker: Worker;
let animationId: number;
let lastTime = 0;
let crankAngle = 0;

const app = document.getElementById('app')!;
const loading = document.getElementById('loading')!;
const rpmBadge = document.getElementById('rpmBadge')!;
const powerBadge = document.getElementById('powerBadge')!;
const torqueBadge = document.getElementById('torqueBadge')!;
const boostBadge = document.getElementById('boostBadge')!;
const tempBadge = document.getElementById('tempBadge')!;
const afrBadge = document.getElementById('afrBadge')!;
const knockBadge = document.getElementById('knockBadge')!;
const gearBadge = document.getElementById('gearBadge')!;

const chartsHTML = `
  <div id="chartsContainer" style="position:fixed;bottom:0;left:0;right:0;height:220px;background:#0d1b2a;border-top:1px solid #1e3a5f;display:flex;gap:8px;padding:8px;z-index:5;box-shadow:0 -4px 24px #00000080">
    <canvas id="dynoChart" style="flex:1;min-width:300px"></canvas>
    <canvas id="pvChart" style="width:220px;height:100%"></canvas>
  </div>
`;
app.insertAdjacentHTML('beforeend', chartsHTML);

async function init(): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.id = 'webgl-canvas';
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  app.prepend(canvas);

  renderer = createRenderer(canvas);
  setupSafariFixes(renderer);

  scene = new EngineScene(app, store.params.geometry);
  scene.setRenderer(renderer);

  controls = createControls(scene.camera, canvas);
  (window as any).__v6sim_orbit = controls;

  sound = new EngineSound();
  sound.setMasterVolume(store.soundEnabled ? 0.35 : 0);

  createPanels(sound);

  initCharts();

  worker = new Worker(new URL('./worker/solver.ts', import.meta.url), { type: 'module' });
  worker.onmessage = handleWorkerResult;

  window.addEventListener('resize', onResize);
  window.addEventListener('v6sim:rebuild-engine', rebuildEngine);
  window.addEventListener('v6sim:rebuild-turbo', () => { /* turbo rebuilt on next solve */ });
  window.addEventListener('v6sim:wireframe', (e: Event) => scene.setWireframe((e as CustomEvent).detail));
  window.addEventListener('v6sim:xray', (e: Event) => scene.setXRay((e as CustomEvent).detail));
  window.addEventListener('v6sim:dyno-sweep', (e: Event) => runDynoSweep((e as CustomEvent).detail));

  document.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); sound.resume(); }
    if (e.code === 'KeyP') store.isRunning = !store.isRunning;
  });

  document.addEventListener('click', () => sound.resume(), { once: true });
  document.addEventListener('keydown', () => sound.resume(), { once: true });

  loading.style.opacity = '0';
  loading.style.pointerEvents = 'none';
  setTimeout(() => loading.remove(), 500);

  lastTime = performance.now();
  animationId = requestAnimationFrame(animate);
}

function animate(time: number): void {
  const dt = Math.min(0.1, (time - lastTime) / 1000);
  lastTime = time;

  if (store.isRunning) {
    const rpmDiff = store.targetRpm - store.rpm;
    store.rpm += rpmDiff * Math.min(1, dt * 2);
    store.params.rpm = store.rpm;

    const omega = store.rpm * 2 * Math.PI / 60;
    crankAngle = (crankAngle + omega * dt) % (Math.PI * 4);
  }

  scene.update(crankAngle, store.params.vvtIntake, store.params.vvtExhaust, store.params.ignitionAdvance);

  sound.setRPM(store.rpm);
  sound.setThrottle(store.throttle);
  const currentBoost = store.results.get(Math.round(store.rpm / 250) * 250)?.boost ?? 0;
  sound.setBoost(currentBoost);
  sound.update(dt);

  updateHUD();

  controls.update();
  renderer.render(scene.scene, scene.camera);

  animationId = requestAnimationFrame(animate);
}

function updateHUD(): void {
  const s = store.results.get(Math.round(store.rpm / 250) * 250);
  rpmBadge.textContent = `RPM: ${Math.round(store.rpm).toLocaleString()}`;
  powerBadge.textContent = `Power: ${store.units === 'imperial' ? (s?.power * 1.34102 ?? 0).toFixed(1) + ' hp' : (s?.power ?? 0).toFixed(1) + ' kW'}`;
  torqueBadge.textContent = `Torque: ${store.units === 'imperial' ? (s?.torque * 0.73756 ?? 0).toFixed(1) + ' lb-ft' : (s?.torque ?? 0).toFixed(1) + ' Nm'}`;
  boostBadge.textContent = `Boost: ${(s?.boost ?? 0).toFixed(2)} bar`;
  tempBadge.textContent = `ECT: ${s ? Math.round(90 + s.egt * 0.3) : '--'}°C`;
  afrBadge.textContent = `AFR: ${s ? (14.7 * s.lambda).toFixed(1) : '--.-'}`;
  knockBadge.textContent = `Knock: ${s ? Math.max(0, s.knockMargin).toFixed(1) : '--'}°`;
  gearBadge.textContent = `Gear: ${getGear(store.rpm)}`;
}

function getGear(rpm: number): string {
  if (rpm < 1200) return 'N';
  if (rpm < 3500) return '1';
  if (rpm < 5000) return '2';
  if (rpm < 6500) return '3';
  if (rpm < 8000) return '4';
  return '5';
}

function handleWorkerResult(e: MessageEvent): void {
  const output = e.data;
  if (output.error) {
    console.error('[Worker] Error:', output.error);
    return;
  }
  store.results = output.curves;

  const peakRpm = Array.from(output.curves.keys()).reduce((a, b) => output.curves.get(b)!.power > output.curves.get(a)!.power ? b : a, 0);
  updateDynoChart(output.curves);
  updatePVChart(output.curves.get(peakRpm)?.pvDiagram ?? []);
}

async function runDynoSweep(rpmPoints: number[]): Promise<void> {
  store.params.rpm = rpmPoints[0];
  worker.postMessage({ params: store.params, rpmSweep: rpmPoints });
}

function rebuildEngine(): void {
  updateDisplacement();
  scene.engine.group.removeFromParent();
  scene.engine = new V6Engine(store.params.geometry);
  scene.scene.add(scene.engine.group);
  scene.extractSparkPlugs();
}

function onResize(): void {
  const width = app.clientWidth;
  const height = app.clientHeight;
  resizeRenderer(renderer, scene.camera, width, height);
}

init().catch(err => {
  console.error('Init failed:', err);
  loading.textContent = 'Failed to initialize. See console.';
  loading.style.color = '#ff4757';
});

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animationId);
  worker.terminate();
  sound.destroy();
  scene.dispose();
  renderer.dispose();
});