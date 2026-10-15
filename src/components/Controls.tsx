import React from 'react';
import { MissionConfig, KeyboardControlState } from '../lib/types';
import { Save, FolderOpen, Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Zap } from 'lucide-react';

interface Props {
  mission: MissionConfig;
  setMission: React.Dispatch<React.SetStateAction<MissionConfig>>;
  leftTab: 'mission' | 'robot';
  setLeftTab: (tab: 'mission' | 'robot') => void;
  isControlEnabled: boolean;
  setIsControlEnabled: (enabled: boolean) => void;
  controlState: KeyboardControlState;
  startAction: (key: string) => void;
  stopAction: (key: string) => void;
}

export function Controls({
  mission,
  setMission,
  leftTab,
  setLeftTab,
  isControlEnabled,
  setIsControlEnabled,
  controlState,
  startAction,
  stopAction,
}: Props) {
  
  const updateRobot = (key: keyof MissionConfig['robotConfig'], val: any) => {
    setMission(m => ({ ...m, robotConfig: { ...m.robotConfig, [key]: val } }));
  };

  const handleSave = () => {
    const data = JSON.stringify(mission, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mission.missionName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const m = JSON.parse(evt.target?.result as string);
        setMission(m);
      } catch (err) {
        alert('Invalid mission file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-800 shrink-0">
        <button 
          onClick={() => setLeftTab('mission')}
          className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors ${leftTab === 'mission' ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Mission
        </button>
        <button 
          onClick={() => setLeftTab('robot')}
          className={`flex-1 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors ${leftTab === 'robot' ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-900/30' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Robot
        </button>
      </div>

      <div className="flex flex-col gap-6 overflow-y-auto p-4 flex-1">
        {leftTab === 'mission' ? (
          <>
            {/* Keyboard Control Mode Toggle Card */}
            <div className={`p-3.5 rounded-lg border transition-all ${isControlEnabled ? 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-slate-900/30 border-slate-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gamepad2 size={16} className={isControlEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
                  <div>
                    <span className="text-xs font-bold text-white tracking-wide block">Control Mode</span>
                    <span className="text-[10px] text-slate-400 block">Keyboard & Xbox Controller</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded tracking-wider ${isControlEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5' : 'bg-slate-800 text-slate-500'}`}>
                    {isControlEnabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
                    {isControlEnabled ? 'ACTIVE' : 'OFF'}
                  </span>
                  
                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isControlEnabled}
                    onClick={() => setIsControlEnabled(!isControlEnabled)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none ${isControlEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${isControlEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Gamepad Connection Status Badge */}
              <div className="mt-1 mb-2 flex items-center justify-between bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/80 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${controlState.isGamepadConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></span>
                  <span className={`font-mono font-medium ${controlState.isGamepadConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {controlState.isGamepadConnected ? 'Xbox Controller Connected' : 'Xbox Controller Ready'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500">
                  {controlState.isGamepadConnected ? (controlState.gamepadName ? 'Detected' : 'Active') : 'Plug in & press button'}
                </span>
              </div>

              {isControlEnabled ? (
                <div className="mt-3 space-y-3 pt-3 border-t border-slate-800">
                  {/* Live Status HUD */}
                  <div className={`p-2.5 rounded border text-xs font-mono transition-colors ${
                    controlState.activeKey 
                      ? 'bg-blue-950/40 border-blue-500/50 text-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-bold flex items-center gap-1">
                        <Zap size={10} className={controlState.activeKey ? 'text-amber-400 animate-bounce' : 'text-slate-500'} />
                        {controlState.activeKey ? 'Recording Action...' : 'Ready for input'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Speed: <span className="text-white font-bold">{controlState.currentSpeed}</span> ({controlState.speedMultiplier}x)
                      </span>
                    </div>

                    <div className="font-bold text-sm truncate">
                      {controlState.activeKey ? (
                        <>
                          {controlState.activeType === 'move' && (
                            <span className="text-blue-400">
                              {controlState.direction > 0 ? '▲ Moving Forward: ' : '▼ Moving Backward: '}
                              {controlState.accumulatedValue >= 0 ? '+' : ''}{controlState.accumulatedValue.toFixed(1)} cm
                            </span>
                          )}
                          {controlState.activeType === 'rotate' && (
                            <span className="text-orange-400">
                              {controlState.direction > 0 ? '↻ Rotating Right: ' : '↺ Rotating Left: '}
                              {controlState.accumulatedValue >= 0 ? '+' : ''}{controlState.accumulatedValue.toFixed(1)}°
                            </span>
                          )}
                          {controlState.activeType === 'motor1' && (
                            <span className="text-purple-400">
                              {controlState.direction > 0 ? '↻ Left Arm CW: ' : '↺ Left Arm CCW: '}
                              {controlState.accumulatedValue >= 0 ? '+' : ''}{controlState.accumulatedValue.toFixed(1)}°
                            </span>
                          )}
                          {controlState.activeType === 'motor2' && (
                            <span className="text-rose-400">
                              {controlState.direction > 0 ? '↻ Right Arm CW: ' : '↺ Right Arm CCW: '}
                              {controlState.accumulatedValue >= 0 ? '+' : ''}{controlState.accumulatedValue.toFixed(1)}°
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500 text-xs font-normal">
                          {controlState.isGamepadConnected 
                            ? 'L-Stick/W/S to drive, R-Stick/A/D to rotate'
                            : 'Press W/A/S/D to drive, U/J/O/L for arms'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Speed Modifiers Indicator */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Speed:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all border ${
                      controlState.speedMultiplier === 2 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/30' 
                        : 'bg-slate-800/80 text-slate-500 border-slate-700/50'
                    }`}>
                      [Shift] / (A) 2x
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all border ${
                      controlState.speedMultiplier === 0.5 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/30' 
                        : 'bg-slate-800/80 text-slate-500 border-slate-700/50'
                    }`}>
                      [Ctrl] / (B) 0.5x
                    </span>
                  </div>

                  {/* Xbox Controller Reference Card */}
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Gamepad2 size={12} className={controlState.isGamepadConnected ? 'text-emerald-400' : 'text-slate-500'} />
                        Xbox Controller Controls
                      </span>
                      <span className="text-[9px] text-emerald-400 font-mono">
                        {controlState.isGamepadConnected ? 'CONNECTED' : 'STANDBY'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                      <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-500 block text-[9px] uppercase font-sans font-bold">Drive & Steer</span>
                        <div className="text-blue-300 mt-0.5">🕹️ L-Stick ↕: Drive</div>
                        <div className="text-orange-300">🕹️ R-Stick ↔: Rotate</div>
                      </div>

                      <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-500 block text-[9px] uppercase font-sans font-bold">Arm Attachments</span>
                        <div className="text-purple-300 mt-0.5">LT / LB: Arm 1 (↻ / ↺)</div>
                        <div className="text-rose-300">RT / RB: Arm 2 (↻ / ↺)</div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Control Pad (Touch / Mouse / Visual Key feedback) */}
                  <div className="space-y-3 bg-slate-950/40 p-2.5 rounded border border-slate-800/70">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex justify-between">
                        <span>Movement (W / A / S / D)</span>
                        <span className="text-slate-600">Hold key to move</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onMouseDown={() => startAction('KeyW')}
                          onMouseUp={() => stopAction('KeyW')}
                          onMouseLeave={() => stopAction('KeyW')}
                          onTouchStart={(e) => { e.preventDefault(); startAction('KeyW'); }}
                          onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyW'); }}
                          className={`w-16 h-8 rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 border select-none ${
                            controlState.activeKey === 'KeyW'
                              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/40 scale-95'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          <ArrowUp size={12} /> W
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onMouseDown={() => startAction('KeyA')}
                            onMouseUp={() => stopAction('KeyA')}
                            onMouseLeave={() => stopAction('KeyA')}
                            onTouchStart={(e) => { e.preventDefault(); startAction('KeyA'); }}
                            onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyA'); }}
                            className={`w-16 h-8 rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 border select-none ${
                              controlState.activeKey === 'KeyA'
                                ? 'bg-orange-600 text-white border-orange-400 shadow-md shadow-orange-500/40 scale-95'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                          >
                            <ArrowLeft size={12} /> A
                          </button>
                          <button
                            type="button"
                            onMouseDown={() => startAction('KeyS')}
                            onMouseUp={() => stopAction('KeyS')}
                            onMouseLeave={() => stopAction('KeyS')}
                            onTouchStart={(e) => { e.preventDefault(); startAction('KeyS'); }}
                            onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyS'); }}
                            className={`w-16 h-8 rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 border select-none ${
                              controlState.activeKey === 'KeyS'
                                ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/40 scale-95'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                          >
                            <ArrowDown size={12} /> S
                          </button>
                          <button
                            type="button"
                            onMouseDown={() => startAction('KeyD')}
                            onMouseUp={() => stopAction('KeyD')}
                            onMouseLeave={() => stopAction('KeyD')}
                            onTouchStart={(e) => { e.preventDefault(); startAction('KeyD'); }}
                            onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyD'); }}
                            className={`w-16 h-8 rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 border select-none ${
                              controlState.activeKey === 'KeyD'
                                ? 'bg-orange-600 text-white border-orange-400 shadow-md shadow-orange-500/40 scale-95'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                          >
                            D <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Attachments (J, U, L, O) */}
                    <div className="pt-2 border-t border-slate-800/60">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Attachments (Arms)
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Left Arm (Arm 1)</span>
                          <div className="flex gap-1 w-full">
                            <button
                              type="button"
                              onMouseDown={() => startAction('KeyJ')}
                              onMouseUp={() => stopAction('KeyJ')}
                              onMouseLeave={() => stopAction('KeyJ')}
                              onTouchStart={(e) => { e.preventDefault(); startAction('KeyJ'); }}
                              onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyJ'); }}
                              className={`flex-1 py-1 rounded text-[10px] font-mono font-bold flex items-center justify-center gap-1 border select-none ${
                                controlState.activeKey === 'KeyJ'
                                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm scale-95'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                              title="Rotate Left Attachment CCW"
                            >
                              <RotateCcw size={10} /> J (↺)
                            </button>
                            <button
                              type="button"
                              onMouseDown={() => startAction('KeyU')}
                              onMouseUp={() => stopAction('KeyU')}
                              onMouseLeave={() => stopAction('KeyU')}
                              onTouchStart={(e) => { e.preventDefault(); startAction('KeyU'); }}
                              onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyU'); }}
                              className={`flex-1 py-1 rounded text-[10px] font-mono font-bold flex items-center justify-center gap-1 border select-none ${
                                controlState.activeKey === 'KeyU'
                                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm scale-95'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                              title="Rotate Left Attachment CW"
                            >
                              U (↻) <RotateCw size={10} />
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Right Arm (Arm 2)</span>
                          <div className="flex gap-1 w-full">
                            <button
                              type="button"
                              onMouseDown={() => startAction('KeyL')}
                              onMouseUp={() => stopAction('KeyL')}
                              onMouseLeave={() => stopAction('KeyL')}
                              onTouchStart={(e) => { e.preventDefault(); startAction('KeyL'); }}
                              onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyL'); }}
                              className={`flex-1 py-1 rounded text-[10px] font-mono font-bold flex items-center justify-center gap-1 border select-none ${
                                controlState.activeKey === 'KeyL'
                                  ? 'bg-rose-600 text-white border-rose-400 shadow-sm scale-95'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                              title="Rotate Right Attachment CCW"
                            >
                              <RotateCcw size={10} /> L (↺)
                            </button>
                            <button
                              type="button"
                              onMouseDown={() => startAction('KeyO')}
                              onMouseUp={() => stopAction('KeyO')}
                              onMouseLeave={() => stopAction('KeyO')}
                              onTouchStart={(e) => { e.preventDefault(); startAction('KeyO'); }}
                              onTouchEnd={(e) => { e.preventDefault(); stopAction('KeyO'); }}
                              className={`flex-1 py-1 rounded text-[10px] font-mono font-bold flex items-center justify-center gap-1 border select-none ${
                                controlState.activeKey === 'KeyO'
                                  ? 'bg-rose-600 text-white border-rose-400 shadow-sm scale-95'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                              title="Rotate Right Attachment CW"
                            >
                              O (↻) <RotateCw size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic leading-tight">
                    Each movement or rotation is automatically added to the instructions sequence when the key is released.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  Turn on to drive the robot with W/A/S/D & attachment keys. Completed movements will be recorded as instructions.
                </p>
              )}
            </div>

            {/* Mission Config */}
            <div>
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Mission Settings
              </h2>
              <input 
                type="text" 
                value={mission.missionName}
                onChange={e => setMission(m => ({ ...m, missionName: e.target.value }))}
                className="w-full bg-slate-900/50 border border-slate-800 rounded px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 mb-3 font-mono"
                placeholder="Mission Name"
              />
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={handleSave} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs font-bold transition-colors">
                  <Save size={12} /> EXPORT
                </button>
                <label className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors">
                  <FolderOpen size={12} /> IMPORT
                  <input type="file" accept=".json" className="hidden" onChange={handleLoad} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="px-1">
                  <label className="text-[11px] text-slate-500 block mb-1">Start X (cm)</label>
                  <input type="number" value={Number.isNaN(mission.robotConfig.startX) ? "" : mission.robotConfig.startX} onChange={e => updateRobot('startX', parseFloat(e.target.value))} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                </div>
                <div className="px-1">
                  <label className="text-[11px] text-slate-500 block mb-1">Start Y (cm)</label>
                  <input type="number" value={Number.isNaN(mission.robotConfig.startY) ? "" : mission.robotConfig.startY} onChange={e => updateRobot('startY', parseFloat(e.target.value))} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                </div>
              </div>
            </div>

            {/* Add Instructions */}
            <div>
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Command Sequence
              </h2>
              
              <div className="bg-slate-900/30 p-3 rounded border border-slate-800 mb-2">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase">Dist (cm)</label>
                    <input id="moveDist" type="number" defaultValue="50" className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase">Speed</label>
                    <input id="moveSpeed" type="number" defaultValue="1000" className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                  </div>
                </div>
                <button onClick={() => {
                  const dist = parseFloat((document.getElementById('moveDist') as HTMLInputElement).value);
                  const spd = parseFloat((document.getElementById('moveSpeed') as HTMLInputElement).value);
                  setMission(m => ({...m, instructions: [...m.instructions, { id: Math.random().toString(), type: 'move', distance: dist, speed: spd }]}));
                }} className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 py-1.5 rounded text-xs font-bold transition-colors">
                  INSERT MOVE
                </button>
              </div>

              <div className="bg-slate-900/30 p-3 rounded border border-slate-800 mb-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase">Angle (°)</label>
                    <input id="rotAngle" type="number" defaultValue="90" className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase">Speed</label>
                    <input id="rotSpeed" type="number" defaultValue="500" className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                  </div>
                </div>
                <button onClick={() => {
                  const ang = parseFloat((document.getElementById('rotAngle') as HTMLInputElement).value);
                  const spd = parseFloat((document.getElementById('rotSpeed') as HTMLInputElement).value);
                  setMission(m => ({...m, instructions: [...m.instructions, { id: Math.random().toString(), type: 'rotate', angle: ang, speed: spd }]}));
                }} className="w-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 py-1.5 rounded text-xs font-bold transition-colors">
                  INSERT ROTATE
                </button>
              </div>

              <button onClick={() => {
                setMission(m => ({...m, instructions: [...m.instructions, { id: Math.random().toString(), type: 'motor1', angle: 90, speed: 500 }]}));
              }} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs font-bold transition-colors text-left px-3 mb-2 border border-slate-700/50">
                + MOTOR 1 ROTATION
              </button>
              
              <button onClick={() => {
                setMission(m => ({...m, instructions: [...m.instructions, { id: Math.random().toString(), type: 'motor2', angle: 90, speed: 500 }]}));
              }} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs font-bold transition-colors text-left px-3 border border-slate-700/50">
                + MOTOR 2 ROTATION
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                Robot Properties
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="px-1">
                  <label className="text-[11px] text-slate-500 block mb-1">Width (cm)</label>
                  <input type="number" value={Number.isNaN(mission.robotConfig.width) ? "" : mission.robotConfig.width} onChange={e => updateRobot('width', parseFloat(e.target.value))} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                </div>
                <div className="px-1">
                  <label className="text-[11px] text-slate-500 block mb-1">Height (cm)</label>
                  <input type="number" value={Number.isNaN(mission.robotConfig.height) ? "" : mission.robotConfig.height} onChange={e => updateRobot('height', parseFloat(e.target.value))} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="px-1">
                  <label className="text-[11px] text-slate-500 block mb-1">Pivot Y (cm)</label>
                  <input type="number" value={Number.isNaN(mission.robotConfig.pivotY) ? "" : mission.robotConfig.pivotY} onChange={e => updateRobot('pivotY', parseFloat(e.target.value))} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
                </div>
              </div>
              <div className="px-1 mb-4 flex gap-4 items-center">
                 <div>
                   <label className="text-[11px] text-slate-500 block mb-1">Robot Color</label>
                   <input type="color" value={mission.robotConfig.color} onChange={e => updateRobot('color', e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer bg-transparent" />
                 </div>
                 <div>
                   <label className="text-[11px] text-slate-500 block mb-1">Path Color</label>
                   <input type="color" value={mission.robotConfig.pathColor} onChange={e => updateRobot('pathColor', e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer bg-transparent" />
                 </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Arms
                </h2>
                <button 
                  onClick={() => {
                    const newArm = { id: `arm_${Math.random().toString(36).substr(2, 5)}`, xOffset: 0, yOffset: 9, width: 1, height: 8, rotation: 0 };
                    updateRobot('arms', [...mission.robotConfig.arms, newArm]);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px] font-bold"
                >
                  + ADD ARM
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                {mission.robotConfig.arms.map((arm, idx) => (
                  <div key={arm.id} className="bg-slate-900/30 p-3 rounded border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-400">ARM {idx + 1}</span>
                      <button 
                        onClick={() => {
                          const newArms = mission.robotConfig.arms.filter(a => a.id !== arm.id);
                          updateRobot('arms', newArms);
                        }}
                        className="text-red-500 hover:text-red-400 text-[10px]"
                      >
                        REMOVE
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase">X Offset</label>
                        <input type="number" value={Number.isNaN(arm.xOffset) ? "" : arm.xOffset} onChange={e => {
                          const newArms = [...mission.robotConfig.arms];
                          newArms[idx] = { ...arm, xOffset: parseFloat(e.target.value) };
                          updateRobot('arms', newArms);
                        }} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono" />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase">Y Offset</label>
                        <input type="number" value={Number.isNaN(arm.yOffset) ? "" : arm.yOffset} onChange={e => {
                          const newArms = [...mission.robotConfig.arms];
                          newArms[idx] = { ...arm, yOffset: parseFloat(e.target.value) };
                          updateRobot('arms', newArms);
                        }} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase">Width</label>
                        <input type="number" value={Number.isNaN(arm.width) ? "" : arm.width} onChange={e => {
                          const newArms = [...mission.robotConfig.arms];
                          newArms[idx] = { ...arm, width: parseFloat(e.target.value) };
                          updateRobot('arms', newArms);
                        }} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono" />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 uppercase">Height</label>
                        <input type="number" value={Number.isNaN(arm.height) ? "" : arm.height} onChange={e => {
                          const newArms = [...mission.robotConfig.arms];
                          newArms[idx] = { ...arm, height: parseFloat(e.target.value) };
                          updateRobot('arms', newArms);
                        }} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
