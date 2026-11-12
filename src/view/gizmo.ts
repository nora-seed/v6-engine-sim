import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createControls(camera: THREE.Camera, canvas: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = true;
  controls.panSpeed = 0.8;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.0;
  controls.minDistance = 2.5;
  controls.maxDistance = 16;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.minPolarAngle = 0.05;
  controls.target.set(0, 0.4, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;

  canvas.style.touchAction = 'none';
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1) e.preventDefault();
  }, { passive: false });

  let idleTimer: number;
  controls.addEventListener('start', () => clearTimeout(idleTimer));
  controls.addEventListener('end', () => {
    idleTimer = window.setTimeout(() => { controls.autoRotate = true; controls.autoRotateSpeed = 0.3; }, 3000);
  });

  return controls;
}

export function createTransformGizmo(camera: THREE.Camera, canvas: HTMLCanvasElement): Promise<any> {
  return import('three/examples/jsm/controls/TransformControls.js').then(({ TransformControls }) => {
    const gizmo = new TransformControls(camera, canvas);
    gizmo.setMode('rotate');
    gizmo.setSize(1);
    gizmo.addEventListener('dragging-changed', e => {
      const controls = (window as any).__v6sim_orbit;
      if (controls) controls.enabled = !e.value;
    });
    return gizmo;
  });
}