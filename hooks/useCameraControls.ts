
import { useState, useCallback, useMemo } from 'react';
import { CameraControlState } from '../types';
import { DEFAULT_CAMERA_STATE } from '../constants';

export const useCameraControls = () => {
  const [state, setState] = useState<CameraControlState>(DEFAULT_CAMERA_STATE);
  const [past, setPast] = useState<CameraControlState[]>([]);
  const [future, setFuture] = useState<CameraControlState[]>([]);

  const updateState = useCallback((updates: Partial<CameraControlState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      const hasChanged = Object.entries(updates).some(([key, value]) => (prev as any)[key] !== value);
      
      if (hasChanged) {
        setPast(p => [...p, prev].slice(-50));
        setFuture([]);
      }
      return newState;
    });
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture(f => [state, ...f]);
    setPast(newPast);
    setState(previous);
  }, [past, state]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(p => [...p, state]);
    setFuture(newFuture);
    setState(next);
  }, [future, state]);

  const reset = useCallback(() => {
    setPast(p => [...p, state]);
    setFuture([]);
    setState(DEFAULT_CAMERA_STATE);
  }, [state]);

  const buildCameraPrompt = useCallback((s: CameraControlState): string => {
    const segments: string[] = [];
    
    // Глобальная установка на сохранение объектов
    segments.push("STRICT_COMPOSITION: Keep all visible props and held objects in frame.");

    if (s.floating) {
      segments.push("PHYSICS_OVERRIDE: Floating subject. 50cm offset. Maintain props integrity.");
    }

    if (s.rotate !== 0) {
      const direction = s.rotate > 0 ? "clockwise" : "counter-clockwise";
      segments.push(`ORBIT_TRANSFORM: Pivot ${Math.abs(s.rotate)} deg ${direction}. Keep subject and held items centered.`);
    }

    if (s.forward > 0) {
      segments.push(`DOLLY_ZOOM: Magnification level ${s.forward}. Ensure held items remain fully visible and in focus.`);
    }

    if (Math.abs(s.tilt) > 0.1) {
      segments.push(`PITCH_AXIS: Angle ${s.tilt}. Adjust perspective for subject and all interactive elements.`);
    }

    if (s.wideAngle) {
      segments.push("LENS_PROFILE: 14mm. Expand field of view to capture more of the environment and subject details.");
    }

    return segments.length > 1 ? segments.join(" ") : "no camera movement (identity and scene restoration mode)";
  }, []);

  const generatedPrompt = useMemo(() => buildCameraPrompt(state), [state, buildCameraPrompt]);

  return {
    state,
    updateState,
    reset,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    generatedPrompt
  };
};
