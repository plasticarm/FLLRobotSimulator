import React, { useState } from 'react';
import { TelemetryData } from '../lib/types';
import { Activity, Clock, Compass, Navigation, Gauge, FastForward, GripHorizontal } from 'lucide-react';

interface TelemetryDashboardProps {
  telemetryRef: React.MutableRefObject<TelemetryData>;
}

export function TelemetryDashboard({ telemetryRef }: TelemetryDashboardProps) {
  const [cards, setCards] = useState([
    { id: 'pos', title: 'Position (X, Y)', icon: Navigation },
    { id: 'angle', title: 'Heading', icon: Compass },
    { id: 'speed', title: 'Speed', icon: FastForward },
    { id: 'time', title: 'Time Progress', icon: Clock },
    { id: 'cmd', title: 'Current Command', icon: Activity },
    { id: 'dist', title: 'Cmd Progress', icon: Gauge },
  ]);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newCards = [...cards];
    const [removed] = newCards.splice(draggedIdx, 1);
    newCards.splice(index, 0, removed);
    setCards(newCards);
    setDraggedIdx(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  React.useEffect(() => {
    let frameId: number;
    const update = () => {
      const t = telemetryRef.current;
      
      const elPos = document.getElementById('telemetry-pos');
      if (elPos) elPos.innerText = `${t.x.toFixed(1)}, ${t.y.toFixed(1)} cm`;
      
      const elAngle = document.getElementById('telemetry-angle');
      if (elAngle) elAngle.innerText = `${(t.angle * 180 / Math.PI).toFixed(1)}°`;

      const elSpeed = document.getElementById('telemetry-speed');
      if (elSpeed) elSpeed.innerText = `${t.speed.toFixed(0)} / s`;

      const elTime = document.getElementById('telemetry-time');
      if (elTime) elTime.innerText = `${t.time.toFixed(1)}s / ${t.totalTime.toFixed(1)}s`;

      const elCmd = document.getElementById('telemetry-cmd');
      if (elCmd) elCmd.innerText = t.instructionIndex >= 0 ? `Step ${t.instructionIndex + 1}` : 'Idle';

      const elDist = document.getElementById('telemetry-dist');
      if (elDist) elDist.innerText = `${Math.max(Math.abs(t.currentDistance), Math.abs(t.currentAngle)).toFixed(1)} done`;

      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [telemetryRef]);

  return (
    <div className="h-16 bg-[#0a0c12] px-4 flex items-center gap-4 overflow-x-auto no-scrollbar border-t border-slate-800">
      <div className="flex items-center gap-2 pr-4 border-r border-slate-800 shrink-0 py-2">
        <Activity size={16} className="text-blue-500" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Telemetry</span>
      </div>
      <div className="flex-1 flex items-center justify-between py-2">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <React.Fragment key={card.id}>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragOver={handleDragOver}
                className="flex flex-col items-center flex-1 min-w-0 cursor-grab active:cursor-grabbing group relative px-2"
              >
                <div className="flex items-center justify-center gap-1.5 mb-1 text-slate-500 w-full relative">
                  <Icon size={12} className="text-blue-500 shrink-0" />
                  <span className="text-[9px] font-bold uppercase tracking-widest truncate">{card.title}</span>
                  <GripHorizontal size={10} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0" />
                </div>
                <div 
                  id={`telemetry-${card.id}`} 
                  className="text-sm font-mono text-white truncate text-center"
                >
                  --
                </div>
              </div>
              {idx < cards.length - 1 && (
                <div className="w-px h-8 bg-slate-800 shrink-0"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
