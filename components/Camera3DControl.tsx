
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

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const activePresetLabel = useMemo(() => {
    return PRESET_LIST.find(p => p.id === activePreset)?.label || 'Стандарт';
  }, [activePreset]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear container to prevent duplicate canvases in Strict Mode
    containerRef.current.innerHTML = '';

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(12, 10, 12);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const grid = new THREE.GridHelper(30, 30, 0x151515, 0x0a0a0a);
    scene.add(grid);

    // Light setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Subject Plane
    const photoMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      side: THREE.DoubleSide, 
      transparent: true, 
      opacity: 0.9 
    });
    const photoPlane = new THREE.Mesh(new THREE.PlaneGeometry(4, 5.5), photoMat);
    scene.add(photoPlane);
    photoPlaneRef.current = photoPlane;

    // Camera Model (Helper)
    const cameraGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cameraGroup.add(body);
    
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.5;
    cameraGroup.add(lens);
    
    scene.add(cameraGroup);
    modelCameraRef.current = cameraGroup;

    // Laser Line (Focus Indicator)
    const laserMat = new THREE.LineBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.4 });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,10)]);
    const laser = new THREE.Line(laserGeo, laserMat);
    cameraGroup.add(laser);

    // Interaction logic
    let isDragging = false;
    let prevX = 0, prevY = 0;

    const onStart = (x: number, y: number) => { 
      isDragging = true; 
      prevX = x; 
      prevY = y; 
    };

    const onMove = (x: number, y: number) => {
      if (!isDragging) return;
      const dx = x - prevX;
      const dy = y - prevY;
      
      onChange({ 
        rotate: Math.max(ROTATE_LIMITS.min, Math.min(ROTATE_LIMITS.max, stateRef.current.rotate + dx * 0.4)),
        tilt: Math.max(TILT_LIMITS.min, Math.min(TILT_LIMITS.max, stateRef.current.tilt - dy * 0.01))
      });
      
      prevX = x; 
      prevY = y;
    };

    const handleTouch = (e: TouchEvent) => {
      onMove(e.touches[0].clientX, e.touches[0].clientY);
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

    // Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries[0] || !cameraRef.current || !rendererRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationId);
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
    if (modelCameraRef.current) {
      const angle = THREE.MathUtils.degToRad(state.rotate);
      const dist = 10 - state.forward * 0.6;
      modelCameraRef.current.position.set(
        Math.sin(angle) * dist, 
        state.tilt * 6, 
        Math.cos(angle) * dist
      );
      modelCameraRef.current.lookAt(0, 0, 0);
    }
  }, [state]);

  // Load source image texture
  useEffect(() => {
    if (sourceImage && photoPlaneRef.current) {
      new THREE.TextureLoader().load(sourceImage.base64, (tex) => {
        if (photoPlaneRef.current) {
          const mat = photoPlaneRef.current.material as THREE.MeshBasicMaterial;
          mat.map = tex;
          mat.needsUpdate = true;
        }
      });
    }
  }, [sourceImage]);

  return (
    <div className="w-full h-full relative group bg-[#050505]">
      <div ref={containerRef} className="w-full h-full cursor-move touch-none" />
      
      {/* Legend - Top Left */}
      <div className="absolute top-6 left-6 flex flex-col gap-2.5 pointer-events-none select-none">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-2.5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00FF9C] shadow-[0_0_8px_rgba(0,255,156,0.6)]" />
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Rotation (↔)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#FF00A6] shadow-[0_0_8px_rgba(255,0,166,0.6)]" />
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Vertical Tilt (↕)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#FFA500] shadow-[0_0_8px_rgba(255,165,0,0.6)]" />
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Distance / Zoom</span>
          </div>
        </div>
      </div>

      {/* Preset Label - Bottom Center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-2xl border border-white/10 px-8 py-2.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <span className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-orange-500 whitespace-nowrap">
            {activePresetLabel}
          </span>
        </div>
      </div>

      {/* Status - Top Right */}
      <div className="absolute top-6 right-6 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,1)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-orange-500/80">3D Stage v3</span>
        </div>
      </div>
    </div>
  );
};
