import * as THREE from 'three';
import { createMaterials, setCutaway, setFaultHighlight, Materials } from '../scene/materials';
import { MotorModel } from '../scene/motorModel';
import { Effects } from '../scene/effects';
import { EngineSnapshot, PistonPhase, EngineLayout, FaultVisual } from '../sim/types';

export class EngineScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer | null = null;
  public materials: Materials;
  public model: MotorModel;
  public effects: Effects;
  public lights: THREE.Light[] = [];

  constructor(_container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.Fog(0x0d1117, 12, 34);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 100);
    this.camera.position.set(4.5, 3, 5.5);

    this.setupLights();
    this.setupGround();

    this.materials = createMaterials();
    this.model = new MotorModel(this.materials);
    this.scene.add(this.model.root);

    this.effects = new Effects(this.scene);
    this.effects.init();
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1510, 0.7);
    this.scene.add(hemi);
    this.lights.push(hemi);

    const key = new THREE.DirectionalLight(0xfff2e0, 2.2);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    this.scene.add(key);
    this.lights.push(key);

    const rim = new THREE.DirectionalLight(0x6699ff, 1.0);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);
    this.lights.push(rim);

    const fill = new THREE.PointLight(0xffaa66, 0.6, 20);
    fill.position.set(0, 2, 4);
    this.scene.add(fill);
    this.lights.push(fill);
  }

  private setupGround(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x161b22, metalness: 0.2, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.4;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(20, 40, 0x1e3a5f, 0x122a44);
    grid.position.y = -1.39;
    const gridMat = grid.material as THREE.Material;
    gridMat.opacity = 0.35;
    gridMat.transparent = true;
    this.scene.add(grid);
  }

  setRenderer(r: THREE.WebGLRenderer): void {
    this.renderer = r;
  }

  setLayout(layout: EngineLayout): void {
    this.model.setLayout(layout);
  }

  setCutaway(on: boolean): void {
    setCutaway(this.materials, on);
  }

  setFaultHighlight(visual: FaultVisual | null): void {
    setFaultHighlight(this.materials, visual);
  }

  setTurboRequired(required: boolean): void {
    this.model.setTurboRequired(required);
  }

  showBreakage(kind: 'crack' | 'shake'): void {
    this.model.showBreakage(kind);
  }

  clearBreakage(): void {
    this.model.clearBreakage();
  }

  burstSpark(pos: THREE.Vector3): void {
    this.effects.burstSpark(pos);
  }

  emitSmoke(pos: THREE.Vector3): void {
    this.effects.emitSmoke(pos);
  }

  emitSteam(pos: THREE.Vector3): void {
    this.effects.emitSteam(pos);
  }

  clearEffects(): void {
    this.effects.clear();
  }

  getCylinderPosition(index: number): THREE.Vector3 {
    return this.model.getCylinderPosition(index);
  }

  update(state: EngineSnapshot, phases: PistonPhase[], dt: number): void {
    this.model.update(state, phases, dt);
    this.model.updateBreakage(dt);
    this.effects.update(dt);
  }

  setWireframe(on: boolean): void {
    this.model.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial) m.wireframe = on;
        });
      }
    });
  }

  setXRay(on: boolean): void {
    this.model.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial && !m.transparent) {
            m.transparent = on;
            m.opacity = on ? 0.28 : 1;
            m.depthWrite = !on;
            m.needsUpdate = true;
          }
        });
      }
    });
  }

  dispose(): void {
    this.model.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    Object.values(this.materials).forEach(m => m.dispose());
    this.lights.forEach(l => l.dispose?.());
  }
}
