import React from 'react';
import { MissionConfig } from '../lib/types';
import { Save, FolderOpen } from 'lucide-react';

interface Props {
  mission: MissionConfig;
  setMission: React.Dispatch<React.SetStateAction<MissionConfig>>;
  leftTab: 'mission' | 'robot';
  setLeftTab: (tab: 'mission' | 'robot') => void;
}

export function Controls({ mission, setMission, leftTab, setLeftTab }: Props) {
  
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
