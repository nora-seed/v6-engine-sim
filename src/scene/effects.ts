import * as THREE from 'three';

interface Particle {
  life: number;
  maxLife: number;
  vel: THREE.Vector3;
  pos: THREE.Vector3;
  active: boolean;
}

interface ParticleSystem {
  points: THREE.Points;
  geo: THREE.BufferGeometry;
  mat: THREE.PointsMaterial;
  particles: Particle[];
  count: number;
  gravity: number;
  emitAcc: number;
}

interface SystemOptions {
  additive?: boolean;
  gravity?: number;
  spawnRate?: number;
}

export class Effects {
  private systems: ParticleSystem[] = [];
  private sparkSys!: ParticleSystem;
  private smokeSys!: ParticleSystem;
  private steamSys!: ParticleSystem;

  constructor(private scene: THREE.Scene) {}

  private makeSystem(color: number, size: number, count: number, opts: SystemOptions = {}): ParticleSystem {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) positions[i * 3 + 1] = -999;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({ life: 0, maxLife: 0, vel: new THREE.Vector3(), pos: new THREE.Vector3(), active: false });
    }

    const sys: ParticleSystem = {
      points,
      geo,
      mat,
      particles,
      count,
      gravity: opts.gravity ?? -1,
      emitAcc: 0
    };
    this.systems.push(sys);
    return sys;
  }

  init(): void {
    this.sparkSys = this.makeSystem(0xffcc44, 0.06, 120, { additive: true, gravity: -4 });
    this.smokeSys = this.makeSystem(0x555555, 0.14, 80, { gravity: 0.6 });
    this.steamSys = this.makeSystem(0xcfe8ff, 0.18, 90, { gravity: 1.2 });
  }

  private emit(sys: ParticleSystem, origin: THREE.Vector3, spread: THREE.Vector3, speed: number): void {
    for (let i = 0; i < sys.count; i++) {
      const p = sys.particles[i];
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.8;
      p.pos.copy(origin);
      p.pos.x += (Math.random() - 0.5) * spread.x;
      p.pos.y += (Math.random() - 0.5) * spread.y;
      p.pos.z += (Math.random() - 0.5) * spread.z;
      p.vel.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed,
        (Math.random() - 0.5) * speed
      );
      return;
    }
  }

  burstSpark(origin: THREE.Vector3): void {
    for (let i = 0; i < 12; i++) {
      this.emit(this.sparkSys, origin, new THREE.Vector3(0.1, 0.1, 0.1), 2.2);
    }
  }

  emitSmoke(origin: THREE.Vector3): void {
    this.emit(this.smokeSys, origin, new THREE.Vector3(0.3, 0.1, 0.3), 0.5);
  }

  emitSteam(origin: THREE.Vector3): void {
    this.emit(this.steamSys, origin, new THREE.Vector3(0.4, 0.2, 0.4), 0.8);
  }

  update(dt: number): void {
    for (const sys of this.systems) {
      const posAttr = sys.geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < sys.count; i++) {
        const p = sys.particles[i];
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          posAttr.setXYZ(i, 0, -999, 0);
          continue;
        }
        p.vel.y += sys.gravity * dt;
        p.pos.addScaledVector(p.vel, dt);
        posAttr.setXYZ(i, p.pos.x, p.pos.y, p.pos.z);
      }
      posAttr.needsUpdate = true;
      void sys.emitAcc;
    }
  }

  clear(): void {
    for (const sys of this.systems) {
      for (const p of sys.particles) p.active = false;
      const posAttr = sys.geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < sys.count; i++) posAttr.setXYZ(i, 0, -999, 0);
      posAttr.needsUpdate = true;
    }
  }
}
