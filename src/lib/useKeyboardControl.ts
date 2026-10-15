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
  KeyW: { key: 'KeyW', type: 'move', direction: 1, baseSpeed: 1000, description: 'Forward (W)' },
  KeyS: { key: 'KeyS', type: 'move', direction: -1, baseSpeed: 1000, description: 'Backward (S)' },
  KeyA: { key: 'KeyA', type: 'rotate', direction: -1, baseSpeed: 500, description: 'Rotate Left (A)' },
  KeyD: { key: 'KeyD', type: 'rotate', direction: 1, baseSpeed: 500, description: 'Rotate Right (D)' },
  KeyJ: { key: 'KeyJ', type: 'motor1', direction: -1, baseSpeed: 500, description: 'Left Arm CCW (J)' },
  KeyU: { key: 'KeyU', type: 'motor1', direction: 1, baseSpeed: 500, description: 'Left Arm CW (U)' },
  KeyL: { key: 'KeyL', type: 'motor2', direction: -1, baseSpeed: 500, description: 'Right Arm CCW (L)' },
  KeyO: { key: 'KeyO', type: 'motor2', direction: 1, baseSpeed: 500, description: 'Right Arm CW (O)' },
};

const GAMEPAD_ACTIONS: Record<string, ActionDef> = {
  GamepadLeftStickUp: { key: 'GamepadLeftStickUp', type: 'move', direction: 1, baseSpeed: 1000, description: 'L-Stick Forward' },
  GamepadLeftStickDown: { key: 'GamepadLeftStickDown', type: 'move', direction: -1, baseSpeed: 1000, description: 'L-Stick Backward' },
  GamepadRightStickLeft: { key: 'GamepadRightStickLeft', type: 'rotate', direction: -1, baseSpeed: 500, description: 'R-Stick Left' },
  GamepadRightStickRight: { key: 'GamepadRightStickRight', type: 'rotate', direction: 1, baseSpeed: 500, description: 'R-Stick Right' },
  GamepadArm1CW: { key: 'GamepadArm1CW', type: 'motor1', direction: 1, baseSpeed: 500, description: 'L-Trigger (Arm 1 CW)' },
  GamepadArm1CCW: { key: 'GamepadArm1CCW', type: 'motor1', direction: -1, baseSpeed: 500, description: 'L-Shoulder (Arm 1 CCW)' },
  GamepadArm2CW: { key: 'GamepadArm2CW', type: 'motor2', direction: 1, baseSpeed: 500, description: 'R-Trigger (Arm 2 CW)' },
  GamepadArm2CCW: { key: 'GamepadArm2CCW', type: 'motor2', direction: -1, baseSpeed: 500, description: 'R-Shoulder (Arm 2 CCW)' },
};

const ALL_ACTIONS: Record<string, ActionDef> = {
  ...KEY_ACTIONS,
  ...GAMEPAD_ACTIONS,
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
    isGamepadConnected: false,
    gamepadName: '',
  });

  const [isGamepadConnected, setIsGamepadConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState('');
  const isGamepadConnectedRef = useRef(false);

  const liveOffsetRef = useRef<LiveOffset | null>(null);

  const activeActionRef = useRef<{
    key: string;
    type: 'move' | 'rotate' | 'motor1' | 'motor2';
    direction: number;
    accumulated: number;
    baseSpeed: number;
    lastTimestamp: number;
    intensity?: number;
    source?: 'keyboard' | 'gamepad';
  } | null>(null);

  const keyboardModifiersRef = useRef<{ shift: boolean; ctrl: boolean }>({
    shift: false,
    ctrl: false,
  });

  const gamepadModifiersRef = useRef<{ a: boolean; b: boolean }>({
    a: false,
    b: false,
  });

  // Keep mission ref up to date
  const missionRef = useRef(mission);
  useEffect(() => {
    missionRef.current = mission;
  }, [mission]);

  const getSpeedMultiplier = useCallback(() => {
    let mult = 1.0;
    // Shift on keyboard OR A button on Xbox Controller doubles speed
    if (keyboardModifiersRef.current.shift || gamepadModifiersRef.current.a) {
      mult *= 2.0;
    }
    // Ctrl on keyboard OR B button on Xbox Controller halves speed
    if (keyboardModifiersRef.current.ctrl || gamepadModifiersRef.current.b) {
      mult *= 0.5;
    }
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
  }, [enabled, isPlaying, setIsPlaying, setActiveTool, completeCurrentAction]);

  const startAction = useCallback((
    key: string,
    intensity: number = 1.0,
    source: 'keyboard' | 'gamepad' = 'keyboard'
  ) => {
    const actionDef = ALL_ACTIONS[key];
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
      intensity,
      source,
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

  // Window Gamepad Connection Listeners
  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      const gName = e.gamepad.id || 'Xbox Controller';
      setIsGamepadConnected(true);
      setGamepadName(gName);
      isGamepadConnectedRef.current = true;
      setControlState(prev => ({
        ...prev,
        isGamepadConnected: true,
        gamepadName: gName,
      }));
    };

    const handleGamepadDisconnected = () => {
      const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      let anyConnected = false;
      let remainingName = '';
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]?.connected) {
          anyConnected = true;
          remainingName = gamepads[i]!.id || 'Xbox Controller';
          break;
        }
      }

      setIsGamepadConnected(anyConnected);
      setGamepadName(remainingName);
      isGamepadConnectedRef.current = anyConnected;
      setControlState(prev => ({
        ...prev,
        isGamepadConnected: anyConnected,
        gamepadName: remainingName,
      }));

      if (!anyConnected && activeActionRef.current?.source === 'gamepad') {
        completeCurrentAction();
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, [completeCurrentAction]);

  // Animation frame loop to poll Gamepad and accumulate motion smoothly at 60fps
  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      if (enabled) {
        // Poll Gamepads
        if (typeof navigator !== 'undefined' && navigator.getGamepads) {
          const gamepads = navigator.getGamepads();
          let gp: Gamepad | null = null;
          for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i]!.connected) {
              gp = gamepads[i];
              break;
            }
          }

          const isConnectedNow = Boolean(gp);
          if (isConnectedNow !== isGamepadConnectedRef.current) {
            isGamepadConnectedRef.current = isConnectedNow;
            setIsGamepadConnected(isConnectedNow);
            const gName = gp?.id || (isConnectedNow ? 'Xbox Controller' : '');
            setGamepadName(gName);
            setControlState(prev => ({
              ...prev,
              isGamepadConnected: isConnectedNow,
              gamepadName: gName,
            }));
          }

          if (gp) {
            // Speed Modifiers:
            // - A (Button 0): double speed (2.0x)
            // - B (Button 1): half speed (0.5x)
            const btnA = Boolean(gp.buttons[0]?.pressed || (gp.buttons[0]?.value ?? 0) > 0.5);
            const btnB = Boolean(gp.buttons[1]?.pressed || (gp.buttons[1]?.value ?? 0) > 0.5);
            const prevA = gamepadModifiersRef.current.a;
            const prevB = gamepadModifiersRef.current.b;
            gamepadModifiersRef.current = { a: btnA, b: btnB };

            if (prevA !== btnA || prevB !== btnB) {
              setControlState(prev => ({
                ...prev,
                speedMultiplier: getSpeedMultiplier(),
              }));
            }

            // Axes & Triggers Mapping:
            // - Left stick Up/Down (axes[1]): Forward / Backward
            // - Right stick Left/Right (axes[2]): Rotate Left / Right
            // - R Trigger (buttons[7]), R Shoulder (buttons[5]): Rotate Arm 2 Clockwise / Counterclockwise
            // - L Trigger (buttons[6]), L Shoulder (buttons[4]): Rotate Arm 1 Clockwise / Counterclockwise
            const DEADZONE = 0.22;
            const leftStickY = gp.axes[1] ?? 0;
            const rightStickX = gp.axes[2] ?? 0;

            const lTrigger = Boolean(gp.buttons[6]?.pressed || (gp.buttons[6]?.value ?? 0) > 0.2);
            const lShoulder = Boolean(gp.buttons[4]?.pressed);
            const rTrigger = Boolean(gp.buttons[7]?.pressed || (gp.buttons[7]?.value ?? 0) > 0.2);
            const rShoulder = Boolean(gp.buttons[5]?.pressed);

            // D-Pad buttons as convenient secondary directional inputs
            const dpadUp = Boolean(gp.buttons[12]?.pressed);
            const dpadDown = Boolean(gp.buttons[13]?.pressed);
            const dpadLeft = Boolean(gp.buttons[14]?.pressed);
            const dpadRight = Boolean(gp.buttons[15]?.pressed);

            let candidateKey: string | null = null;
            let intensity = 1.0;

            if (leftStickY < -DEADZONE || dpadUp) {
              candidateKey = 'GamepadLeftStickUp';
              intensity = dpadUp ? 1.0 : Math.min(1.0, (Math.abs(leftStickY) - DEADZONE) / (1 - DEADZONE) + 0.2);
            } else if (leftStickY > DEADZONE || dpadDown) {
              candidateKey = 'GamepadLeftStickDown';
              intensity = dpadDown ? 1.0 : Math.min(1.0, (Math.abs(leftStickY) - DEADZONE) / (1 - DEADZONE) + 0.2);
            } else if (rightStickX < -DEADZONE || dpadLeft) {
              candidateKey = 'GamepadRightStickLeft';
              intensity = dpadLeft ? 1.0 : Math.min(1.0, (Math.abs(rightStickX) - DEADZONE) / (1 - DEADZONE) + 0.2);
            } else if (rightStickX > DEADZONE || dpadRight) {
              candidateKey = 'GamepadRightStickRight';
              intensity = dpadRight ? 1.0 : Math.min(1.0, (Math.abs(rightStickX) - DEADZONE) / (1 - DEADZONE) + 0.2);
            } else if (rTrigger) {
              candidateKey = 'GamepadArm2CW';
              intensity = 1.0;
            } else if (rShoulder) {
              candidateKey = 'GamepadArm2CCW';
              intensity = 1.0;
            } else if (lTrigger) {
              candidateKey = 'GamepadArm1CW';
              intensity = 1.0;
            } else if (lShoulder) {
              candidateKey = 'GamepadArm1CCW';
              intensity = 1.0;
            }

            if (candidateKey) {
              if (!activeActionRef.current) {
                startAction(candidateKey, intensity, 'gamepad');
              } else if (activeActionRef.current.key === candidateKey) {
                activeActionRef.current.intensity = intensity;
              } else if (activeActionRef.current.source === 'gamepad') {
                completeCurrentAction();
                startAction(candidateKey, intensity, 'gamepad');
              }
            } else if (activeActionRef.current?.source === 'gamepad') {
              // Gamepad input released! Movement completed -> committed as instruction
              completeCurrentAction();
            }
          }
        }
      }

      // Motion accumulation for active action
      const act = activeActionRef.current;
      if (act) {
        const dt = Math.min((now - act.lastTimestamp) / 1000, 0.1);
        act.lastTimestamp = now;

        const mult = getSpeedMultiplier();
        const base = act.baseSpeed * mult;
        const currentSpeed = base * (act.intensity ?? 1.0);

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
          currentSpeed: Math.round(base),
        }));
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [enabled, getSpeedMultiplier, startAction, completeCurrentAction]);

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
      if (e.code === 'ShiftLeft' || (e.shiftKey && !keyboardModifiersRef.current.shift)) {
        keyboardModifiersRef.current.shift = true;
        modifierChanged = true;
      }
      if (e.code === 'ControlLeft' || (e.ctrlKey && !keyboardModifiersRef.current.ctrl)) {
        keyboardModifiersRef.current.ctrl = true;
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
        startAction(key, 1.0, 'keyboard');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      let modifierChanged = false;
      if (e.code === 'ShiftLeft' || (!e.shiftKey && keyboardModifiersRef.current.shift)) {
        keyboardModifiersRef.current.shift = false;
        modifierChanged = true;
      }
      if (e.code === 'ControlLeft' || (!e.ctrlKey && keyboardModifiersRef.current.ctrl)) {
        keyboardModifiersRef.current.ctrl = false;
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
      keyboardModifiersRef.current = { shift: false, ctrl: false };
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
    isGamepadConnected,
    gamepadName,
  };
}
