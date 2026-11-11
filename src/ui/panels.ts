import { GUI } from 'dat.gui';
import { store, PARAM_BOUNDS, updateDisplacement } from './store';
import { EngineSound } from '../engine/sound';

let gui: GUI;
let sound: EngineSound;

export function createPanels(engineSound: EngineSound): GUI {
  sound = engineSound;
  gui = new GUI({ autoPlace: false, width: 340, closeOnTop: true });
  gui.domElement.id = 'dat-gui';
  gui.domElement.style.cssText = `
    position:fixed;top:calc(env(safe-area-inset-top,12px)+80px);right:16px;z-index:30;
    background:#11223a;border:1px solid #1e3a5f;border-radius:12px;
    box-shadow:0 8px 32px #00000080;backdrop-filter:blur(12px);
    font-family:'Space Grotesk',sans-serif;color:#e8f0f8;
    max-height:calc(100vh - 120px);overflow:auto;
  `;
  document.body.appendChild(gui.domElement);

  const style = document.createElement('style');
  style.textContent = `
    .dg.main{background:transparent!important;border:none!important}
    .dg .property-name{color:#e8f0f8!important;font-weight:500;font-size:13px}
    .dg input[type=text]{background:#0d1b2a!important;border:1px solid #1e3a5f!important;color:#e8f0f8!important}
    .dg .slider{background:#1e3a5f!important}
    .dg .slider-fg{background:#00d4aa!important}
    .dg .c{background:#11223a!important;border-top:1px solid #1e3a5f!important}
    .dg .closed .c{display:none}
    .dg .title{background:#0d1b2a!important;border-bottom:1px solid #1e3a5f!important;color:#00d4aa!important;font-weight:700;font-size:14px;padding:10px 12px}
    .dg .close-button{color:#e8f0f8!important}
  `;
  document.head.appendChild(style);

  const engineFolder = gui.addFolder('⚙️ Engine');
  engineFolder.add(store.params.geometry, 'bore', PARAM_BOUNDS.bore.min, PARAM_BOUNDS.bore.max, PARAM_BOUNDS.bore.step).name('Bore').onChange(updateDisplacement);
  engineFolder.add(store.params.geometry, 'stroke', PARAM_BOUNDS.stroke.min, PARAM_BOUNDS.stroke.max, PARAM_BOUNDS.stroke.step).name('Stroke').onChange(updateDisplacement);
  engineFolder.add(store.params.geometry, 'rodLength', PARAM_BOUNDS.rodLength.min, PARAM_BOUNDS.rodLength.max, PARAM_BOUNDS.rodLength.step).name('Rod Length');
  engineFolder.add(store.params.geometry, 'compressionRatio', PARAM_BOUNDS.compressionRatio.min, PARAM_BOUNDS.compressionRatio.max, PARAM_BOUNDS.compressionRatio.step).name('Comp Ratio');
  engineFolder.add(store.params.geometry, 'vAngle', PARAM_BOUNDS.vAngle.min, PARAM_BOUNDS.vAngle.max, PARAM_BOUNDS.vAngle.step).name('V-Angle');
  engineFolder.add(store.params.geometry, 'crankType', ['flat', 'cross']).name('Crank Type').onChange(rebuildEngine);
  engineFolder.add(store.params, 'ignitionAdvance', PARAM_BOUNDS.ignitionAdvance.min, PARAM_BOUNDS.ignitionAdvance.max, PARAM_BOUNDS.ignitionAdvance.step).name('Ignition Adv');
  engineFolder.add(store.params, 'injectionTiming', PARAM_BOUNDS.injectionTiming.min, PARAM_BOUNDS.injectionTiming.max, PARAM_BOUNDS.injectionTiming.step).name('Inj Timing');
  engineFolder.add(store.params, 'vvtIntake', PARAM_BOUNDS.vvtIntake.min, PARAM_BOUNDS.vvtIntake.max, PARAM_BOUNDS.vvtIntake.step).name('VVT Intake');
  engineFolder.add(store.params, 'vvtExhaust', PARAM_BOUNDS.vvtExhaust.min, PARAM_BOUNDS.vvtExhaust.max, PARAM_BOUNDS.vvtExhaust.step).name('VVT Exhaust');
  engineFolder.add(store.params, 'afrTarget', PARAM_BOUNDS.afrTarget.min, PARAM_BOUNDS.afrTarget.max, PARAM_BOUNDS.afrTarget.step).name('Lambda Target');
  engineFolder.add(store.params, 'octane', PARAM_BOUNDS.octane.min, PARAM_BOUNDS.octane.max, PARAM_BOUNDS.octane.step).name('Octane (RON)');
  engineFolder.open();

  const turboFolder = gui.addFolder('🌀 Turbo');
  const turbo = store.params.forcedInduction!;
  turboFolder.add(turbo, 'type', ['single', 'twin']).name('Configuration').onChange(rebuildTurbo);
  turboFolder.add(turbo, 'compressorTrim', PARAM_BOUNDS.compressorTrim.min, PARAM_BOUNDS.compressorTrim.max, PARAM_BOUNDS.compressorTrim.step).name('Comp Trim');
  turboFolder.add(turbo, 'compressorAR', PARAM_BOUNDS.compressorAR.min, PARAM_BOUNDS.compressorAR.max, PARAM_BOUNDS.compressorAR.step).name('Comp A/R');
  turboFolder.add(turbo, 'turbineAR', PARAM_BOUNDS.turbineAR.min, PARAM_BOUNDS.turbineAR.max, PARAM_BOUNDS.turbineAR.step).name('Turb A/R');
  turboFolder.add(turbo, 'wastegateSpring', PARAM_BOUNDS.wastegateSpring.min, PARAM_BOUNDS.wastegateSpring.max, PARAM_BOUNDS.wastegateSpring.step).name('WG Spring (psi)');
  turboFolder.add(turbo, 'intercoolerEff', PARAM_BOUNDS.intercoolerEff.min, PARAM_BOUNDS.intercoolerEff.max, PARAM_BOUNDS.intercoolerEff.step).name('IC Eff');
  turboFolder.add(turbo, 'boostTarget', PARAM_BOUNDS.boostTarget.min, PARAM_BOUNDS.boostTarget.max, PARAM_BOUNDS.boostTarget.step).name('Boost Target');
  turboFolder.add(turbo, 'maxBoost', 1.5, 4.0, 0.05).name('Max Boost (abs)');
  turboFolder.open();

  const dynoFolder = gui.addFolder('📊 Dyno');
  dynoFolder.add(store, 'rpm', PARAM_BOUNDS.rpm.min, PARAM_BOUNDS.rpm.max, PARAM_BOUNDS.rpm.step).name('RPM').listen();
  dynoFolder.add(store, 'targetRpm', PARAM_BOUNDS.rpm.min, PARAM_BOUNDS.rpm.max, PARAM_BOUNDS.rpm.step).name('Target RPM');
  dynoFolder.add(store, 'throttle', PARAM_BOUNDS.throttle.min, PARAM_BOUNDS.throttle.max, PARAM_BOUNDS.throttle.step).name('Throttle').listen();
  dynoFolder.add(store.params, 'rpm', 500, 9000, 10).name('Sim RPM');
  dynoFolder.add({ runSweep: () => runDynoSweep() }, 'runSweep').name('▶ Run RPM Sweep');
  dynoFolder.add({ exportCSV: () => exportDynoCSV() }, 'exportCSV').name('💾 Export CSV');
  dynoFolder.open();

  const ambFolder = gui.addFolder('🌡️ Ambient');
  ambFolder.add(store.params.ambient, 'temperature', PARAM_BOUNDS.temperature.min, PARAM_BOUNDS.temperature.max, PARAM_BOUNDS.temperature.step).name('Temperature');
  ambFolder.add(store.params.ambient, 'pressure', PARAM_BOUNDS.pressure.min, PARAM_BOUNDS.pressure.max, PARAM_BOUNDS.pressure.step).name('Pressure');
  ambFolder.add(store.params.ambient, 'humidity', PARAM_BOUNDS.humidity.min, PARAM_BOUNDS.humidity.max, PARAM_BOUNDS.humidity.step).name('Humidity');
  ambFolder.add(store.params.ambient, 'altitude', PARAM_BOUNDS.altitude.min, PARAM_BOUNDS.altitude.max, PARAM_BOUNDS.altitude.step).name('Altitude');
  ambFolder.open();

  const visFolder = gui.addFolder('🎨 Visual');
  visFolder.add(store, 'showPV').name('Show PV Diagram');
  visFolder.add(store, 'showWireframe').name('Wireframe').onChange((v: boolean) => setWireframe(v));
  visFolder.add(store, 'showXRay').name('X-Ray').onChange((v: boolean) => setXRay(v));
  visFolder.add(store, 'units', ['metric', 'imperial']).name('Units');
  visFolder.add(store, 'theme', ['dark', 'light']).name('Theme').onChange(applyTheme);
  visFolder.add(store, 'language', ['en', 'tr']).name('Language');
  visFolder.add(store, 'soundEnabled').name('Sound').onChange((v: boolean) => { sound?.setMasterVolume(v ? 0.35 : 0); });
  visFolder.open();

  window.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key.toLowerCase()) {
      case 'p': store.isRunning = !store.isRunning; break;
      case 'arrowup': store.targetRpm = Math.min(9000, store.targetRpm + 100); break;
      case 'arrowdown': store.targetRpm = Math.max(500, store.targetRpm - 100); break;
      case 'arrowright': store.throttle = Math.min(1, store.throttle + 0.05); break;
      case 'arrowleft': store.throttle = Math.max(0, store.throttle - 0.05); break;
      case ' ': e.preventDefault(); store.throttle = store.throttle > 0 ? 0 : 1; break;
      case 'm': store.soundEnabled = !store.soundEnabled; sound?.setMasterVolume(store.soundEnabled ? 0.35 : 0); break;
    }
  });

  const toggleBtn = document.getElementById('panelToggle');
  toggleBtn?.addEventListener('click', () => {
    gui.domElement.classList.toggle('hidden');
    toggleBtn.querySelector('svg')!.style.transform = gui.domElement.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0)';
  });

  return gui;
}

function rebuildEngine(): void {
  window.dispatchEvent(new CustomEvent('v6sim:rebuild-engine'));
}

function rebuildTurbo(): void {
  window.dispatchEvent(new CustomEvent('v6sim:rebuild-turbo'));
}

function setWireframe(on: boolean): void {
  window.dispatchEvent(new CustomEvent('v6sim:wireframe', { detail: on }));
}

function setXRay(on: boolean): void {
  window.dispatchEvent(new CustomEvent('v6sim:xray', { detail: on }));
}

function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.setAttribute('data-theme', theme);
}

async function runDynoSweep(): Promise<void> {
  const btn = (gui.__controllers.find((c: any) => c.property === 'runSweep') as any)?.__li?.querySelector('button');
  if (btn) { btn.textContent = '⏳ Running...'; btn.disabled = true; }

  const rpmPoints: number[] = [];
  for (let r = 1000; r <= 8000; r += 250) rpmPoints.push(r);

  store.params.rpm = rpmPoints[0];
  window.dispatchEvent(new CustomEvent('v6sim:dyno-sweep', { detail: rpmPoints }));

  setTimeout(() => {
    if (btn) { btn.textContent = '▶ Run RPM Sweep'; btn.disabled = false; }
  }, 3000);
}

function exportDynoCSV(): void {
  const results = store.results;
  if (!results.size) return alert('No dyno data. Run a sweep first.');

  let csv = 'RPM,Torque(Nm),Power(kW),BMEP(bar),BSFC(g/kWh),EGT(°C),Boost(bar),Lambda,KnockMargin(°),VE(%)';
  for (const [rpm, s] of results) {
    csv += `\n${rpm},${s.torque.toFixed(1)},${s.power.toFixed(1)},${s.bmep.toFixed(2)},${s.bsfc.toFixed(1)},${s.egt.toFixed(1)},${s.boost.toFixed(2)},${s.lambda.toFixed(2)},${s.knockMargin.toFixed(1)},${(s.volumetricEff*100).toFixed(1)}`;
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `v6sim_dyno_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}