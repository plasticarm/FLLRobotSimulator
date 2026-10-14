import React, { useState, useRef, useEffect } from 'react';
import { MissionConfig, TelemetryData } from './lib/types';
import { calculateTotalTime } from './lib/simulator';
import { CanvasMap } from './components/CanvasMap';
import { Controls } from './components/Controls';
import { InstructionList } from './components/InstructionList';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { CodeExport } from './components/CodeExport';
import { MapToolbar } from './components/MapToolbar';
import { ActiveTool } from './lib/types';
import { Auth } from './components/Auth';
import { ProfileMissionManager } from './components/ProfileMissionManager';
import { Map as MapIcon, Library, Settings, List } from 'lucide-react';
import { useKeyboardControl } from './lib/useKeyboardControl';

const defaultMission: MissionConfig = {
  missionName: 'Robot Mission',
  robotConfig: {
    startX: -93.0,
    startY: -48.0,
    startAngle: 0,
    width: 12.5,
    height: 18,
    pivotY: 0,
    color: '#3b82f6',
    pathColor: '#22c55e',
    arms: [
      { id: 'arm1', xOffset: -6.25, yOffset: 9, width: 1, height: 8, rotation: 0 },
      { id: 'arm2', xOffset: 6.25, yOffset: 9, width: 1, height: 8, rotation: 0 }
    ]
  },
  instructions: [],
  map2Opacity: 0.5,
  isMissionNamesVisible: false,
  playbackSpeed: 1.0,
  functionNames: {
    move: 'drive',
    rotate: 'rotateDegrees',
    motor1: 'rotateLeftArm',
    motor2: 'rotateRightArm'
  }
};

export default function App() {
  const [mission, setMission] = useState<MissionConfig>(defaultMission);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [leftTab, setLeftTab] = useState<'mission' | 'robot'>('mission');
  const [centerTab, setCenterTab] = useState<'map' | 'manager'>('map');
  const [resetViewCounter, setResetViewCounter] = useState(0);
  const [isControlEnabled, setIsControlEnabled] = useState(false);
  
  const [mobileTab, setMobileTab] = useState<'controls' | 'map' | 'instructions'>('map');

  const telemetryRef = useRef<TelemetryData>({
    time: 0,
    totalTime: 0,
    x: 0, y: 0, angle: 0,
    currentDistance: 0, currentAngle: 0,
    instructionIndex: -1, speed: 0
  });

  const { controlState, liveOffsetRef, startAction, stopAction } = useKeyboardControl({
    enabled: isControlEnabled,
    setEnabled: setIsControlEnabled,
    mission,
    setMission,
    telemetryRef,
    isPlaying,
    setIsPlaying,
    setActiveTool,
  });

  const lastTimeRef = useRef<number>(0);
  const reqRef = useRef<number>(0);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const loop = (timeNow: number) => {
        const dt = (timeNow - lastTimeRef.current) / 1000;
        lastTimeRef.current = timeNow;
        
        telemetryRef.current.totalTime = calculateTotalTime(mission.instructions, mission.robotConfig);
        telemetryRef.current.time += dt * mission.playbackSpeed;

        if (telemetryRef.current.time >= telemetryRef.current.totalTime && telemetryRef.current.totalTime > 0) {
          telemetryRef.current.time = telemetryRef.current.totalTime;
          setIsPlaying(false);
        }
        // Force the ref update but without triggering react if not needed, 
        // the canvas loop and telemetry loop will pick it up
        reqRef.current = requestAnimationFrame(loop);
      };
      reqRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(reqRef.current);
    }
    return () => cancelAnimationFrame(reqRef.current);
  }, [isPlaying, mission]);

  const handleRobotMove = (x: number, y: number) => {
    setMission(m => ({ ...m, robotConfig: { ...m.robotConfig, startX: x, startY: y } }));
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    telemetryRef.current.time = 0;
  };

  return (
    <div className="min-h-screen bg-[#050608] text-slate-300 font-sans flex flex-col lg:flex-row h-screen overflow-hidden">
      
      {/* LEFT COLUMN: Controls */}
      <div className={`${mobileTab === 'controls' ? 'flex flex-1' : 'hidden'} lg:flex w-full lg:flex-none lg:w-[300px] flex-shrink-0 flex-col bg-[#0a0c12] border-r border-slate-800 overflow-hidden h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]`}>
        <Controls 
          mission={mission} 
          setMission={setMission} 
          leftTab={leftTab}
          setLeftTab={setLeftTab}
          isControlEnabled={isControlEnabled}
          setIsControlEnabled={setIsControlEnabled}
          controlState={controlState}
          startAction={startAction}
          stopAction={stopAction}
        />
      </div>

      {/* CENTER COLUMN: Canvas & Telemetry */}
      <div className={`${mobileTab === 'map' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col overflow-hidden h-full min-w-0 relative`}>
        <header className='h-14 bg-[#0a0c12]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-20 flex-shrink-0'>
          <div className='flex items-center space-x-6 h-full'>
            <div className='flex items-center space-x-2'>
              <div className='w-6 h-6 bg-blue-600 rounded flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.4)]'>
                <div className='w-3 h-3 border-2 border-white rotate-45'></div>
              </div>
              <span className='font-bold text-white tracking-tight hidden sm:inline-block'>FLL ROBOT SIM</span>
            </div>
            <div className='h-4 w-px bg-slate-800 hidden sm:block'></div>
            <div className='flex items-center h-full gap-1'>
              <button
                onClick={() => setCenterTab('map')}
                className={`h-full px-4 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border-b-2 ${centerTab === 'map' ? 'text-blue-400 border-blue-500 bg-slate-900/30' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                <MapIcon size={14} /> Map
              </button>
              <button
                onClick={() => setCenterTab('manager')}
                className={`h-full px-4 text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border-b-2 ${centerTab === 'manager' ? 'text-blue-400 border-blue-500 bg-slate-900/30' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
              >
                <Library size={14} /> Profiles & Missions
              </button>
            </div>
          </div>
          <div className='flex items-center space-x-4'>
            {isControlEnabled && (
              <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>KEYBOARD CONTROL ON</span>
              </div>
            )}
            <Auth />
          </div>
        </header>

        <div className="flex-1 min-h-0 relative bg-[radial-gradient(circle_at_center,_#111827_0%,_#050608_100%)] flex flex-col">
           <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
           {centerTab === 'map' ? (
             <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center p-8">
               {isControlEnabled && (
                 <div className="absolute top-10 left-10 z-20 pointer-events-none flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-emerald-500/40 px-3 py-1.5 rounded-full shadow-lg">
                   <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                   <span className="text-[11px] font-mono font-bold text-emerald-400 tracking-wider">KEYBOARD CONTROL</span>
                   <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">• W/A/S/D drive • J/U/L/O arms • Shift/Ctrl speed</span>
                 </div>
               )}
               <div className="w-full h-full relative overflow-hidden flex items-center justify-center border border-slate-800/50 rounded-lg shadow-xl">
                  <CanvasMap 
                    mission={mission} 
                    setMission={setMission}
                    telemetryRef={telemetryRef} 
                    onRobotMove={handleRobotMove} 
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    addInstruction={(inst) => setMission(m => ({ ...m, instructions: [...m.instructions, inst] }))}
                    resetViewCounter={resetViewCounter}
                    leftTab={leftTab}
                    isControlEnabled={isControlEnabled}
                    liveOffsetRef={liveOffsetRef}
                  />
               </div>
             </div>
           ) : (
             <div className="absolute inset-0 flex flex-col z-10 bg-[#0a0c12]/95 backdrop-blur-sm">
               <ProfileMissionManager currentMission={mission} setMission={setMission} />
             </div>
           )}
        </div>
        {centerTab === 'map' && (
          <>
            <MapToolbar 
              mission={mission} 
              setMission={setMission} 
              isPlaying={isPlaying} 
              setIsPlaying={setIsPlaying}
              resetSimulation={resetSimulation}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              telemetryRef={telemetryRef}
              onResetView={() => setResetViewCounter(c => c + 1)}
            />
            <div className="flex-shrink-0 bg-[#0a0c12] border-t border-slate-800 z-10 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
              <TelemetryDashboard telemetryRef={telemetryRef} />
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: Instructions & Code */}
      <div className={`${mobileTab === 'instructions' ? 'flex flex-1' : 'hidden'} lg:flex w-full lg:flex-none lg:w-[320px] xl:w-[380px] flex-shrink-0 flex-col bg-[#0a0c12] border-l border-slate-800 overflow-hidden h-full z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.5)]`}>
        <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 border-b border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Instructions</h2>
              {mission.instructions.length > 0 && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                  {mission.instructions.length}
                </span>
              )}
            </div>
            {mission.instructions.length > 0 && (
              <button
                onClick={() => setMission(m => ({ ...m, instructions: [] }))}
                className="text-[9px] uppercase tracking-wider font-bold text-slate-500 hover:text-red-400 transition-colors"
                title="Clear all instructions"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <InstructionList 
              instructions={mission.instructions} 
              onChange={inst => setMission(m => ({ ...m, instructions: inst }))} 
            />
          </div>
        </div>
        <div className="h-[300px] sm:h-[320px] flex-shrink-0 p-4 sm:p-6 overflow-hidden">
          <CodeExport mission={mission} setMission={setMission} />
        </div>
      </div>

      {/* MOBILE TAB BAR */}
      <div className="lg:hidden flex-shrink-0 bg-[#0a0c12] border-t border-slate-800 flex items-center justify-around p-2 z-30 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
        <button onClick={() => setMobileTab('controls')} className={`flex flex-col items-center p-2 rounded w-1/3 ${mobileTab === 'controls' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500'}`}>
          <Settings size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Controls</span>
        </button>
        <button onClick={() => setMobileTab('map')} className={`flex flex-col items-center p-2 rounded w-1/3 ${mobileTab === 'map' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500'}`}>
          <MapIcon size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Map</span>
        </button>
        <button onClick={() => setMobileTab('instructions')} className={`flex flex-col items-center p-2 rounded w-1/3 ${mobileTab === 'instructions' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500'}`}>
          <List size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Actions</span>
        </button>
      </div>
    </div>
  );
}
