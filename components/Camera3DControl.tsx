import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { CameraControlState, ImageData, CameraPreset } from '../types';
import { ROTATE_LIMITS, TILT_LIMITS, PRESET_LIST } from '../constants';

interface Props {
  state: CameraControlState;
  sourceImage: ImageData | null;
  onChange: (updates: Partial<CameraControlState>) => void;
  activePreset?: CameraPreset;
}

export const Camera3DControl: React.FC<Props> = ({ state, sourceImage, onChange, activePreset }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelCameraRef = useRef<THREE.Group | null>(null);
  const photoPlaneRef = useRef<THREE.Mesh | null>(null);
  const keyLightRef = useRef<THREE.PointLight | null>(null);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const activePresetLabel = useMemo(() => {
    return PRESET_LIST.find(p => p.id === activePreset)?.label || 'Стандарт';
  }, [activePreset]);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 10, 50);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(15, 12, 15);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Floor with reflections and shadows
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x080808,
      roughness: 0.2,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(40, 40, 0x222222, 0x111111);
    scene.add(grid);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    topLight.position.set(0, 20, 0);
    topLight.castShadow = true;
    scene.add(topLight);

    const keyLight = new THREE.PointLight(0xffa500, 25, 30);
    keyLight.castShadow = true;
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    // Subject Plane
    const photoMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.95,
      roughness: 1,
      metalness: 0
    });
    const photoPlane = new THREE.Mesh(new THREE.PlaneGeometry(4, 5.5), photoMat);
    photoPlane.position.y = 2.75;
    photoPlane.castShadow = true;
    scene.add(photoPlane);
    photoPlaneRef.current = photoPlane;

    // Camera Model
    const cameraGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    cameraGroup.add(body);
    
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8), new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.6;
    cameraGroup.add(lens);
    
    // Volumetric Frustum (FOV visualizer)
    const frustumCam = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    const frustumHelper = new THREE.CameraHelper(frustumCam);
    (frustumHelper.material as THREE.Material).transparent = true;
    (frustumHelper.material as THREE.Material).opacity = 0.3;
    cameraGroup.add(frustumHelper);
    (cameraGroup as any).frustumCam = frustumCam;
    
    scene.add(cameraGroup);
    modelCameraRef.current = cameraGroup;

    // Laser Line
    const laserMat = new THREE.LineBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.2 });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0.6), new THREE.Vector3(0,0,15)]);
    const laser = new THREE.Line(laserGeo, laserMat);
    cameraGroup.add(laser);

    // Interaction logic
    let isDragging = false;
    let prevX = 0, prevY = 0;

    const onStart = (x: number, y: number) => { isDragging = true; prevX = x; prevY = y; };
    const onMove = (x: number, y: number) => {
      if (!isDragging) return;
      const dx = x - prevX;
      const dy = y - prevY;
      onChange({ 
        rotate: Math.max(ROTATE_LIMITS.min, Math.min(ROTATE_LIMITS.max, stateRef.current.rotate + dx * 0.4)),
        tilt: Math.max(TILT_LIMITS.min, Math.min(TILT_LIMITS.max, stateRef.current.tilt - dy * 0.01))
      });
      prevX = x; prevY = y;
    };

    const el = renderer.domElement;
    el.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    el.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
    
    const moveHandler = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const touchMoveHandler = (e: TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY);
    const endHandler = () => { isDragging = false; };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('touchmove', touchMoveHandler);
    window.addEventListener('mouseup', endHandler);
    window.addEventListener('touchend', endHandler);

    const animate = () => {
      requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries[0] || !cameraRef.current || !rendererRef.current) return;
      const { width, height } = entries[0].contentRect;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('touchmove', touchMoveHandler);
      window.removeEventListener('mouseup', endHandler);
      window.removeEventListener('touchend', endHandler);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [onChange]);

  // Sync state to 3D model
  useEffect(() => {
    if (modelCameraRef.current && keyLightRef.current) {
      const angle = THREE.MathUtils.degToRad(state.rotate);
      const dist = 12 - state.forward * 0.8;
      const yPos = 2.75 + state.tilt * 8;
      
      modelCameraRef.current.position.set(Math.sin(angle) * dist, yPos, Math.cos(angle) * dist);
      modelCameraRef.current.lookAt(0, 2.75, 0);
      
      // Sync Key Light to Camera position
      keyLightRef.current.position.copy(modelCameraRef.current.position);
      
      // Update FOV indicator
      const frustumCam = (modelCameraRef.current as any).frustumCam as THREE.PerspectiveCamera;
      if (frustumCam) {
        frustumCam.fov = state.wideAngle ? 95 : 45;
        frustumCam.updateProjectionMatrix();
        // Update helper if it exists as the second child
        const helper = modelCameraRef.current.children.find(c => c instanceof THREE.CameraHelper);
        if (helper) (helper as THREE.CameraHelper).update();
      }

      // Physics Override: Floating Subject
      if (photoPlaneRef.current) {
        photoPlaneRef.current.position.y = state.floating ? 4.5 : 2.75;
      }
    }
  }, [state]);

  useEffect(() => {
    if (sourceImage && photoPlaneRef.current) {
      new THREE.TextureLoader().load(sourceImage.base64, (tex) => {
        if (photoPlaneRef.current) {
          (photoPlaneRef.current.material as THREE.MeshStandardMaterial).map = tex;
          (photoPlaneRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
        }
      });
    }
  }, [sourceImage]);

  return (
    <div className="w-full h-full relative group bg-[#050505] overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-move touch-none" />
      
      {/* HUD: Interactive Gauges */}
      <div className="absolute top-6 left-6 flex flex-col gap-3 pointer-events-none select-none">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-5 space-y-3 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-[#00FF9C] shadow-[0_0_10px_rgba(0,255,156,0.8)]" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Azimuth</span>
              <span className="text-[10px] font-bold text-gray-200">{state.rotate.toFixed(0)}°</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-[#FF00A6] shadow-[0_0_10px_rgba(255,0,166,0.8)]" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Pitch</span>
              <span className="text-[10px] font-bold text-gray-200">{state.tilt.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Focus Distance</span>
              <span className="text-[10px] font-bold text-gray-200">{(12 - state.forward * 0.8).toFixed(1)}m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Label */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-orange-600/10 backdrop-blur-3xl border border-orange-500/20 px-10 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-[11px] font-mono font-black uppercase tracking-[0.4em] text-orange-500">
            {activePresetLabel}
          </span>
        </div>
      </div>

      {/* Lens Metadata */}
      <div className="absolute top-6 right-6 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl flex flex-col items-end gap-1">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500">Optics Profile</span>
          <span className="text-[10px] font-black uppercase text-white tracking-widest">
            {state.wideAngle ? '14mm Ultra-Wide' : '50mm Prime'}
          </span>
          <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-500" 
              style={{ width: state.wideAngle ? '100%' : '40%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
