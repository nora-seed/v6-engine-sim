import * as THREE from 'three';
import { snapshot } from 'valtio';
import { createRenderer, setupSafariFixes, resizeRenderer } from './view/renderer';
import { createControls } from './view/gizmo';
import { EngineScene } from './view/scene';
import { createPanels } from './ui/panels';
import { initCharts, updateDynoChart, updatePVChart } from './ui/charts';
import { store } from './ui/store';
import { EngineSound } from './engine/sound';
import { SimEngine } from './sim/simEngine';
import { EventLog } from './ui/eventLog';
import { EngineLayout, EngineSnapshot, FaultVisual, SimEvent } from './sim/types';

let renderer: THREE.WebGLRenderer;
let scene: EngineScene;
let controls: ReturnType<typeof createControls>;
let sound: EngineSound;
let worker: Worker;
let animationId: number;
let lastTime = 0;
let crankAngle = 0;
let sim: SimEngine;
let eventLog: EventLog;

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
const vibBadge = document.getElementById('vibBadge')!;
const fuelBadge = document.getElementById('fuelBadge')!;
const btnStart = document.getElementById('btnStart') as HTMLButtonElement | null;
const btnStop = document.getElementById('btnStop') as HTMLButtonElement | null;
const btnLog = document.getElementById('btnLog') as HTMLButtonElement | null;
const logPanel = document.getElementById('logPanel') as HTMLElement | null;

const chartsHTML = `
  <div id="chartsContainer" style="position:fixed;bottom:0;left:0;right:0;height:220px;background:#0d1b2a;border-top:1px solid #1e3a5f;display:flex;gap:8px;padding:8px;z-index:5;box-shadow:0 -4px 24px #00000080">
    <canvas id="dynoChart" style="flex:1;min-width:300px"></canvas>
    <canvas id="pvChart" style="width:220px;height:100%"></canvas>
  </div>
`;
app.insertAdjacentHTML('beforeend', chartsHTML);

const INITIAL_SWEEP: number[] = [];
for (let r = 1000; r <= 8000; r += 250) INITIAL_SWEEP.push(r);

const faultVisualMap = new Map<string, FaultVisual>();
let shakeAmount = 0;
let sparkCooldown = 0;
let lastClickAt = 0;
let lastMisfireAt = 0;

async function init(): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.id = 'webgl-canvas';
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  app.prepend(canvas);

  renderer = createRenderer(canvas);
  setupSafariFixes(renderer);

  scene = new EngineScene(app);
  scene.setRenderer(renderer);

  controls = createControls(scene.camera, canvas);
  (window as any).__v6sim_orbit = controls;

  sound = new EngineSound();
  sound.setMasterVolume(store.soundEnabled ? 0.35 : 0);

  sim = new SimEngine();
  eventLog = new EventLog();
  sim.onEvent = (event: SimEvent) => {
    eventLog.push(event);
    handleVisualEvent(event);
  };

  createPanels(sound, sim);
  setupEngineControls();
  initCharts();

  worker = new Worker(new URL('./worker/solver.ts', import.meta.url), { type: 'module' });
  worker.onmessage = handleWorkerResult;

  window.addEventListener('resize', onResize);
  window.addEventListener('v6sim:rebuild-engine', () => runDynoSweep(INITIAL_SWEEP));
  window.addEventListener('v6sim:rebuild-turbo', () => runDynoSweep(INITIAL_SWEEP));
  window.addEventListener('v6sim:wireframe', (e: Event) => scene.setWireframe((e as CustomEvent).detail));
  window.addEventListener('v6sim:xray', (e: Event) => scene.setXRay((e as CustomEvent).detail));
  window.addEventListener('v6sim:dyno-sweep', (e: Event) => runDynoSweep((e as CustomEvent).detail));
  window.addEventListener('v6sim:cutaway', (e: Event) => scene.setCutaway((e as CustomEvent).detail));
  window.addEventListener('v6sim:layout', (e: Event) => {
    const layout = (e as CustomEvent).detail as EngineLayout;
    sim.setLayout(layout);
    scene.setLayout(layout);
    scene.clearBreakage();
    scene.clearEffects();
    faultVisualMap.clear();
  });

  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      sound.resume();
    }
  });

  document.addEventListener('click', () => sound.resume(), { once: true });
  document.addEventListener('keydown', () => sound.resume(), { once: true });

  btnLog?.addEventListener('click', () => {
    if (!logPanel) return;
    const isMobile = window.matchMedia('(max-width:768px)').matches;
    if (isMobile) logPanel.classList.toggle('open');
    else logPanel.classList.toggle('hidden');
    btnLog.classList.toggle('active', logPanel.classList.contains('open') || !logPanel.classList.contains('hidden'));
  });

  loading.style.opacity = '0';
  loading.style.pointerEvents = 'none';
  setTimeout(() => loading.remove(), 500);

  lastTime = performance.now();
  animationId = requestAnimationFrame(animate);

  runDynoSweep(INITIAL_SWEEP);
}

function animate(time: number): void {
  const dt = Math.min(0.1, (time - lastTime) / 1000);
  lastTime = time;

  if (store.isRunning) {
    const rpmDiff = store.targetRpm - store.rpm;
    store.rpm += rpmDiff * Math.min(1, dt * 2);
    store.params.rpm = store.rpm;

    const omega = (store.rpm * 2 * Math.PI) / 60;
    crankAngle = (crankAngle + omega * dt) % (Math.PI * 4);
  } else {
    store.rpm = Math.max(0, store.rpm - dt * 2500);
    store.params.rpm = store.rpm;
    if (store.rpm > 0) {
      const omega = (store.rpm * 2 * Math.PI) / 60;
      crankAngle = (crankAngle + omega * dt) % (Math.PI * 4);
    }
  }

  const angleDeg = (((crankAngle * 180) / Math.PI) % 720 + 720) % 720;
  const currentBoost = store.results.get(Math.round(store.rpm / 250) * 250)?.boost ?? 0;

  sim.update(dt, angleDeg, currentBoost);
  const phases = sim.pistonPhases(angleDeg);
  const snap = sim.snapshot(angleDeg, currentBoost);

  scene.setTurboRequired(sim.induction === 'turbo' || sim.induction === 'supercharged');
  scene.setFaultHighlight(currentVisual(snap));
  scene.update(snap, phases, dt);

  sound.setRPM(store.rpm);
  sound.setThrottle(store.throttle);
  sound.setBoost(currentBoost);
  sound.update(dt);

  updateHUD(snap);
  updateEngineControls();
  handlePeriodicEffects(snap, dt);

  const amp = Math.max(shakeAmount, Math.max(0, snap.vibration - 0.85) * 0.08);
  if (amp > 0.001) {
    scene.model.root.position.set(
      (Math.random() - 0.5) * amp,
      (Math.random() - 0.5) * amp,
      (Math.random() - 0.5) * amp * 0.5
    );
    shakeAmount = Math.max(0, shakeAmount - dt * 0.5);
  } else {
    scene.model.root.position.set(0, 0, 0);
  }

  controls.update();
  renderer.render(scene.scene, scene.camera);

  animationId = requestAnimationFrame(animate);
}

function updateHUD(snap: EngineSnapshot): void {
  const s = store.results.get(Math.round(store.rpm / 250) * 250);
  const powerKw = s?.power ?? 0;
  const torqueNm = s?.torque ?? 0;
  const boost = s?.boost ?? 0;

  rpmBadge.textContent = `Devir: ${Math.round(store.rpm).toLocaleString('tr-TR')}`;
  powerBadge.textContent = `Güç: ${store.units === 'imperial' ? (powerKw * 1.34102).toFixed(1) + ' hp' : powerKw.toFixed(1) + ' kW'}`;
  torqueBadge.textContent = `Tork: ${store.units === 'imperial' ? (torqueNm * 0.73756).toFixed(1) + ' lb-ft' : torqueNm.toFixed(1) + ' Nm'}`;
  boostBadge.textContent = `Turbo: ${boost.toFixed(2)} bar`;
  tempBadge.textContent = `Su: ${Math.round(snap.temperature)}°C`;
  afrBadge.textContent = `AFR: ${s ? (14.7 * s.lambda).toFixed(1) : '--.-'}`;
  knockBadge.textContent = `Vuruntu: ${s ? Math.max(0, s.knockMargin).toFixed(1) : '--'}°`;
  gearBadge.textContent = `Vites: ${getGear(store.rpm)}`;
  vibBadge.textContent = `Titreşim: ${Math.round(snap.vibration * 100)}%`;
  fuelBadge.textContent = `Yakıt: ${snap.fuelRate.toFixed(1)} L/h`;
}

function getGear(rpm: number): string {
  if (rpm < 1200) return 'N';
  if (rpm < 3500) return '1';
  if (rpm < 5000) return '2';
  if (rpm < 6500) return '3';
  if (rpm < 8000) return '4';
  return '5';
}

function setupEngineControls(): void {
  btnStart?.addEventListener('click', () => startEngine());
  btnStop?.addEventListener('click', () => stopEngine());
  updateEngineControls();
}

function startEngine(): void {
  sound.resume();
  store.isRunning = true;
  if (store.rpm < 200) store.rpm = 200;
}

function stopEngine(): void {
  store.isRunning = false;
}

function updateEngineControls(): void {
  if (!btnStart || !btnStop) return;
  const running = store.isRunning;
  btnStart.classList.toggle('active', running);
  btnStop.classList.toggle('active', !running);
  btnStart.disabled = running;
  btnStop.disabled = !running;
}

function currentVisual(snap: EngineSnapshot): FaultVisual | null {
  const order: FaultVisual[] = ['stop', 'crack', 'shake', 'steam', 'smoke', 'spark'];
  let best: FaultVisual | null = null;
  let bestIdx = -1;
  for (const fid of snap.faults) {
    const v = faultVisualMap.get(fid);
    if (!v) continue;
    const idx = order.indexOf(v);
    if (idx > bestIdx) {
      best = v;
      bestIdx = idx;
    }
  }
  if (best === 'shake') return 'crack';
  return best;
}

function handleVisualEvent(event: SimEvent): void {
  const now = performance.now();

  if (event.type === 'combustion' && event.severity === 'info') {
    if (now - lastClickAt > 40) {
      lastClickAt = now;
      sound.click(0.35);
    }
  } else if (event.type === 'combustion' && event.severity === 'warning') {
    if (now - lastMisfireAt > 150) {
      lastMisfireAt = now;
      sound.click(0.9);
      sound.beep(220, 0.08);
    }
  } else if (event.severity === 'critical') {
    sound.beep(180, 0.3);
    sound.beep(140, 0.35);
  } else if (event.severity === 'warning' || event.severity === 'high' || event.severity === 'medium') {
    sound.beep(520, 0.12);
  }

  if (event.type === 'fault') {
    const visual = event.visual;
    if (event.faultId && event.title.startsWith('Giderildi')) {
      faultVisualMap.delete(event.faultId);
      if (faultVisualMap.size === 0) scene.clearBreakage();
    } else if (visual && event.faultId && !faultVisualMap.has(event.faultId)) {
      faultVisualMap.set(event.faultId, visual);
      if (visual === 'spark') scene.burstSpark(new THREE.Vector3(0, 0.8, 0));
      else if (visual === 'smoke') scene.emitSmoke(new THREE.Vector3(-1, 1.1, 0.6));
      else if (visual === 'steam') {
        scene.emitSteam(new THREE.Vector3(1.5, 0.6, -0.5));
        scene.emitSteam(new THREE.Vector3(-1.5, 0.6, -0.5));
      } else if (visual === 'crack' || visual === 'shake') {
        scene.showBreakage(visual);
        scene.burstSpark(new THREE.Vector3(0, 0.8, 0));
      }
      shakeAmount = visual === 'shake' ? 0.5 : 0.2;
    }
  }

  if (event.type === 'layout') {
    faultVisualMap.clear();
    scene.clearBreakage();
  }
  if (event.type === 'test') shakeAmount = 0.15;
}

function handlePeriodicEffects(snap: EngineSnapshot, dt: number): void {
  sparkCooldown -= dt;
  if (sparkCooldown > 0 || !snap.running) return;
  sparkCooldown = 0.15;

  if (snap.misfire.some(Boolean)) {
    const i = Math.floor(Math.random() * 6);
    scene.burstSpark(scene.getCylinderPosition(i));
  }
  if (snap.faults.includes('cloggedIntake') || snap.faults.includes('fouledPlugs')) {
    scene.emitSmoke(new THREE.Vector3(-1.8, 1.1, 0.6));
  }
  if (snap.temperature > 115 || snap.faults.includes('coolingLeak') || snap.faults.includes('overheat')) {
    scene.emitSteam(new THREE.Vector3(1.6, 0.7, -0.4));
  }
}

function handleWorkerResult(e: MessageEvent): void {
  const output = e.data;
  if (output.error) {
    console.error('[Worker] Error:', output.error);
    return;
  }

  const scale = sim ? sim.modifiers.power : 1;
  const scaled = new Map<number, any>();
  for (const [rpm, state] of output.curves as Map<number, any>) {
    scaled.set(rpm, { ...state, power: state.power * scale, torque: state.torque * scale });
  }
  store.results = scaled;

  const peakRpm = Array.from(scaled.keys()).reduce(
    (a, b) => (scaled.get(b)!.power > scaled.get(a)!.power ? b : a),
    scaled.keys().next().value ?? 0
  );
  updateDynoChart(scaled);
  updatePVChart(scaled.get(peakRpm)?.pvDiagram ?? []);
}

function runDynoSweep(rpmPoints: number[]): void {
  store.params.rpm = rpmPoints[0];
  const params: any = structuredClone(snapshot(store.params));
  params.throttle = 1;
  worker.postMessage({ params, rpmSweep: rpmPoints });
}

function onResize(): void {
  const width = app.clientWidth;
  const height = app.clientHeight;
  resizeRenderer(renderer, scene.camera, width, height);
}

init().catch(err => {
  console.error('Init failed:', err);
  loading.textContent = 'Başlatılamadı. Konsola bakın.';
  loading.style.color = '#ff4757';
});

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animationId);
  worker.terminate();
  sound.destroy();
  scene.dispose();
  renderer.dispose();
});
