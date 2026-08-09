import React, { useEffect, useRef } from 'react';
import { MissionConfig, ActiveTool, TelemetryData } from '../lib/types';
import { Play, Square, RotateCw, Ruler, Route, MousePointer2 } from 'lucide-react';
import { calculateTotalTime } from '../lib/simulator';

interface Props {
  mission: MissionConfig;
  setMission: React.Dispatch<React.SetStateAction<MissionConfig>>;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  resetSimulation: () => void;
  activeTool: ActiveTool;
  setActiveTool: (t: ActiveTool) => void;
  telemetryRef: React.MutableRefObject<TelemetryData>;
  onResetView: () => void;
}

export function MapToolbar({ mission, setMission, isPlaying, setIsPlaying, resetSimulation, activeTool, setActiveTool, telemetryRef, onResetView }: Props) {
  const timelineRef = useRef<HTMLInputElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const totalTime = calculateTotalTime(mission.instructions, mission.robotConfig);

  useEffect(() => {
    let animationFrameId: number;
    const updateTimeline = () => {
      if (timelineRef.current) {
        timelineRef.current.value = telemetryRef.current.time.toString();
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${telemetryRef.current.time.toFixed(1)}s / ${totalTime.toFixed(1)}s`;
      }
      animationFrameId = requestAnimationFrame(updateTimeline);
    };
    updateTimeline();
    return () => cancelAnimationFrame(animationFrameId);
  }, [totalTime, telemetryRef]);

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    telemetryRef.current.time = parseFloat(e.target.value);
  };

  return (
    <div className="bg-[#0a0c12] border-t border-slate-800 flex flex-col z-10">
      <div className="px-4 py-2 border-b border-slate-800/50 flex items-center gap-3 bg-slate-900/20">
        <span ref={timeDisplayRef} className="text-[10px] font-mono text-slate-400 min-w-[70px]">0.0s / 0.0s</span>
        <input 
          ref={timelineRef}
          type="range" min="0" max={totalTime || 0.1} step="0.01" defaultValue={0}
          onChange={handleTimelineChange}
          onInput={handleTimelineChange}
          className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
        />
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-colors ${isPlaying ? 'bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/30'}`}
          >
            {isPlaying ? <><Square size={14} /> STOP</> : <><Play size={14} /> PLAY</>}
          </button>
          <button onClick={resetSimulation} className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded transition-colors" title="Reset Simulation">
            <RotateCw size={14} />
          </button>
          <button onClick={onResetView} className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded transition-colors text-xs font-bold" title="Reset View">
            RESET VIEW
          </button>
          <div className="flex items-center gap-2 ml-4">
            <label className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Speed</label>
            <input 
              type="range" min="0.1" max="3" step="0.1" 
              value={mission.playbackSpeed}
              onChange={e => setMission(m => ({ ...m, playbackSpeed: parseFloat(e.target.value) }))}
              className="w-24 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] font-mono text-slate-400 w-6">{mission.playbackSpeed.toFixed(1)}x</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTool('none')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors border ${activeTool === 'none' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              <MousePointer2 size={14} /> MOVE
            </button>
            <button 
              onClick={() => setActiveTool('measure')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors border ${activeTool === 'measure' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              <Ruler size={14} /> MEASURE
            </button>
            <button 
              onClick={() => setActiveTool('path')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors border ${activeTool === 'path' ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              <Route size={14} /> PATH
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Opacity</label>
            <input 
              type="range" min="0" max="1" step="0.1" 
              value={mission.map2Opacity}
              onChange={e => setMission(m => ({ ...m, map2Opacity: parseFloat(e.target.value) }))}
              className="w-20 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer ml-2">
            <input type="checkbox" checked={mission.isMissionNamesVisible} onChange={e => setMission(m => ({...m, isMissionNamesVisible: e.target.checked}))} className="accent-blue-500 rounded bg-slate-900 border-slate-700" />
            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Labels</span>
          </label>
        </div>
      </div>
    </div>
  );
}
