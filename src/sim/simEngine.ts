import { store } from '../ui/store';
import { PART_CATEGORIES, TEST_SCENARIOS, getFaultDef, TestConfig } from './parts';
import { EngineLayout, EngineSnapshot, PistonPhase, SimEvent } from './types';

const IDLE_RPM = 800;
const REDLINE = 7200;
const FIRING_INTERVAL = 720 / 6;

const INLINE6_FIRING_ORDER = [1, 5, 3, 6, 2, 4];
const V6_FIRING_ORDER = [1, 4, 2, 5, 3, 6];

interface Modifiers {
  power: number;
  durability: number;
  vibration: number;
  heat: number;
  friction: number;
  rpmLimit: number;
  valveTiming: number;
  ignitionReliability: number;
  fuel: number;
  boost: number;
  heatDissipation: number;
  turboLag: number;
  parasiticLoss: number;
}

function defaultModifiers(): Modifiers {
  return {
    power: 1,
    durability: 1,
    vibration: 1,
    heat: 1,
    friction: 1,
    rpmLimit: 1,
    valveTiming: 1,
    ignitionReliability: 1,
    fuel: 1,
    boost: 0,
    heatDissipation: 1,
    turboLag: 0,
    parasiticLoss: 0
  };
}

export class SimEngine {
  layout: EngineLayout = 'inline6';
  firingOrder: number[] = [...INLINE6_FIRING_ORDER];
  firingMap: Record<number, number> = {};
  selected: Record<string, string> = {};
  activeFaults = new Set<string>();
  injectedFaults = new Map<string, number>();
  modifiers: Modifiers = defaultModifiers();
  temperature = 20;
  vibration = 0;
  boost = 0;
  fuelRate = 0;
  rpmLimit = REDLINE;
  misfire: boolean[] = new Array(7).fill(false);
  lastFiredCyl: number | null = null;
  time = 0;
  test: TestConfig | null = null;
  testTimer = 0;
  onEvent: (e: SimEvent) => void = () => {};

  private misfireDecide = 0;
  private fireFlash = 0;
  private vibEventAt = 0;
  private revLimitAt = 0;
  private prevAngle = 0;

  constructor() {
    for (const cat of PART_CATEGORIES) {
      this.selected[cat.id] = cat.id === 'induction' ? 'turbo' : cat.options[0].id;
    }
    this.firingMap = this.buildFiringMap();
    this.refreshFaultsFromParts();
    this.modifiers = this.computeModifiers();
    this.recomputeLimits();
  }

  private buildFiringMap(): Record<number, number> {
    const map: Record<number, number> = {};
    this.firingOrder.forEach((cyl, idx) => {
      map[cyl] = idx * FIRING_INTERVAL;
    });
    return map;
  }

  private emit(event: SimEvent): void {
    this.onEvent(event);
  }

  setLayout(layout: EngineLayout): void {
    if (layout === this.layout) return;
    this.layout = layout;
    this.firingOrder = layout === 'v6' ? [...V6_FIRING_ORDER] : [...INLINE6_FIRING_ORDER];
    this.firingMap = this.buildFiringMap();
    this.misfire = new Array(7).fill(false);
    this.emit({
      type: 'layout',
      severity: 'info',
      title: 'Düzen değiştirildi',
      message:
        layout === 'v6'
          ? 'V6 düzenine geçildi (60° V açısı, ateşleme sırası 1-4-2-5-3-6).'
          : 'Sıralı 6 düzenine geçildi (720°, ateşleme sırası 1-5-3-6-2-4).'
    });
  }

  selectPart(categoryId: string, optionId: string): void {
    const cat = PART_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return;
    const opt = cat.options.find(o => o.id === optionId);
    if (!opt) return;

    const prev = this.selected[categoryId];
    if (prev === optionId) return;
    this.selected[categoryId] = optionId;

    this.refreshFaultsFromParts();
    this.modifiers = this.computeModifiers();
    this.recomputeLimits();

    this.emit({
      type: 'part',
      severity: opt.faults.length ? 'warning' : 'info',
      title: `${cat.name} → ${opt.name}`,
      message: opt.desc,
      partCategory: categoryId,
      optionId
    });

    const m = opt.modifiers;
    const lines: string[] = [];
    if (m.power && m.power !== 1) lines.push(`güç ×${m.power.toFixed(2)}`);
    if (m.vibration && m.vibration !== 1) lines.push(`titreşim ×${m.vibration.toFixed(2)}`);
    if (m.heat && m.heat !== 1) lines.push(`ısı ×${m.heat.toFixed(2)}`);
    if (m.boost) lines.push(`boost ${m.boost} bar`);
    if (lines.length) {
      this.emit({
        type: 'stats',
        severity: 'info',
        title: 'Etki hesaplandı',
        message: `Değişim etkisi: ${lines.join(', ')}.`
      });
    }

    for (const fid of opt.faults) this.raiseFault(fid, `Parça değişikliği: ${opt.name}`);
  }

  private refreshFaultsFromParts(): void {
    const fromParts = new Set<string>();
    for (const [catId, optId] of Object.entries(this.selected)) {
      const cat = PART_CATEGORIES.find(c => c.id === catId);
      const opt = cat?.options.find(o => o.id === optId);
      if (opt) for (const f of opt.faults) fromParts.add(f);
    }
    for (const f of [...this.activeFaults]) {
      if (!fromParts.has(f) && !this.injectedFaults.has(f)) this.activeFaults.delete(f);
    }
    for (const f of fromParts) this.activeFaults.add(f);
  }

  private computeModifiers(): Modifiers {
    const acc = defaultModifiers();
    for (const [catId, optId] of Object.entries(this.selected)) {
      const cat = PART_CATEGORIES.find(c => c.id === catId);
      const opt = cat?.options.find(o => o.id === optId);
      if (!opt) continue;
      for (const [k, v] of Object.entries(opt.modifiers)) {
        if (typeof v !== 'number') continue;
        const key = k as keyof Modifiers;
        if (key === 'boost') acc.boost = v;
        else if (typeof acc[key] === 'number') acc[key] *= v;
      }
    }
    return acc;
  }

  private recomputeLimits(): void {
    this.rpmLimit = Math.round(REDLINE * (this.modifiers.rpmLimit || 1));
  }

  private raiseFault(id: string, source: string): void {
    if (this.activeFaults.has(id)) return;
    this.activeFaults.add(id);
    const def = getFaultDef(id);
    this.emit({
      type: 'fault',
      severity: def.severity,
      title: `Arıza: ${def.name}`,
      message: `${def.message} (${source})`,
      faultId: id,
      visual: def.visual
    });
    this.modifiers = this.computeModifiers();
    this.recomputeLimits();
  }

  clearFault(id: string): void {
    if (!this.activeFaults.has(id)) return;
    let fromPart = false;
    for (const [catId, sel] of Object.entries(this.selected)) {
      const cat = PART_CATEGORIES.find(c => c.id === catId);
      const opt = cat?.options.find(o => o.id === sel);
      if (opt?.faults.includes(id)) fromPart = true;
    }
    if (fromPart) return;

    this.activeFaults.delete(id);
    this.injectedFaults.delete(id);
    const def = getFaultDef(id);
    this.emit({
      type: 'fault',
      severity: 'info',
      title: `Giderildi: ${def.name}`,
      message: 'Arıza geçici olarak giderildi.',
      faultId: id
    });
    this.modifiers = this.computeModifiers();
    this.recomputeLimits();
  }

  injectFault(id: string, durationSec: number): void {
    this.injectedFaults.set(id, this.time + durationSec);
    this.raiseFault(id, 'Test senaryosu');
  }

  runTest(scenarioId: string): void {
    const scen = TEST_SCENARIOS.find(s => s.id === scenarioId);
    if (!scen) return;
    const c = scen.config;

    if (!store.isRunning) store.isRunning = true;
    if (c.coldStart) this.temperature = 18;
    if (c.fault) this.injectFault(c.fault, c.faultDuration ?? 5);
    if (c.targetRpm !== undefined) store.targetRpm = c.targetRpm;
    if (c.throttle !== undefined) store.throttle = c.throttle;

    if (c.duration > 0) {
      this.test = { ...c };
      this.testTimer = c.duration;
    }

    this.emit({
      type: 'test',
      severity: 'info',
      title: 'Test başlatıldı',
      message: `${scen.name} – süre: ${c.duration || c.faultDuration || 5} sn.`
    });
  }

  get induction(): string {
    return this.selected.induction ?? 'na';
  }

  update(dt: number, angleDeg: number, boostNow: number): void {
    this.time += dt;

    for (const [id, end] of [...this.injectedFaults]) {
      if (this.time >= end) {
        this.injectedFaults.delete(id);
        this.clearFault(id);
      }
    }

    if (this.test) {
      this.testTimer -= dt;
      if (this.test.ramp && this.test.targetRpm !== undefined) {
        const dur = this.test.duration || 1;
        const progress = 1 - Math.max(0, this.testTimer / dur);
        const start = IDLE_RPM;
        store.targetRpm = start + (this.test.targetRpm - start) * progress;
        if (this.test.throttle !== undefined) store.throttle = this.test.throttle;
      } else {
        if (this.test.targetRpm !== undefined) store.targetRpm = this.test.targetRpm;
        if (this.test.throttle !== undefined) store.throttle = this.test.throttle;
      }
      if (this.testTimer <= 0) {
        this.test = null;
        store.targetRpm = IDLE_RPM;
        store.throttle = 0;
        this.emit({
          type: 'test',
          severity: 'success',
          title: 'Test tamamlandı',
          message: 'Motor rölantiye döndü.'
        });
      }
    }

    store.targetRpm = Math.max(IDLE_RPM, Math.min(this.rpmLimit, store.targetRpm));
    this.boost = boostNow;

    const rpm = store.rpm;
    const throttle = store.throttle;
    const running = store.isRunning;
    const rpmN = rpm / REDLINE;

    if (running && rpm >= this.rpmLimit - 5) {
      if (this.time - this.revLimitAt > 1.5) {
        this.revLimitAt = this.time;
        this.emit({
          type: 'revlimit',
          severity: 'warning',
          title: 'Devir kesici',
          message: `Kırmızı çizgi: ${this.rpmLimit} RPM – ateşleme kesildi.`
        });
      }
      this.fireFlash = 0.3;
    }
    if (this.fireFlash > 0) this.fireFlash -= dt;

    const heatGen = (running ? 1 : 0) * (0.5 + rpmN * 0.55 + throttle * 0.4) * this.modifiers.heat;
    const coolingCap = Math.max(0.2, this.modifiers.heatDissipation);
    const targetTemp = 25 + (heatGen * 60) / coolingCap;
    const coolRate = 0.06 * coolingCap;
    this.temperature += (targetTemp - this.temperature) * Math.min(1, coolRate * dt * 10);

    if (this.temperature > 130) {
      if (!this.activeFaults.has('overheat') && !this.injectedFaults.has('overheat')) {
        this.raiseFault('overheat', 'Termal sınır');
      }
    } else if (this.activeFaults.has('overheat') && this.temperature < 105 && !this.injectedFaults.has('overheat')) {
      this.clearFault('overheat');
    }
    if (this.temperature < 20) this.temperature = 20;

    this.fuelRate = running
      ? (2 + this.modifiers.power * 10 + (this.modifiers.fuel - 1) * 10) * 0.1 * (0.3 + throttle)
      : 0;

    const baseVib = 0.15 + rpmN * 0.4 + throttle * 0.25;
    const targetVib = Math.min(1.5, baseVib * this.modifiers.vibration);
    this.vibration += (targetVib - this.vibration) * Math.min(1, dt * 3);
    if (this.vibration > 0.9 && this.time - this.vibEventAt > 4) {
      this.vibEventAt = this.time;
      this.emit({
        type: 'vibration',
        severity: this.vibration > 1.1 ? 'warning' : 'info',
        title: 'Yüksek titreşim',
        message: `Titreşim seviyesi %${Math.round(this.vibration * 100)} – mekanik dengesizlik.`,
        visual: 'shake'
      });
    }

    if (this.time - this.misfireDecide > 0.5) {
      this.misfireDecide = this.time;
      const rel = this.activeFaults.has('misfire') || this.activeFaults.has('fouledPlugs');
      for (let c = 1; c <= 6; c++) this.misfire[c] = rel && Math.random() < 0.55;
    }

    this.detectFiring(angleDeg);
    this.prevAngle = ((angleDeg % 720) + 720) % 720;
  }

  private detectFiring(angleDeg: number): void {
    if (!store.isRunning || store.rpm < 50) return;
    for (let cyl = 1; cyl <= 6; cyl++) {
      const fireAt = this.firingMap[cyl] ?? 0;
      const d = (angleDeg - this.prevAngle + 720) % 720;
      const rel = (fireAt - this.prevAngle + 720) % 720;
      if (d > 0 && rel > 0 && rel <= d) {
        const isMis = this.misfire[cyl] || this.fireFlash > 0;
        if (isMis) {
          this.emit({
            type: 'combustion',
            severity: 'warning',
            silent: true,
            title: `Misfire #${cyl}`,
            message: `Silindir ${cyl} ateşleme atladı!`,
            cyl,
            visual: 'spark'
          });
        } else {
          this.lastFiredCyl = cyl;
          this.emit({
            type: 'combustion',
            severity: 'info',
            silent: true,
            title: `Ateşleme #${cyl}`,
            message: `Silindir ${cyl} ateşledi.`,
            cyl
          });
        }
      }
    }
  }

  pistonPhases(angleDeg: number): PistonPhase[] {
    const phases: PistonPhase[] = [];
    for (let c = 1; c <= 6; c++) {
      const fireAt = this.firingMap[c] ?? 0;
      const rel = (((angleDeg - fireAt) % 720) + 720) % 720;
      phases.push({
        cyl: c,
        angle: rel,
        pos: (1 - Math.cos((rel * Math.PI) / 180)) / 2,
        onPowerStroke: rel >= 0 && rel < 180,
        firing: rel < 8 && store.isRunning,
        misfire: this.misfire[c]
      });
    }
    return phases;
  }

  snapshot(angleDeg: number, boostNow: number): EngineSnapshot {
    return {
      rpm: store.rpm,
      torque: 0,
      power: 0,
      vibration: this.vibration,
      temperature: this.temperature,
      boost: boostNow,
      running: store.isRunning,
      crankAngle: angleDeg,
      throttle: store.throttle,
      faults: [...this.activeFaults],
      misfire: this.misfire.slice(1),
      lastFiredCyl: this.lastFiredCyl,
      layout: this.layout,
      firingOrder: [...this.firingOrder],
      rpmLimit: this.rpmLimit,
      fuelRate: this.fuelRate,
      time: this.time,
      targetRpm: store.targetRpm
    };
  }
}
