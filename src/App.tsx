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
  const [resetViewCounter, setResetViewCounter] = useState(0);
  
  const telemetryRef = useRef<TelemetryData>({
    time: 0,
    totalTime: 0,
    x: 0, y: 0, angle: 0,
    currentDistance: 0, currentAngle: 0,
    instructionIndex: -1, speed: 0
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
      <div className="w-full lg:w-[300px] flex-shrink-0 flex flex-col bg-[#0a0c12] border-r border-slate-800 overflow-hidden h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <Controls 
          mission={mission} 
          setMission={setMission} 
          leftTab={leftTab}
          setLeftTab={setLeftTab}
        />
      </div>

      {/* CENTER COLUMN: Canvas & Telemetry */}
      <div className="flex-1 flex flex-col overflow-hidden h-full min-w-0 relative">
        <header className='h-14 bg-[#0a0c12]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-20 flex-shrink-0'>
          <div className='flex items-center space-x-6'>
            <div className='flex items-center space-x-2'>
              <div className='w-6 h-6 bg-blue-600 rounded flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.4)]'>
                <div className='w-3 h-3 border-2 border-white rotate-45'></div>
              </div>
              <span className='font-bold text-white tracking-tight'>FLL ROBOT SIM</span>
            </div>
            <div className='h-4 w-px bg-slate-800'></div>
            <div className='flex items-center space-x-2'>
              <span className='text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20'>LIVE</span>
              <span className='text-sm font-medium text-white'>{mission.missionName || "Unnamed Mission"}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 relative bg-[radial-gradient(circle_at_center,_#111827_0%,_#050608_100%)] flex items-center justify-center p-8">
           <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
           <div className="w-full h-full relative overflow-hidden flex items-center justify-center border border-slate-800/50 rounded-lg">
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
              />
           </div>
        </div>
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
      </div>

      {/* RIGHT COLUMN: Instructions & Code */}
      <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col bg-[#0a0c12] border-l border-slate-800 overflow-hidden h-full z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="flex-1 flex flex-col p-6 border-b border-slate-800">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex-shrink-0">Instructions</h2>
          <div className="flex-1 min-h-0">
            <InstructionList 
              instructions={mission.instructions} 
              onChange={inst => setMission(m => ({ ...m, instructions: inst }))} 
            />
          </div>
        </div>
        <div className="h-[320px] flex-shrink-0 p-6">
          <CodeExport mission={mission} setMission={setMission} />
        </div>
      </div>

    </div>
  );
}
