import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MissionConfig, Instruction, ActiveTool, TelemetryData, KeyboardControlState } from './types';
import { calculateTotalTime, toRadians } from './simulator';

export interface LiveOffset {
  type: 'move' | 'rotate' | 'motor1' | 'motor2';
  value: number;
  speed: number;
  direction: number;
}

interface ActionDef {
  key: string;
  type: 'move' | 'rotate' | 'motor1' | 'motor2';
  direction: number;
  baseSpeed: number;
  description: string;
}

const KEY_ACTIONS: Record<string, ActionDef> = {
  KeyW: { key: 'KeyW', type: 'move', direction: 1, baseSpeed: 1000, description: 'Forward' },
  KeyS: { key: 'KeyS', type: 'move', direction: -1, baseSpeed: 1000, description: 'Backward' },
  KeyA: { key: 'KeyA', type: 'rotate', direction: -1, baseSpeed: 500, description: 'Rotate Left' },
  KeyD: { key: 'KeyD', type: 'rotate', direction: 1, baseSpeed: 500, description: 'Rotate Right' },
  KeyJ: { key: 'KeyJ', type: 'motor1', direction: -1, baseSpeed: 500, description: 'Left Arm CCW' },
  KeyU: { key: 'KeyU', type: 'motor1', direction: 1, baseSpeed: 500, description: 'Left Arm CW' },
  KeyL: { key: 'KeyL', type: 'motor2', direction: -1, baseSpeed: 500, description: 'Right Arm CCW' },
  KeyO: { key: 'KeyO', type: 'motor2', direction: 1, baseSpeed: 500, description: 'Right Arm CW' },
};

interface UseKeyboardControlProps {
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  mission: MissionConfig;
  setMission: React.Dispatch<React.SetStateAction<MissionConfig>>;
  telemetryRef: React.MutableRefObject<TelemetryData>;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  setActiveTool: (t: ActiveTool) => void;
}

export function useKeyboardControl({
  enabled,
  setEnabled,
  mission,
  setMission,
  telemetryRef,
  isPlaying,
  setIsPlaying,
  setActiveTool,
}: UseKeyboardControlProps) {
  const [controlState, setControlState] = useState<KeyboardControlState>({
    enabled,
    activeKey: null,
    activeType: null,
    direction: 0,
    accumulatedValue: 0,
    speedMultiplier: 1,
    currentSpeed: 1000,
  });

  const liveOffsetRef = useRef<LiveOffset | null>(null);

  const activeActionRef = useRef<{
    key: string;
    type: 'move' | 'rotate' | 'motor1' | 'motor2';
    direction: number;
    accumulated: number;
    baseSpeed: number;
    lastTimestamp: number;
  } | null>(null);

  const modifiersRef = useRef<{ shift: boolean; ctrl: boolean }>({
    shift: false,
    ctrl: false,
  });

  // Keep mission ref up to date
  const missionRef = useRef(mission);
  useEffect(() => {
    missionRef.current = mission;
  }, [mission]);

  const getSpeedMultiplier = useCallback(() => {
    let mult = 1.0;
    if (modifiersRef.current.shift) mult *= 2.0;
    if (modifiersRef.current.ctrl) mult *= 0.5;
    return mult;
  }, []);

  const completeCurrentAction = useCallback(() => {
    const act = activeActionRef.current;
    if (!act) return;

    activeActionRef.current = null;
    liveOffsetRef.current = null;

    const mult = getSpeedMultiplier();
    const recordedSpeed = Math.round(act.baseSpeed * mult);
    const isMove = act.type === 'move';
    const minThreshold = isMove ? 0.1 : 0.5;
    const val = act.accumulated;

    if (Math.abs(val) >= minThreshold) {
      const roundedVal = parseFloat(val.toFixed(1));
      const newInstruction: Instruction = {
        id: Math.random().toString(36).substring(2, 9),
        type: act.type,
        ...(isMove ? { distance: roundedVal } : { angle: roundedVal }),
        speed: recordedSpeed,
      };

      setMission(prev => {
        const nextInstructions = [...prev.instructions, newInstruction];
        const newTotal = calculateTotalTime(nextInstructions, prev.robotConfig);
        telemetryRef.current.time = newTotal;
        return {
          ...prev,
          instructions: nextInstructions,
        };
      });
    }

    setControlState(prev => ({
      ...prev,
      activeKey: null,
      activeType: null,
      direction: 0,
      accumulatedValue: 0,
    }));
  }, [getSpeedMultiplier, setMission, telemetryRef]);

  // Keep enabled state synced
  useEffect(() => {
    setControlState(prev => ({ ...prev, enabled }));
    if (enabled) {
      if (isPlaying) setIsPlaying(false);
      setActiveTool('none');
      const totalTime = calculateTotalTime(missionRef.current.instructions, missionRef.current.robotConfig);
      telemetryRef.current.time = totalTime;
    } else {
      completeCurrentAction();
    }
  }, [enabled]);

  const startAction = useCallback((key: string) => {
    const actionDef = KEY_ACTIONS[key];
    if (!actionDef) return;

    if (activeActionRef.current) {
      if (activeActionRef.current.key === key) return;
      completeCurrentAction();
    }

    // Ensure robot is at the end of path before moving
    const totalTime = calculateTotalTime(missionRef.current.instructions, missionRef.current.robotConfig);
    telemetryRef.current.time = totalTime;

    const mult = getSpeedMultiplier();
    const currentSpeed = Math.round(actionDef.baseSpeed * mult);

    activeActionRef.current = {
      key: actionDef.key,
      type: actionDef.type,
      direction: actionDef.direction,
      accumulated: 0,
      baseSpeed: actionDef.baseSpeed,
      lastTimestamp: performance.now(),
    };

    setControlState(prev => ({
      ...prev,
      activeKey: actionDef.key,
      activeType: actionDef.type,
      direction: actionDef.direction,
      accumulatedValue: 0,
      speedMultiplier: mult,
      currentSpeed,
    }));
  }, [completeCurrentAction, getSpeedMultiplier, telemetryRef]);

  const stopAction = useCallback((key: string) => {
    if (activeActionRef.current && activeActionRef.current.key === key) {
      completeCurrentAction();
    }
  }, [completeCurrentAction]);

  // Animation frame loop to accumulate motion smoothly at 60fps
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const act = activeActionRef.current;
      if (act) {
        const dt = Math.min((now - act.lastTimestamp) / 1000, 0.1);
        act.lastTimestamp = now;

        const mult = getSpeedMultiplier();
        const currentSpeed = act.baseSpeed * mult;

        let delta = 0;
        if (act.type === 'move') {
          delta = (currentSpeed / 100) * dt * act.direction;
        } else {
          delta = (currentSpeed / 10) * dt * act.direction;
        }

        act.accumulated += delta;

        liveOffsetRef.current = {
          type: act.type,
          value: act.accumulated,
          speed: currentSpeed,
          direction: act.direction,
        };

        setControlState(prev => ({
          ...prev,
          accumulatedValue: act.accumulated,
          speedMultiplier: mult,
          currentSpeed: Math.round(currentSpeed),
        }));
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [getSpeedMultiplier]);

  // Window keyboard event listeners
  useEffect(() => {
    if (!enabled) return;

    const isInputFocused = () => {
      const activeEl = document.activeElement;
      if (!activeEl) return false;
      const tag = activeEl.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || (activeEl as HTMLElement).isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      // Track modifiers: left shift doubles speed, left ctrl halves speed
      let modifierChanged = false;
      if (e.code === 'ShiftLeft' || (e.shiftKey && !modifiersRef.current.shift)) {
        modifiersRef.current.shift = true;
        modifierChanged = true;
      }
      if (e.code === 'ControlLeft' || (e.ctrlKey && !modifiersRef.current.ctrl)) {
        modifiersRef.current.ctrl = true;
        modifierChanged = true;
      }

      if (modifierChanged) {
        setControlState(prev => ({
          ...prev,
          speedMultiplier: getSpeedMultiplier(),
        }));
      }

      // Check action keys
      let key = e.code;
      if (!KEY_ACTIONS[key]) {
        const upper = `Key${e.key.toUpperCase()}`;
        if (KEY_ACTIONS[upper]) key = upper;
      }

      if (KEY_ACTIONS[key]) {
        e.preventDefault();
        if (e.repeat) return;
        startAction(key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      let modifierChanged = false;
      if (e.code === 'ShiftLeft' || (!e.shiftKey && modifiersRef.current.shift)) {
        modifiersRef.current.shift = false;
        modifierChanged = true;
      }
      if (e.code === 'ControlLeft' || (!e.ctrlKey && modifiersRef.current.ctrl)) {
        modifiersRef.current.ctrl = false;
        modifierChanged = true;
      }

      if (modifierChanged) {
        setControlState(prev => ({
          ...prev,
          speedMultiplier: getSpeedMultiplier(),
        }));
      }

      let key = e.code;
      if (!KEY_ACTIONS[key]) {
        const upper = `Key${e.key.toUpperCase()}`;
        if (KEY_ACTIONS[upper]) key = upper;
      }

      if (KEY_ACTIONS[key]) {
        e.preventDefault();
        stopAction(key);
      }
    };

    const handleBlur = () => {
      modifiersRef.current = { shift: false, ctrl: false };
      completeCurrentAction();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled, completeCurrentAction, getSpeedMultiplier, startAction, stopAction]);

  return {
    controlState,
    liveOffsetRef,
    startAction,
    stopAction,
  };
}
