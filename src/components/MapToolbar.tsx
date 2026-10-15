import React, { useEffect, useRef } from 'react';
import { MissionConfig, ActiveTool, TelemetryData } from '../lib/types';
import { Play, Square, RotateCw, Ruler, Route, MousePointer2, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
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
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export function MapToolbar({ 
  mission, 
  setMission, 
  isPlaying, 
  setIsPlaying, 
  resetSimulation, 
  activeTool, 
  setActiveTool, 
  telemetryRef, 
  onResetView,
  isMaximized,
  onToggleMaximize
}: Props) {
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

  const isMeasurementsVisible = mission.isMeasurementsVisible !== false;
  const measurementCount = mission.measurements?.length || 0;

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
      <div className="p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => {
              if (!isPlaying) {
                const total = calculateTotalTime(mission.instructions, mission.robotConfig);
                if (total <= 0) return;
                // If animation reached the end (or within 0.05s of the end), rewind to 0 before starting
                if (telemetryRef.current.time >= total - 0.05) {
                  telemetryRef.current.time = 0;
                }
                setIsPlaying(true);
              } else {
                setIsPlaying(false);
              }
            }}
            className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${isPlaying ? 'bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/30'}`}
          >
            {isPlaying ? <><Square size={14} /> STOP</> : <><Play size={14} /> PLAY</>}
          </button>
          <button onClick={resetSimulation} className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded transition-colors cursor-pointer" title="Reset Simulation">
            <RotateCw size={14} />
          </button>
          <button onClick={onResetView} className="px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded transition-colors text-xs font-bold cursor-pointer" title="Reset View">
            RESET VIEW
          </button>
          {onToggleMaximize && (
            <button 
              onClick={onToggleMaximize}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-xs font-bold border cursor-pointer ${
                isMaximized 
                  ? 'bg-blue-600/25 text-blue-400 border-blue-500/40 hover:bg-blue-600/35 shadow-[0_0_12px_rgba(37,99,235,0.25)]' 
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
              title={isMaximized ? "Exit Fullscreen (Esc)" : "Maximize Map View (Fullscreen)"}
            >
              {isMaximized ? <Minimize2 size={14} className="text-blue-400" /> : <Maximize2 size={14} />}
              <span>{isMaximized ? 'RESTORE' : 'MAXIMIZE'}</span>
            </button>
          )}
          <div className="flex items-center gap-2 ml-2 sm:ml-4">
            <label className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Speed</label>
            <input 
              type="range" min="0.1" max="3" step="0.1" 
              value={mission.playbackSpeed}
              onChange={e => setMission(m => ({ ...m, playbackSpeed: parseFloat(e.target.value) }))}
              className="w-20 sm:w-24 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] font-mono text-slate-400 w-6">{mission.playbackSpeed.toFixed(1)}x</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTool('none')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors border cursor-pointer ${activeTool === 'none' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'}`}
            >
              <MousePointer2 size={14} /> MOVE
            </button>

            {/* MEASURE BUTTON WITH EMBEDDED EYE TOGGLE */}
            <div 
              className={`inline-flex items-center rounded text-xs font-bold transition-all border ${
                activeTool === 'measure' 
                  ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40 shadow-[0_0_12px_rgba(234,179,8,0.2)]' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700/80'
              }`}
            >
              <button 
                type="button"
                onClick={() => setActiveTool(activeTool === 'measure' ? 'none' : 'measure')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 focus:outline-none cursor-pointer hover:text-yellow-400 transition-colors"
                title={activeTool === 'measure' ? "Measurement tool active (click to exit)" : "Click to activate Measurement tool"}
              >
                <Ruler size={14} className={activeTool === 'measure' ? 'text-yellow-400' : ''} />
                <span>MEASURE</span>
                {measurementCount > 0 && (
                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                    activeTool === 'measure' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-slate-900/80 text-slate-400'
                  }`}>
                    {measurementCount}
                  </span>
                )}
              </button>
              
              {/* Divider inside MEASURE button */}
              <div className={`h-3.5 w-px ${activeTool === 'measure' ? 'bg-yellow-500/40' : 'bg-slate-700'}`} />

              {/* Embedded Eye Open / Eye Closed graphic toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMission(m => ({
                    ...m,
                    isMeasurementsVisible: m.isMeasurementsVisible !== false ? false : true
                  }));
                }}
                className={`px-2 py-1.5 flex items-center justify-center transition-colors focus:outline-none cursor-pointer group/eye ${
                  isMeasurementsVisible
                    ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/60'
                }`}
                title={isMeasurementsVisible ? "Hide measurements from map" : "Show measurements on map"}
                aria-label={isMeasurementsVisible ? "Hide measurements" : "Show measurements"}
              >
                {isMeasurementsVisible ? (
                  <Eye size={13} className="transition-transform group-hover/eye:scale-115 text-yellow-400" />
                ) : (
                  <EyeOff size={13} className="transition-transform group-hover/eye:scale-115 text-slate-500 group-hover/eye:text-slate-300" />
                )}
              </button>
            </div>

            <button 
              onClick={() => setActiveTool('path')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors border cursor-pointer ${activeTool === 'path' ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'}`}
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
