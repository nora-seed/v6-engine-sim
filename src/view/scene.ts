import * as THREE from 'three';
import { V6Engine } from '../engine/v6';
import { EngineGeometry } from '../engine/types';

export class EngineScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public engine: V6Engine;
  public lights: THREE.Light[] = [];

  public sparkPlugs: THREE.Mesh[] = [];
  public sparkMaterials: THREE.MeshBasicMaterial[] = [];
  private crankAngle = 0;
  public renderer: THREE.WebGLRenderer | null = null;

  constructor(private container: HTMLElement, geometry: EngineGeometry) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1b2a);
    this.scene.fog = new THREE.FogExp2(0x0d1b2a, 0.0015);

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 5000);
    this.camera.position.set(0, 200, 600);

    this.engine = new V6Engine(geometry);
    this.scene.add(this.engine.group);

    this.setupLights();
    this.setupEnvironment();
    this.extractSparkPlugs();
    this.addGrid();
  }

  private setupLights(): void {
    const keyLight = new THREE.DirectionalLight(0xffffee, 2.5);
    keyLight.position.set(300, 500, 400);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 100;
    keyLight.shadow.camera.far = 1500;
    keyLight.shadow.camera.left = -400;
    keyLight.shadow.camera.right = 400;
    keyLight.shadow.camera.top = 400;
    keyLight.shadow.camera.bottom = -400;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);
    this.lights.push(keyLight);

    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.8);
    fillLight.position.set(-200, 100, -300);
    this.scene.add(fillLight);
    this.lights.push(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeecc, 0.6);
    rimLight.position.set(0, -200, -400);
    this.scene.add(rimLight);
    this.lights.push(rimLight);

    const ambient = new THREE.AmbientLight(0x223344, 1.2);
    this.scene.add(ambient);
    this.lights.push(ambient);

    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight(0xffee88, 0, 150, 2);
      pl.visible = false;
      this.scene.add(pl);
      this.lights.push(pl);
    }
  }

  private setupEnvironment(): void {
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -250;
    ground.receiveShadow = true;
    this.scene.add(ground);

    if (this.renderer) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(1000, 32, 16);
      const skyMat = new THREE.MeshBasicMaterial({
        color: 0x1a2a3a,
        side: THREE.BackSide
      });
      const sky = new THREE.Mesh(skyGeo, skyMat);
      envScene.add(sky);
      this.scene.environment = pmrem.fromScene(envScene).texture;
      pmrem.dispose();
    }
  }

  public extractSparkPlugs(): void {
    this.engine.cylinders.forEach(cyl => {
      cyl.group.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) {
          const mat = obj.material as THREE.MeshStandardMaterial;
          if (mat.color.getHex() === 0xf0e0a0) {
            this.sparkPlugs.push(obj);
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0 });
            obj.material = sparkMat;
            this.sparkMaterials.push(sparkMat);
          }
        }
      });
    });
  }

  private addGrid(): void {
    const grid = new THREE.GridHelper(1000, 50, 0x1e3a5f, 0x1e3a5f);
    grid.position.y = -250;
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    this.scene.add(grid);
  }

  setRenderer(r: THREE.WebGLRenderer) { this.renderer = r; }

  update(crankAngle: number, vvtIntake: number, vvtExhaust: number, ignitionTiming: number): void {
    this.crankAngle = crankAngle;
    this.engine.update(crankAngle, vvtIntake, vvtExhaust);

    const deg = (crankAngle * 180 / Math.PI) % 720;
    this.sparkPlugs.forEach((plug, i) => {
      const cylPhase = this.engine.getCylinderPhase(i) * 180 / Math.PI;
      const fireAngle = (cylPhase - ignitionTiming + 720) % 720;
      const diff = (deg - fireAngle + 360) % 720;
      const mat = this.sparkMaterials[i];
      if (diff < 3) {
        mat.opacity = 1 - diff / 3;
        plug.scale.setScalar(1 + mat.opacity * 0.5);
        const light = this.lights[3 + i] as THREE.PointLight;
        light.position.copy(plug.getWorldPosition(new THREE.Vector3()));
        light.intensity = mat.opacity * 500;
        light.visible = true;
      } else {
        mat.opacity = 0;
        plug.scale.setScalar(1);
        (this.lights[3 + i] as THREE.PointLight).visible = false;
      }
    });
  }

  setWireframe(on: boolean): void {
    this.engine.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.material.wireframe = on;
      }
    });
  }

  setXRay(on: boolean): void {
    this.engine.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        if (on) {
          mat.transparent = true;
          mat.opacity = 0.25;
          mat.depthWrite = false;
        } else {
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
        }
        mat.needsUpdate = true;
      }
    });
  }

  dispose(): void {
    this.engine.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this.lights.forEach(l => l.dispose?.());
  }
}