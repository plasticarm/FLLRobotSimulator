import React, { useState } from 'react';
import { Instruction } from '../lib/types';
import { GripVertical, Trash2, Edit2, Check } from 'lucide-react';

interface Props {
  instructions: Instruction[];
  onChange: (instructions: Instruction[]) => void;
}

export function InstructionList({ instructions, onChange }: Props) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{distance?: number, angle?: number, speed?: number}>({});

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const newInst = [...instructions];
    const [removed] = newInst.splice(draggedIdx, 1);
    newInst.splice(index, 0, removed);
    onChange(newInst);
    setDraggedIdx(null);
  };

  const remove = (index: number) => {
    const newInst = [...instructions];
    newInst.splice(index, 1);
    onChange(newInst);
    if (editingIdx === index) setEditingIdx(null);
  };

  const startEdit = (index: number, inst: Instruction) => {
    setEditingIdx(index);
    setEditValues({
      distance: inst.distance,
      angle: inst.angle,
      speed: inst.speed
    });
  };

  const saveEdit = (index: number) => {
    const newInst = [...instructions];
    if (editValues.distance !== undefined) newInst[index].distance = editValues.distance;
    if (editValues.angle !== undefined) newInst[index].angle = editValues.angle;
    if (editValues.speed !== undefined) newInst[index].speed = editValues.speed;
    onChange(newInst);
    setEditingIdx(null);
  };

  return (
    <div className="flex flex-col gap-1 h-full overflow-y-auto pr-2">
      {instructions.map((inst, idx) => {
        const getLabel = () => {
          switch (inst.type) {
            case 'move': return `Move ${inst.distance}cm @ ${inst.speed}`;
            case 'rotate': return `Rotate ${inst.angle}° @ ${inst.speed}`;
            case 'followPath': return `Follow Path (${inst.points?.length} pts)`;
            case 'motor1': return `Motor 1 Rot ${inst.angle}°`;
            case 'motor2': return `Motor 2 Rot ${inst.angle}°`;
            default: return 'Unknown';
          }
        };

        const bgColors: Record<string, string> = {
          move: 'bg-blue-600/10 border-blue-500/30 text-blue-400',
          rotate: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
          followPath: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
          motor1: 'bg-slate-700/30 border-slate-700 text-slate-300',
          motor2: 'bg-slate-700/30 border-slate-700 text-slate-300',
        };

        const isEditing = editingIdx === idx;

        return (
          <div
            key={inst.id}
            draggable={!isEditing}
            onDragStart={(e) => !isEditing && handleDragStart(e, idx)}
            onDrop={(e) => !isEditing && handleDrop(e, idx)}
            onDragOver={(e) => e.preventDefault()}
            className={`flex flex-col p-2 rounded border-l-2 border-y border-r ${bgColors[inst.type]} ${!isEditing && 'cursor-grab active:cursor-grabbing hover:bg-slate-800'} transition-colors group`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs font-mono font-bold opacity-70 w-4 text-center">{idx + 1}</span>
                <span className="text-xs font-medium truncate">{getLabel()}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isEditing ? (
                  <button onClick={() => saveEdit(idx)} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500 transition-colors shrink-0">
                    <Check size={12} />
                  </button>
                ) : (
                  <>
                    {inst.type !== 'followPath' && (
                      <button onClick={() => startEdit(idx, inst)} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-blue-400 transition-colors shrink-0">
                        <Edit2 size={12} />
                      </button>
                    )}
                    <button onClick={() => remove(idx)} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {isEditing && (
              <div className="mt-2 pt-2 border-t border-slate-700/50 flex gap-2">
                {inst.type === 'move' && (
                  <div className="flex-1">
                    <label className="text-[9px] uppercase tracking-widest text-slate-500">Dist (cm)</label>
                    <input type="number" value={Number.isNaN(editValues.distance) ? "" : editValues.distance || 0} onChange={e => setEditValues({...editValues, distance: parseFloat(e.target.value)})} className="w-full bg-slate-900/80 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-300 font-mono mt-1" />
                  </div>
                )}
                {(inst.type === 'rotate' || inst.type === 'motor1' || inst.type === 'motor2') && (
                  <div className="flex-1">
                    <label className="text-[9px] uppercase tracking-widest text-slate-500">Angle (°)</label>
                    <input type="number" value={Number.isNaN(editValues.angle) ? "" : editValues.angle || 0} onChange={e => setEditValues({...editValues, angle: parseFloat(e.target.value)})} className="w-full bg-slate-900/80 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-300 font-mono mt-1" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-500">Speed</label>
                  <input type="number" value={Number.isNaN(editValues.speed) ? "" : editValues.speed || 0} onChange={e => setEditValues({...editValues, speed: parseFloat(e.target.value)})} className="w-full bg-slate-900/80 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-300 font-mono mt-1" />
                </div>
              </div>
            )}
          </div>
        );
      })}
      {instructions.length === 0 && (
        <div className="text-center py-6 text-slate-600 text-[10px] font-mono border border-dashed border-slate-800 rounded">
          NO INSTRUCTIONS
        </div>
      )}
    </div>
  );
}
