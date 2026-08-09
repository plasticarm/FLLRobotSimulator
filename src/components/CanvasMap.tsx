import React, { useEffect, useRef, useState } from 'react';
import { MissionConfig, TelemetryData, Point, ActiveTool, Instruction } from '../lib/types';
import { getRobotStateAtTime, calculatePlannedPath, toRadians, calculateTotalTime } from '../lib/simulator';

interface CanvasMapProps {
  mission: MissionConfig;
  setMission: React.Dispatch<React.SetStateAction<MissionConfig>>;
  telemetryRef: React.MutableRefObject<TelemetryData>;
  onRobotMove: (x: number, y: number) => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  addInstruction: (inst: Instruction) => void;
  resetViewCounter: number;
  leftTab: 'mission' | 'robot';
}

const TABLE_WIDTH_MM = 2362;
const TABLE_HEIGHT_MM = 1143;
const TABLE_ASPECT_RATIO = TABLE_WIDTH_MM / TABLE_HEIGHT_MM;

export function CanvasMap({ mission, setMission, telemetryRef, onRobotMove, activeTool, setActiveTool, addInstruction, resetViewCounter, leftTab }: CanvasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const images = useRef<{
    map: HTMLImageElement | null;
    overlay: HTMLImageElement | null;
    names: HTMLImageElement | null;
  }>({ map: null, overlay: null, names: null });

  const [dragTarget, setDragTarget] = useState<{type: 'robot' | 'pivot' | 'arm', id?: string} | null>(null);

  
  // Zoom & Pan state
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const mapBaseSizeRef = useRef({ w: 800, h: 600 });
  const isPanInitializedRef = useRef(false);

  // Tool state
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [pathPoints, setPathPoints] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);

  // Clear tool states when changing tools
  useEffect(() => {
    setMeasurePoints([]);
    setPathPoints([]);
  }, [activeTool]);

  useEffect(() => {
    if (resetViewCounter > 0) {
      zoomRef.current = 1;
      const container = containerRef.current;
      if (container) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        panRef.current = { 
          x: (cw - mapBaseSizeRef.current.w) / 2, 
          y: (ch - mapBaseSizeRef.current.h) / 2 
        };
      }
    }
  }, [resetViewCounter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const zoomIn = e.deltaY < 0;
      const scaleChange = zoomIn ? zoomFactor : 1 / zoomFactor;
      
      const newZoom = Math.max(0.1, Math.min(zoomRef.current * scaleChange, 10));
      const actualScaleChange = newZoom / zoomRef.current;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      panRef.current = {
        x: mouseX - (mouseX - panRef.current.x) * actualScaleChange,
        y: mouseY - (mouseY - panRef.current.y) * actualScaleChange
      };
      
      zoomRef.current = newZoom;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 3) setImagesLoaded(true);
    };

    const img1 = new Image();
    img1.crossOrigin = 'anonymous';
    img1.src = 'https://raw.githubusercontent.com/plasticarm/fllrobotsim/main/MapDiagram.png';
    img1.onload = checkLoaded;
    img1.onerror = checkLoaded; // fallback
    images.current.map = img1;

    const img2 = new Image();
    img2.crossOrigin = 'anonymous';
    img2.src = 'https://raw.githubusercontent.com/plasticarm/fllrobotsim/main/MapImage.png';
    img2.onload = checkLoaded;
    img2.onerror = checkLoaded;
    images.current.overlay = img2;

    const img3 = new Image();
    img3.crossOrigin = 'anonymous';
    img3.src = 'https://raw.githubusercontent.com/plasticarm/fllrobotsim/main/MapMissionNames.png';
    img3.onload = checkLoaded;
    img3.onerror = checkLoaded;
    images.current.names = img3;
  }, []);

  useEffect(() => {
    if (!imagesLoaded) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      
      let mapBaseWidth = cw;
      let mapBaseHeight = ch;
      if (cw / ch > TABLE_ASPECT_RATIO) {
        mapBaseHeight = ch;
        mapBaseWidth = mapBaseHeight * TABLE_ASPECT_RATIO;
      } else {
        mapBaseWidth = cw;
        mapBaseHeight = mapBaseWidth / TABLE_ASPECT_RATIO;
      }
      mapBaseSizeRef.current = { w: mapBaseWidth, h: mapBaseHeight };
      
      canvas.width = cw;
      canvas.height = ch;

      if (!isPanInitializedRef.current) {
        panRef.current = { x: (cw - mapBaseWidth) / 2, y: (ch - mapBaseHeight) / 2 };
        isPanInitializedRef.current = true;
      }
    };

    const cmToPixels = (cm: number) => cm * (mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10)) * zoomRef.current;
    
    const toCanvasCoords = (x: number, y: number) => ({
      x: (x * (mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10)) + mapBaseSizeRef.current.w / 2) * zoomRef.current + panRef.current.x,
      y: (-y * (mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10)) + mapBaseSizeRef.current.h / 2) * zoomRef.current + panRef.current.y,
    });

    const drawMap = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const drawImg = (img: HTMLImageElement, alpha: number = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(panRef.current.x, panRef.current.y);
        ctx.scale(zoomRef.current, zoomRef.current);
        ctx.drawImage(img, 0, 0, mapBaseSizeRef.current.w, mapBaseSizeRef.current.h);
        ctx.restore();
      };

      if (images.current.map?.complete) {
        drawImg(images.current.map);
      } else {
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      if (images.current.overlay?.complete) {
        drawImg(images.current.overlay, mission.map2Opacity);
      }

      if (mission.isMissionNamesVisible && images.current.names?.complete) {
        drawImg(images.current.names);
      }
    };

    const drawPlannedPath = (ctx: CanvasRenderingContext2D) => {
      const pts = calculatePlannedPath(mission.instructions, mission.robotConfig);
      if (pts.length < 2) return;
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const startPos = toCanvasCoords(pts[0].x, pts[0].y);
      ctx.moveTo(startPos.x, startPos.y);
      for (let i = 1; i < pts.length; i++) {
        const p = toCanvasCoords(pts[i].x, pts[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawPathHistory = (ctx: CanvasRenderingContext2D, pathHistory: {x: number, y: number}[]) => {
      if (pathHistory.length < 2) return;
      ctx.strokeStyle = mission.robotConfig.pathColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const s = toCanvasCoords(pathHistory[0].x, pathHistory[0].y);
      ctx.moveTo(s.x, s.y);
      for (let i = 1; i < pathHistory.length; i++) {
        const p = toCanvasCoords(pathHistory[i].x, pathHistory[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };

    const drawRobot = (ctx: CanvasRenderingContext2D, state: TelemetryData) => {
      const pos = toCanvasCoords(state.x, state.y);
      const w = cmToPixels(mission.robotConfig.width);
      const h = cmToPixels(mission.robotConfig.height);
      const pivotYPx = cmToPixels(mission.robotConfig.pivotY);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(state.angle);

      // Body
      ctx.fillStyle = mission.robotConfig.color;
      ctx.fillRect(-w/2, -h/2 + pivotYPx, w, h);

      // Forward line
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, pivotYPx);
      ctx.lineTo(0, -h/2 + pivotYPx);
      ctx.stroke();

      // Wheels
      const wheelW = cmToPixels(1);
      const wheelH = cmToPixels(5.5);
      const offset = w/2;
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(-offset - wheelW/2, -wheelH/2, wheelW, wheelH);
      ctx.fillRect(offset - wheelW/2, -wheelH/2, wheelW, wheelH);

      // Axle
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w/2, 0);
      ctx.lineTo(w/2, 0);
      ctx.stroke();

      // Arms
      mission.robotConfig.arms.forEach(arm => {
        const aW = cmToPixels(arm.width);
        const aH = cmToPixels(arm.height);
        const aX = cmToPixels(arm.xOffset);
        const aY = cmToPixels(arm.yOffset);
        
        ctx.save();
        ctx.translate(aX, aY);
        ctx.rotate(toRadians(arm.rotation));
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-aW/2, -aH/2, aW, aH);
        ctx.restore();
      });

      ctx.restore();
    };

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const totalTime = calculateTotalTime(mission.instructions, mission.robotConfig);
      
      // We read the current time directly from telemetryRef to support playing
      const t = telemetryRef.current.time;
      const state = getRobotStateAtTime(t, mission.instructions, mission.robotConfig, totalTime);
      
      // Update telemetry ref for other components to read
      telemetryRef.current = state;
      
      drawMap(ctx);
      drawPlannedPath(ctx);
      drawPathHistory(ctx, state.pathHistory);
      drawRobot(ctx, state);

      // Draw measure tool
      if (activeTool === 'measure') {
        const pts = [...measurePoints];
        if (pts.length === 1 && mousePos) {
          pts.push(mousePos);
        }
        
        if (pts.length > 0) {
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const s = toCanvasCoords(pts[0].x, pts[0].y);
          ctx.moveTo(s.x, s.y);
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
          ctx.fill();

          if (pts.length === 2) {
            const e = toCanvasCoords(pts[1].x, pts[1].y);
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(e.x, e.y);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
            ctx.fill();

            const dist = Math.sqrt(Math.pow(pts[1].x - pts[0].x, 2) + Math.pow(pts[1].y - pts[0].y, 2));
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(e.x + 10, e.y - 20, 60, 24);
            ctx.fillStyle = '#eab308';
            ctx.font = '12px monospace';
            ctx.fillText(`${dist.toFixed(1)} cm`, e.x + 15, e.y - 4);
          }
        }
      }

      // Draw path tool
      if (activeTool === 'path') {
        const pts = [...pathPoints];
        if (pts.length > 0) {
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const startPos = toCanvasCoords(pts[0].x, pts[0].y);
          ctx.moveTo(startPos.x, startPos.y);
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(startPos.x, startPos.y, 4, 0, Math.PI * 2);
          ctx.fill();

          for (let i = 1; i < pts.length; i++) {
            const p = toCanvasCoords(pts[i].x, pts[i].y);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            const prev = toCanvasCoords(pts[i-1].x, pts[i-1].y);
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }

          if (mousePos && pts.length > 0) {
            const last = toCanvasCoords(pts[pts.length - 1].x, pts[pts.length - 1].y);
            const m = toCanvasCoords(mousePos.x, mousePos.y);
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.font = '10px monospace';
            ctx.fillText(`Dbl-click to finish`, m.x + 10, m.y);
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [imagesLoaded, mission, telemetryRef, activeTool, measurePoints, pathPoints, mousePos]);

  // Dragging & Tool logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle click for panning
      isPanningRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const basePixelsPerCm = mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10);
    const tableX = ((mouseX - panRef.current.x) / zoomRef.current - mapBaseSizeRef.current.w / 2) / basePixelsPerCm;
    const tableY = -((mouseY - panRef.current.y) / zoomRef.current - mapBaseSizeRef.current.h / 2) / basePixelsPerCm;
    
    if (activeTool === 'none') {
      const state = telemetryRef.current;
      const dx = tableX - state.x;
      const dy = tableY - state.y;
      
      if (leftTab === 'robot') {
        const angle = state.angle;
        const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
        const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);
        
        let hitArm = null;
        for (let i = mission.robotConfig.arms.length - 1; i >= 0; i--) {
          const arm = mission.robotConfig.arms[i];
          const armDx = localX - arm.xOffset;
          const armDy = localY - arm.yOffset;
          const rot = toRadians(arm.rotation);
          const armLocalX = armDx * Math.cos(-rot) - armDy * Math.sin(-rot);
          const armLocalY = armDx * Math.sin(-rot) + armDy * Math.cos(-rot);
          
          // Expand hit area slightly
          if (Math.abs(armLocalX) <= arm.width / 2 + 1 && Math.abs(armLocalY) <= arm.height / 2 + 1) {
            hitArm = arm;
            break;
          }
        }

        if (hitArm) {
          setDragTarget({ type: 'arm', id: hitArm.id });
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }

        // Hit test pivot (wheels are at 0,0 local)
        if (Math.abs(localX) < mission.robotConfig.width / 2 && Math.abs(localY) < 3) {
          setDragTarget({ type: 'pivot' });
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
      }

      if (Math.sqrt(dx * dx + dy * dy) < Math.max(15, mission.robotConfig.width / 2)) {
        setDragTarget({ type: 'robot' });
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      } else {
        isPanningRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    } else if (activeTool === 'measure') {
      if (measurePoints.length >= 2) {
        setMeasurePoints([{ x: tableX, y: tableY }]);
      } else {
        setMeasurePoints(prev => [...prev, { x: tableX, y: tableY }]);
      }
    } else if (activeTool === 'path') {
      setPathPoints(prev => [...prev, { x: tableX, y: tableY }]);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === 'path' && pathPoints.length > 1) {
      addInstruction({
        id: Math.random().toString(),
        type: 'followPath',
        points: [...pathPoints]
      });
      setPathPoints([]);
      setActiveTool('none');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const basePixelsPerCm = mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10);
    const tableX = ((mouseX - panRef.current.x) / zoomRef.current - mapBaseSizeRef.current.w / 2) / basePixelsPerCm;
    const tableY = -((mouseY - panRef.current.y) / zoomRef.current - mapBaseSizeRef.current.h / 2) / basePixelsPerCm;
    
    setMousePos({ x: tableX, y: tableY });

    if (!dragTarget || activeTool !== 'none') return;

    if (dragTarget.type === 'robot') {
      onRobotMove(tableX, tableY);
    } else if (dragTarget.type === 'arm' || dragTarget.type === 'pivot') {
      const state = telemetryRef.current;
      const dx = tableX - state.x;
      const dy = tableY - state.y;
      const angle = state.angle;
      const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
      const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);

      if (dragTarget.type === 'arm') {
        const dxWorld = tableX - telemetryRef.current.x;
        const dyWorld = tableY - telemetryRef.current.y;
        const angle = telemetryRef.current.angle;
        const localX = dxWorld * Math.cos(-angle) - dyWorld * Math.sin(-angle);
        const localY = dxWorld * Math.sin(-angle) + dyWorld * Math.cos(-angle);

        setMission(m => ({
          ...m,
          robotConfig: {
            ...m.robotConfig,
            arms: m.robotConfig.arms.map(a => a.id === dragTarget.id ? { ...a, xOffset: localX, yOffset: localY } : a)
          }
        }));
      } else if (dragTarget.type === 'pivot') {
        // Calculate the drag delta in world space based on mouse movement since last frame
        const mouseDx = e.clientX - lastMousePosRef.current.x;
        const mouseDy = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        const basePixelsPerCm = mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10);
        // Convert screen delta to world delta
        const worldDx = mouseDx / zoomRef.current / basePixelsPerCm;
        const worldDy = -mouseDy / zoomRef.current / basePixelsPerCm;
        
        // Convert world delta to local delta
        const angle = telemetryRef.current.angle;
        const localDy = worldDx * Math.sin(-angle) + worldDy * Math.cos(-angle);

        setMission(m => ({
          ...m,
          robotConfig: {
            ...m.robotConfig,
            pivotY: m.robotConfig.pivotY - localDy
          }
        }));
      }
    }
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    setDragTarget(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setMousePos(null); }}
        onDoubleClick={handleDoubleClick}
        className={`${dragTarget !== null ? 'cursor-grabbing' : (activeTool !== 'none' ? 'cursor-crosshair' : 'cursor-grab')} shadow-2xl`}
      />
    </div>
  );
}
