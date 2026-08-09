import React, { useState } from 'react';
import { MissionConfig } from '../lib/types';
import { generatePythonCode } from '../lib/codegen';
import { Copy, Download, Code, Settings } from 'lucide-react';

interface Props {
  mission: MissionConfig;
  setMission: React.Dispatch<React.SetStateAction<MissionConfig>>;
}

export function CodeExport({ mission, setMission }: Props) {
  const [code, setCode] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'functions'>('code');

  React.useEffect(() => {
    setCode(generatePythonCode(mission));
  }, [mission]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
  };

  const downloadFile = () => {
    const filename = `${mission.missionName.replace(/[^a-zA-Z0-9]/g, '_') || 'robot_mission'}.py`;
    const blob = new Blob([code], { type: 'text/x-python' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const updateFn = (key: keyof MissionConfig['functionNames'], val: string) => {
    setMission(m => ({
      ...m,
      functionNames: { ...m.functionNames, [key]: val }
    }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded overflow-hidden border border-slate-800">
      <div className="bg-[#0a0c12] flex justify-between items-center border-b border-slate-800">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('code')}
            className={`px-3 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center gap-1 border-b-2 ${activeTab === 'code' ? 'text-blue-400 border-blue-500 bg-slate-900/30' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Code size={12} /> Code
          </button>
          <button 
            onClick={() => setActiveTab('functions')}
            className={`px-3 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center gap-1 border-b-2 ${activeTab === 'functions' ? 'text-blue-400 border-blue-500 bg-slate-900/30' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Settings size={12} /> Functions
          </button>
        </div>
        {activeTab === 'code' && (
          <div className="flex gap-2 pr-3">
            <button onClick={copyToClipboard} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition-colors" title="Copy to clipboard">
              <Copy size={12} />
            </button>
            <button onClick={downloadFile} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 transition-colors" title="Download .py file">
              <Download size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 relative">
        {activeTab === 'code' ? (
          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">{code}</pre>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase font-bold tracking-widest">Move Function</label>
              <input type="text" value={mission.functionNames.move} onChange={e => updateFn('move', e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase font-bold tracking-widest">Rotate Function</label>
              <input type="text" value={mission.functionNames.rotate} onChange={e => updateFn('rotate', e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase font-bold tracking-widest">Motor 1 Function</label>
              <input type="text" value={mission.functionNames.motor1} onChange={e => updateFn('motor1', e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1 uppercase font-bold tracking-widest">Motor 2 Function</label>
              <input type="text" value={mission.functionNames.motor2} onChange={e => updateFn('motor2', e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 rounded px-2 py-1 text-sm text-slate-300 font-mono" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
