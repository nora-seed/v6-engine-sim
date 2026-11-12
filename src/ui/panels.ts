import { GUI } from 'dat.gui';
import { store, PARAM_BOUNDS, updateDisplacement } from './store';
import { EngineSound } from '../engine/sound';
import { PART_CATEGORIES, TEST_SCENARIOS } from '../sim/parts';
import { SimEngine } from '../sim/simEngine';
import { TurboParams } from '../engine/types';

let gui: GUI;
let sound: EngineSound;
let sim: SimEngine;

function defaultSweep(): number[] {
  const points: number[] = [];
  for (let r = 1000; r <= 8000; r += 250) points.push(r);
  return points;
}

function syncInduction(engineSim: SimEngine): void {
  const ind = engineSim.induction;
  if (ind === 'turbo' || ind === 'supercharged') {
    const target = ind === 'turbo' ? 0.6 : 0.4;
    if (!store.params.forcedInduction) {
      const turbo: TurboParams = {
        type: 'single',
        compressorTrim: ind === 'turbo' ? 58 : 50,
        compressorAR: 0.61,
        turbineAR: 0.82,
        wastegateSpring: ind === 'turbo' ? 14 : 8,
        intercoolerEff: 0.75,
        boostTarget: target,
        maxBoost: 2.5
      };
      store.params.forcedInduction = turbo;
    } else {
      store.params.forcedInduction.boostTarget = target;
    }
  } else {
    store.params.forcedInduction = null;
  }
  window.dispatchEvent(new CustomEvent('v6sim:dyno-sweep', { detail: defaultSweep() }));
}

export function createPanels(engineSound: EngineSound, engineSim: SimEngine): GUI {
  sound = engineSound;
  sim = engineSim;

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

  // ---- Parçalar ----
  const partState: Record<string, string> = {};
  const nameToId: Record<string, Record<string, string>> = {};
  for (const cat of PART_CATEGORIES) {
    nameToId[cat.id] = {};
    for (const o of cat.options) nameToId[cat.id][o.name] = o.id;
    const current = cat.options.find(o => o.id === sim.selected[cat.id]) ?? cat.options[0];
    partState[cat.id] = current.name;
  }

  const partsFolder = gui.addFolder('🔩 Parçalar');
  for (const cat of PART_CATEGORIES) {
    partsFolder
      .add(partState, cat.id, cat.options.map(o => o.name))
      .name(cat.name)
      .onChange((name: string) => {
        const id = nameToId[cat.id]?.[name];
        if (!id) return;
        sim.selectPart(cat.id, id);
        syncInduction(sim);
      });
  }
  partsFolder.open();

  // ---- Testler ----
  const testsFolder = gui.addFolder('🧪 Testler');
  for (const t of TEST_SCENARIOS) {
    testsFolder.add({ run: () => sim.runTest(t.id) }, 'run').name(t.name);
  }
  testsFolder.open();

  // ---- Motor ----
  const engineFolder = gui.addFolder('⚙️ Motor');
  engineFolder.add(store.params.geometry, 'bore', PARAM_BOUNDS.bore.min, PARAM_BOUNDS.bore.max, PARAM_BOUNDS.bore.step).name('Çap (mm)').onChange(updateDisplacement);
  engineFolder.add(store.params.geometry, 'stroke', PARAM_BOUNDS.stroke.min, PARAM_BOUNDS.stroke.max, PARAM_BOUNDS.stroke.step).name('Strok (mm)').onChange(updateDisplacement);
  engineFolder.add(store.params.geometry, 'rodLength', PARAM_BOUNDS.rodLength.min, PARAM_BOUNDS.rodLength.max, PARAM_BOUNDS.rodLength.step).name('Biyel Boyu');
  engineFolder.add(store.params.geometry, 'compressionRatio', PARAM_BOUNDS.compressionRatio.min, PARAM_BOUNDS.compressionRatio.max, PARAM_BOUNDS.compressionRatio.step).name('Sıkıştırma');
  engineFolder.add(store.params.geometry, 'vAngle', PARAM_BOUNDS.vAngle.min, PARAM_BOUNDS.vAngle.max, PARAM_BOUNDS.vAngle.step).name('V Açısı');
  engineFolder.add(store.params.geometry, 'crankType', ['flat', 'cross']).name('Krank Tipi').onChange(rebuildEngine);
  engineFolder.add(store.params, 'ignitionAdvance', PARAM_BOUNDS.ignitionAdvance.min, PARAM_BOUNDS.ignitionAdvance.max, PARAM_BOUNDS.ignitionAdvance.step).name('Ateşleme Avansı');
  engineFolder.add(store.params, 'injectionTiming', PARAM_BOUNDS.injectionTiming.min, PARAM_BOUNDS.injectionTiming.max, PARAM_BOUNDS.injectionTiming.step).name('Enjeksiyon Zamanı');
  engineFolder.add(store.params, 'vvtIntake', PARAM_BOUNDS.vvtIntake.min, PARAM_BOUNDS.vvtIntake.max, PARAM_BOUNDS.vvtIntake.step).name('VVT Emme');
  engineFolder.add(store.params, 'vvtExhaust', PARAM_BOUNDS.vvtExhaust.min, PARAM_BOUNDS.vvtExhaust.max, PARAM_BOUNDS.vvtExhaust.step).name('VVT Egzoz');
  engineFolder.add(store.params, 'afrTarget', PARAM_BOUNDS.afrTarget.min, PARAM_BOUNDS.afrTarget.max, PARAM_BOUNDS.afrTarget.step).name('Lambda Hedefi');
  engineFolder.add(store.params, 'octane', PARAM_BOUNDS.octane.min, PARAM_BOUNDS.octane.max, PARAM_BOUNDS.octane.step).name('Oktan (RON)');
  engineFolder.open();

  // ---- Turbo ----
  const turbo = store.params.forcedInduction;
  if (turbo) {
    const turboFolder = gui.addFolder('🌀 Turbo');
    turboFolder.add(turbo, 'type', ['single', 'twin']).name('Konfigürasyon').onChange(rebuildTurbo);
    turboFolder.add(turbo, 'compressorTrim', PARAM_BOUNDS.compressorTrim.min, PARAM_BOUNDS.compressorTrim.max, PARAM_BOUNDS.compressorTrim.step).name('Kompresör Trim');
    turboFolder.add(turbo, 'compressorAR', PARAM_BOUNDS.compressorAR.min, PARAM_BOUNDS.compressorAR.max, PARAM_BOUNDS.compressorAR.step).name('Kompresör A/R');
    turboFolder.add(turbo, 'turbineAR', PARAM_BOUNDS.turbineAR.min, PARAM_BOUNDS.turbineAR.max, PARAM_BOUNDS.turbineAR.step).name('Türbin A/R');
    turboFolder.add(turbo, 'wastegateSpring', PARAM_BOUNDS.wastegateSpring.min, PARAM_BOUNDS.wastegateSpring.max, PARAM_BOUNDS.wastegateSpring.step).name('Wastegate (psi)');
    turboFolder.add(turbo, 'intercoolerEff', PARAM_BOUNDS.intercoolerEff.min, PARAM_BOUNDS.intercoolerEff.max, PARAM_BOUNDS.intercoolerEff.step).name('Intercooler Verimi');
    turboFolder.add(turbo, 'boostTarget', PARAM_BOUNDS.boostTarget.min, PARAM_BOUNDS.boostTarget.max, PARAM_BOUNDS.boostTarget.step).name('Boost Hedefi');
    turboFolder.add(turbo, 'maxBoost', 1.5, 4.0, 0.05).name('Maks Boost');
    turboFolder.open();
  }

  // ---- Dyno ----
  const dynoFolder = gui.addFolder('📊 Dyno');
  dynoFolder.add(store, 'rpm', PARAM_BOUNDS.rpm.min, PARAM_BOUNDS.rpm.max, PARAM_BOUNDS.rpm.step).name('Devir').listen();
  dynoFolder.add(store, 'targetRpm', PARAM_BOUNDS.rpm.min, PARAM_BOUNDS.rpm.max, PARAM_BOUNDS.rpm.step).name('Hedef Devir');
  dynoFolder.add(store, 'throttle', PARAM_BOUNDS.throttle.min, PARAM_BOUNDS.throttle.max, PARAM_BOUNDS.throttle.step).name('Gaz').listen();
  dynoFolder.add(store.params, 'rpm', 500, 9000, 10).name('Sim Devir');
  dynoFolder.add({ runSweep: () => runDynoSweep() }, 'runSweep').name('▶ Devir Taraması');
  dynoFolder.add({ exportCSV: () => exportDynoCSV() }, 'exportCSV').name('💾 CSV İndir');
  dynoFolder.open();

  // ---- Ortam ----
  const ambFolder = gui.addFolder('🌡️ Ortam');
  ambFolder.add(store.params.ambient, 'temperature', PARAM_BOUNDS.temperature.min, PARAM_BOUNDS.temperature.max, PARAM_BOUNDS.temperature.step).name('Sıcaklık');
  ambFolder.add(store.params.ambient, 'pressure', PARAM_BOUNDS.pressure.min, PARAM_BOUNDS.pressure.max, PARAM_BOUNDS.pressure.step).name('Basınç');
  ambFolder.add(store.params.ambient, 'humidity', PARAM_BOUNDS.humidity.min, PARAM_BOUNDS.humidity.max, PARAM_BOUNDS.humidity.step).name('Nem');
  ambFolder.add(store.params.ambient, 'altitude', PARAM_BOUNDS.altitude.min, PARAM_BOUNDS.altitude.max, PARAM_BOUNDS.altitude.step).name('Rakım');
  ambFolder.open();

  // ---- Görünüm ----
  const viewState = { layout: sim.layout as string, cutaway: false };
  const visFolder = gui.addFolder('🎨 Görünüm');
  visFolder.add(viewState, 'layout', ['inline6', 'v6']).name('Motor Düzeni').onChange((v: string) => {
    window.dispatchEvent(new CustomEvent('v6sim:layout', { detail: v }));
  });
  visFolder.add(viewState, 'cutaway').name('Kesit Görünümü').onChange((v: boolean) => {
    window.dispatchEvent(new CustomEvent('v6sim:cutaway', { detail: v }));
  });
  visFolder.add(store, 'showPV').name('PV Diyagramı');
  visFolder.add(store, 'showWireframe').name('Tel Kafes').onChange((v: boolean) => setWireframe(v));
  visFolder.add(store, 'showXRay').name('X-Ray').onChange((v: boolean) => setXRay(v));
  visFolder.add(store, 'units', ['metric', 'imperial']).name('Birimler');
  visFolder.add(store, 'theme', ['dark', 'light']).name('Tema').onChange(applyTheme);
  visFolder.add(store, 'soundEnabled').name('Ses').onChange((v: boolean) => { sound?.setMasterVolume(v ? 0.35 : 0); });
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
    const svg = toggleBtn.querySelector('svg');
    if (svg) svg.style.transform = gui.domElement.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0)';
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

function runDynoSweep(): void {
  const btn = (gui.__controllers.find((c: { property: string }) => c.property === 'runSweep') as unknown as { __li?: HTMLElement })?.__li?.querySelector('button');
  if (btn) {
    btn.textContent = '⏳ Çalışıyor...';
    btn.disabled = true;
  }

  const rpmPoints = defaultSweep();
  store.params.rpm = rpmPoints[0];
  window.dispatchEvent(new CustomEvent('v6sim:dyno-sweep', { detail: rpmPoints }));

  setTimeout(() => {
    if (btn) {
      btn.textContent = '▶ Devir Taraması';
      btn.disabled = false;
    }
  }, 3000);
}

function exportDynoCSV(): void {
  const results = store.results;
  if (!results.size) {
    alert('Dyno verisi yok. Önce bir tarama çalıştırın.');
    return;
  }

  let csv = 'RPM,Tork(Nm),Güç(kW),BMEP(bar),BSFC(g/kWh),EGT(°C),Boost(bar),Lambda,KnockMargin(°),VE(%)';
  for (const [rpm, s] of results) {
    csv += `\n${rpm},${s.torque.toFixed(1)},${s.power.toFixed(1)},${s.bmep.toFixed(2)},${s.bsfc.toFixed(1)},${s.egt.toFixed(1)},${s.boost.toFixed(2)},${s.lambda.toFixed(2)},${s.knockMargin.toFixed(1)},${(s.volumetricEff * 100).toFixed(1)}`;
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `v6sim_dyno_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
