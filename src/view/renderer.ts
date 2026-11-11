import * as THREE from 'three';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const ctx = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false
  });

  if (!ctx) {
    throw new Error('WebGL2 not supported. Falling back to WebGL1...');
  }

  const renderer = new THREE.WebGLRenderer({ canvas, context: ctx });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    console.warn('[WebGL] Context lost, attempting restore...');
    setTimeout(() => renderer.forceContextRestore(), 1000);
  }, false);

  return renderer;
}

export function setupSafariFixes(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  const ext = {
    derivatives: gl.getExtension('OES_standard_derivatives'),
    instancedArrays: gl.getExtension('ANGLE_instanced_arrays'),
    uintIndex: gl.getExtension('OES_element_index_uint'),
    depthTexture: gl.getExtension('WEBGL_depth_texture'),
    drawBuffers: gl.getExtension('WEBGL_draw_buffers'),
    colorBufferFloat: gl.getExtension('EXT_color_buffer_float')
  };
  console.log('[WebGL] Extensions:', Object.fromEntries(Object.entries(ext).map(([k, v]) => [k, !!v])));

  if (/iPhone|iPad|Mac/i.test(navigator.userAgent)) {
    renderer.getContext().hint(gl.GENERATE_MIPMAP_HINT, gl.FASTEST);
  }
}

export function resizeRenderer(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, width: number, height: number): void {
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}