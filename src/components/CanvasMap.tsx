import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MissionConfig, TelemetryData, Point, ActiveTool, Instruction, Measurement } from '../lib/types';
import { getRobotStateAtTime, calculatePlannedPath, toRadians, calculateTotalTime } from '../lib/simulator';
import { LiveOffset } from '../lib/useKeyboardControl';
import { Maximize2, Minimize2, EyeOff } from 'lucide-react';

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
  isControlEnabled?: boolean;
  liveOffsetRef?: React.MutableRefObject<LiveOffset | null>;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

const TABLE_WIDTH_MM = 2362;
const TABLE_HEIGHT_MM = 1143;
const TABLE_ASPECT_RATIO = TABLE_WIDTH_MM / TABLE_HEIGHT_MM;
const HALF_TABLE_W_CM = (TABLE_WIDTH_MM / 10) / 2; // 118.1 cm
const HALF_TABLE_H_CM = (TABLE_HEIGHT_MM / 10) / 2; // 57.15 cm

function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projX, p.y - projY);
}

function findMeasurementHit(
  measList: Measurement[],
  tableX: number,
  tableY: number,
  basePixelsPerCm: number,
  zoom: number
) {
  const clickPt: Point = { x: tableX, y: tableY };
  // Tolerances in cm (approx 14px for points, 12px for lines)
  const pointToleranceCm = 14 / (basePixelsPerCm * zoom);
  const lineToleranceCm = 12 / (basePixelsPerCm * zoom);

  // 1. Check points first (top-most / newest first)
  for (let mIdx = measList.length - 1; mIdx >= 0; mIdx--) {
    const meas = measList[mIdx];
    if (!meas.points) continue;
    for (let pIdx = 0; pIdx < meas.points.length; pIdx++) {
      const pt = meas.points[pIdx];
      const dist = Math.hypot(pt.x - tableX, pt.y - tableY);
      if (dist <= pointToleranceCm) {
        return {
          type: 'point' as const,
          measurementId: meas.id,
          pointIndex: pIdx,
        };
      }
    }
  }

  // 2. Check line segments second
  for (let mIdx = measList.length - 1; mIdx >= 0; mIdx--) {
    const meas = measList[mIdx];
    if (!meas.points || meas.points.length < 2) continue;
    for (let pIdx = 0; pIdx < meas.points.length - 1; pIdx++) {
      const p1 = meas.points[pIdx];
      const p2 = meas.points[pIdx + 1];
      const dist = distToSegment(clickPt, p1, p2);
      if (dist <= lineToleranceCm) {
        return {
          type: 'line' as const,
          measurementId: meas.id,
          segmentIndex: pIdx,
        };
      }
    }
  }

  return null;
}

type DragTarget = 
  | { type: 'robot' }
  | { type: 'pivot' }
  | { type: 'arm'; id: string }
  | { type: 'measurePoint'; id: string; pointIndex: number }
  | { type: 'measureLine'; id: string; lastTablePos: Point; isOffMap?: boolean };

export function CanvasMap({
  mission,
  setMission,
  telemetryRef,
  onRobotMove,
  activeTool,
  setActiveTool,
  addInstruction,
  resetViewCounter,
  leftTab,
  isControlEnabled,
  liveOffsetRef,
  isMaximized,
  onToggleMaximize,
}: CanvasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const images = useRef<{
    map: HTMLImageElement | null;
    overlay: HTMLImageElement | null;
    names: HTMLImageElement | null;
  }>({ map: null, overlay: null, names: null });

  // Measurement selection and dragging
  const [selectedMeasureId, setSelectedMeasureIdState] = useState<string | null>(null);
  const selectedMeasureIdRef = useRef<string | null>(null);
  const setSelectedMeasureId = (id: string | null) => {
    selectedMeasureIdRef.current = id;
    setSelectedMeasureIdState(id);
  };

  const [hoveredMeasure, setHoveredMeasure] = useState<{
    type: 'point' | 'line';
    measurementId: string;
    index: number;
  } | null>(null);

  const [dragTarget, setDragTargetState] = useState<DragTarget | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const setDragTarget = (target: DragTarget | null) => {
    dragTargetRef.current = target;
    setDragTargetState(target);
  };
  
  // Zoom & Pan state
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const mapBaseSizeRef = useRef({ w: 800, h: 600 });
  const isPanInitializedRef = useRef(false);

  // Active in-progress tool state
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [pathPoints, setPathPoints] = useState<Point[]>([]);
  const mousePosRef = useRef<Point | null>(null);

  // Sync refs so the 60fps canvas render loop reads latest state without rebuilding effect
  const missionRef = useRef(mission);
  useEffect(() => {
    missionRef.current = mission;
  }, [mission]);

  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const measurePointsRef = useRef(measurePoints);
  useEffect(() => {
    measurePointsRef.current = measurePoints;
  }, [measurePoints]);

  const pathPointsRef = useRef(pathPoints);
  useEffect(() => {
    pathPointsRef.current = pathPoints;
  }, [pathPoints]);

  const isControlEnabledRef = useRef(isControlEnabled);
  useEffect(() => {
    isControlEnabledRef.current = isControlEnabled;
  }, [isControlEnabled]);

  // Clear in-progress tool states when changing tools
  useEffect(() => {
    setMeasurePoints([]);
    setPathPoints([]);
  }, [activeTool]);

  // Finalize in-progress measurement and leave on board
  const finalizeMeasurement = useCallback(() => {
    setMeasurePoints(prev => {
      if (prev.length < 2) return [];

      // Filter consecutive duplicate points (e.g. from rapid double-click)
      const cleaned: Point[] = [];
      for (let i = 0; i < prev.length; i++) {
        if (cleaned.length === 0) {
          cleaned.push(prev[i]);
        } else {
          const last = cleaned[cleaned.length - 1];
          const dist = Math.hypot(prev[i].x - last.x, prev[i].y - last.y);
          if (dist > 0.5) {
            cleaned.push(prev[i]);
          }
        }
      }

      if (cleaned.length >= 2) {
        const newMeasurement: Measurement = {
          id: 'meas_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          points: cleaned,
        };
        setMission(m => ({
          ...m,
          measurements: [...(m.measurements || []), newMeasurement],
          isMeasurementsVisible: true,
        }));
        setSelectedMeasureId(newMeasurement.id);
      }
      return [];
    });
    setActiveTool('none');
  }, [setActiveTool, setMission]);

  // Keyboard controls for measurement:
  // - Return/Enter to complete measurement
  // - Delete/Backspace to delete selected measurement
  // - Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // 1. Enter / Return: End measurement and leave on board
      if (e.key === 'Enter' || e.key === 'Return') {
        if (activeTool === 'measure') {
          e.preventDefault();
          finalizeMeasurement();
        }
      }

      // 2. Del / Delete / Backspace: Delete selected measurement
      if (e.key === 'Delete' || e.key === 'Del' || e.key === 'Backspace') {
        if (selectedMeasureIdRef.current) {
          e.preventDefault();
          const idToDelete = selectedMeasureIdRef.current;
          setMission(m => ({
            ...m,
            measurements: (m.measurements || []).filter(meas => meas.id !== idToDelete),
          }));
          setSelectedMeasureId(null);
        }
      }

      // 3. Escape: Cancel in-progress measurement or deselect
      if (e.key === 'Escape') {
        if (activeTool === 'measure') {
          setMeasurePoints([]);
          setActiveTool('none');
        } else if (selectedMeasureIdRef.current) {
          setSelectedMeasureId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, finalizeMeasurement, setMission, setActiveTool]);

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
    img1.onerror = checkLoaded;
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
      if (cw === 0 || ch === 0) return;
      
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
      
      // Guard canvas dimension changes to avoid clearing canvas buffer on redundant calls
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

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

    const drawMap = (ctx: CanvasRenderingContext2D, curMission: MissionConfig) => {
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
        drawImg(images.current.overlay, curMission.map2Opacity);
      }

      if (curMission.isMissionNamesVisible && images.current.names?.complete) {
        drawImg(images.current.names);
      }
    };

    const drawPlannedPath = (ctx: CanvasRenderingContext2D, curMission: MissionConfig) => {
      const pts = calculatePlannedPath(curMission.instructions, curMission.robotConfig);
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

    const drawPathHistory = (ctx: CanvasRenderingContext2D, curMission: MissionConfig, pathHistory: {x: number, y: number}[]) => {
      if (pathHistory.length < 2) return;
      ctx.strokeStyle = curMission.robotConfig.pathColor;
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

    const drawRobot = (ctx: CanvasRenderingContext2D, curMission: MissionConfig, state: TelemetryData) => {
      const pos = toCanvasCoords(state.x, state.y);
      const w = cmToPixels(curMission.robotConfig.width);
      const h = cmToPixels(curMission.robotConfig.height);
      const pivotYPx = cmToPixels(curMission.robotConfig.pivotY);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(state.angle);

      // Body
      ctx.fillStyle = curMission.robotConfig.color;
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
      curMission.robotConfig.arms.forEach((arm, idx) => {
        const aW = cmToPixels(arm.width);
        const aH = cmToPixels(arm.height);
        const aX = cmToPixels(arm.xOffset);
        const aY = cmToPixels(arm.yOffset);
        
        let rot = arm.rotation;
        if (state.armRotations) {
          if (arm.id === 'arm1' || idx === 0) {
            rot = state.armRotations.arm1;
          } else if (arm.id === 'arm2' || idx === 1) {
            rot = state.armRotations.arm2;
          }
        }

        ctx.save();
        ctx.translate(aX, aY);
        ctx.rotate(toRadians(rot));
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-aW/2, -aH/2, aW, aH);
        ctx.restore();
      });

      ctx.restore();
    };

    const drawMeasurement = (
      ctx: CanvasRenderingContext2D,
      pts: Point[],
      isSelected: boolean,
      isDeleting: boolean,
      isInProgress: boolean
    ) => {
      if (pts.length === 0) return;

      const strokeColor = isDeleting ? '#ef4444' : (isSelected ? '#facc15' : '#eab308');
      const pointColor = isDeleting ? '#ef4444' : (isSelected ? '#facc15' : '#eab308');

      ctx.save();
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = strokeColor;
      if (isDeleting) {
        ctx.setLineDash([6, 6]);
      } else {
        ctx.setLineDash([]);
      }

      if (isSelected && !isDeleting) {
        ctx.shadowColor = 'rgba(250, 204, 21, 0.4)';
        ctx.shadowBlur = 8;
      }

      // Draw lines
      for (let i = 1; i < pts.length; i++) {
        const prev = toCanvasCoords(pts[i - 1].x, pts[i - 1].y);
        const curr = toCanvasCoords(pts[i].x, pts[i].y);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      // Draw points and badges
      let totalDist = 0;

      for (let i = 0; i < pts.length; i++) {
        const p = toCanvasCoords(pts[i].x, pts[i].y);

        // Point circle
        ctx.beginPath();
        if (isSelected && !isDeleting) {
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = pointColor;
          ctx.fill();
        } else {
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = pointColor;
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Distance on segment
        if (i > 0) {
          const prev = toCanvasCoords(pts[i - 1].x, pts[i - 1].y);
          const dist = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          totalDist += dist;

          const midX = (prev.x + p.x) / 2;
          const midY = (prev.y + p.y) / 2;
          
          ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
          ctx.strokeStyle = isDeleting ? 'rgba(239, 68, 68, 0.6)' : (isSelected ? 'rgba(250, 204, 21, 0.8)' : 'rgba(234, 179, 8, 0.4)');
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(midX - 32, midY - 12, 64, 24);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = strokeColor;
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${dist.toFixed(1)} cm`, midX, midY);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }

        // Angle between segments at intermediate vertices
        if (i > 0 && i < pts.length - 1) {
          const p0 = pts[i - 1];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const b = Math.atan2(p0.y - p1.y, p0.x - p1.x);
          let angle = Math.abs((a - b) * 180 / Math.PI);
          if (angle > 180) angle = 360 - angle;

          ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.rect(p.x + 8, p.y + 8, 56, 22);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${angle.toFixed(1)}°`, p.x + 36, p.y + 19);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }

      // Total distance badge
      if (pts.length > 1) {
        const last = toCanvasCoords(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.fillStyle = 'rgba(10, 12, 18, 0.9)';
        ctx.strokeStyle = isDeleting ? '#ef4444' : (isSelected ? '#facc15' : '#eab308');
        ctx.lineWidth = isSelected ? 1.5 : 1;
        
        const badgeText = isDeleting 
          ? '🗑️ Release off map to delete' 
          : `Total: ${totalDist.toFixed(1)}cm${isSelected ? ' [Del]' : ''}`;
        
        ctx.font = 'bold 12px monospace';
        const textWidth = ctx.measureText(badgeText).width;
        const badgeW = textWidth + 18;
        const badgeH = 24;

        ctx.beginPath();
        ctx.rect(last.x + 10, last.y - 30, badgeW, badgeH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDeleting ? '#ef4444' : (isSelected ? '#fde047' : '#eab308');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, last.x + 19, last.y - 18);
        ctx.textBaseline = 'alphabetic';
      }

      ctx.restore();
    };

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const curMission = missionRef.current;
      const curTool = activeToolRef.current;
      const curMeasurePts = measurePointsRef.current;
      const curPathPts = pathPointsRef.current;
      const curMousePos = mousePosRef.current;
      const curControlEnabled = isControlEnabledRef.current;

      const totalTime = calculateTotalTime(curMission.instructions, curMission.robotConfig);
      
      // We read the current time directly from telemetryRef to support playing
      const t = telemetryRef.current.time;
      const state = getRobotStateAtTime(t, curMission.instructions, curMission.robotConfig, totalTime);

      // Apply live offset from keyboard driving if active
      if (curControlEnabled && liveOffsetRef?.current) {
        const live = liveOffsetRef.current;
        if (live.type === 'move') {
          state.x += live.value * Math.sin(state.angle);
          state.y += live.value * Math.cos(state.angle);
          state.currentDistance = live.value;
          state.speed = live.speed;
          state.pathHistory.push({ x: state.x, y: state.y });
        } else if (live.type === 'rotate') {
          state.angle += toRadians(live.value);
          state.currentAngle = live.value;
          state.speed = live.speed;
        } else if (live.type === 'motor1') {
          if (state.armRotations) {
            state.armRotations.arm1 += live.value;
          }
          state.speed = live.speed;
        } else if (live.type === 'motor2') {
          if (state.armRotations) {
            state.armRotations.arm2 += live.value;
          }
          state.speed = live.speed;
        }
      }
      
      // Update telemetry ref for other components to read
      telemetryRef.current = state;
      
      drawMap(ctx, curMission);
      drawPlannedPath(ctx, curMission);
      drawPathHistory(ctx, curMission, state.pathHistory);
      drawRobot(ctx, curMission, state);

      // 1. Draw all completed measurements from mission.measurements (if visible)
      const isMeasurementsVisible = curMission.isMeasurementsVisible !== false;
      if (isMeasurementsVisible) {
        const completedMeasurements = curMission.measurements || [];
        completedMeasurements.forEach(meas => {
          const isSelected = selectedMeasureIdRef.current === meas.id;
          const isDeleting = Boolean(
            dragTargetRef.current?.type === 'measureLine' &&
            dragTargetRef.current?.id === meas.id &&
            dragTargetRef.current?.isOffMap
          );
          drawMeasurement(ctx, meas.points, isSelected, isDeleting, false);
        });
      }

      // 2. Draw active in-progress measure tool
      if (curTool === 'measure') {
        const pts = [...curMeasurePts];
        if (curMousePos) {
          pts.push(curMousePos);
        }
        if (pts.length > 0) {
          drawMeasurement(ctx, pts, false, false, true);
        }
      }

      // 3. Draw active path tool
      if (curTool === 'path') {
        const pts = [...curPathPts];
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

          if (curMousePos && pts.length > 0) {
            const last = toCanvasCoords(pts[pts.length - 1].x, pts[pts.length - 1].y);
            const m = toCanvasCoords(curMousePos.x, curMousePos.y);
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

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    render();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [imagesLoaded, telemetryRef, liveOffsetRef]);

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
    
    // Check hit on existing measurements (only if measurements are visible)
    const isMeasurementsVisible = mission.isMeasurementsVisible !== false;
    const currentMeasurements = isMeasurementsVisible ? (mission.measurements || []) : [];
    if (isMeasurementsVisible && (activeTool === 'none' || (activeTool === 'measure' && measurePoints.length === 0))) {
      const hit = findMeasurementHit(currentMeasurements, tableX, tableY, basePixelsPerCm, zoomRef.current);
      if (hit) {
        if (e.button === 2) {
          // Right click to toggle selection
          setSelectedMeasureId(hit.measurementId);
          return;
        }

        setSelectedMeasureId(hit.measurementId);
        if (hit.type === 'point') {
          setDragTarget({
            type: 'measurePoint',
            id: hit.measurementId,
            pointIndex: hit.pointIndex,
          });
        } else {
          setDragTarget({
            type: 'measureLine',
            id: hit.measurementId,
            lastTablePos: { x: tableX, y: tableY },
            isOffMap: false,
          });
        }
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
    }

    if (activeTool === 'none') {
      // Deselect measurement if clicked empty area
      if (selectedMeasureIdRef.current) {
        setSelectedMeasureId(null);
      }

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
      if (e.button === 2) { // Right click to clear active measurement in progress
        setMeasurePoints([]);
      } else {
        setSelectedMeasureId(null);
        setMeasurePoints(prev => [...prev, { x: tableX, y: tableY }]);
      }
    } else if (activeTool === 'path') {
      if (e.button === 2) {
        setPathPoints([]);
      } else {
        setPathPoints(prev => [...prev, { x: tableX, y: tableY }]);
      }
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
    } else if (activeTool === 'measure') {
      finalizeMeasurement();
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
    
    mousePosRef.current = { x: tableX, y: tableY };

    // Hover state detection when not dragging (only if measurements are visible)
    const isMeasurementsVisible = mission.isMeasurementsVisible !== false;
    if (!dragTarget && activeTool === 'none' && isMeasurementsVisible) {
      const hit = findMeasurementHit(mission.measurements || [], tableX, tableY, basePixelsPerCm, zoomRef.current);
      setHoveredMeasure(prev => {
        if (!hit) return prev ? null : prev;
        const newIndex = hit.type === 'point' ? hit.pointIndex : hit.segmentIndex;
        if (prev && prev.type === hit.type && prev.measurementId === hit.measurementId && prev.index === newIndex) {
          return prev;
        }
        return {
          type: hit.type,
          measurementId: hit.measurementId,
          index: newIndex,
        };
      });
    } else {
      setHoveredMeasure(prev => (prev !== null ? null : prev));
    }

    if (!dragTarget) return;

    // 1. Reposition measurement point
    if (dragTarget.type === 'measurePoint') {
      setMission(m => ({
        ...m,
        measurements: (m.measurements || []).map(meas => {
          if (meas.id === dragTarget.id) {
            const nextPoints = [...meas.points];
            nextPoints[dragTarget.pointIndex] = { x: tableX, y: tableY };
            return { ...meas, points: nextPoints };
          }
          return meas;
        }),
      }));
      return;
    }

    // 2. Drag entire measurement line
    if (dragTarget.type === 'measureLine') {
      const dx = tableX - dragTarget.lastTablePos.x;
      const dy = tableY - dragTarget.lastTablePos.y;

      const isOffMap = Math.abs(tableX) > HALF_TABLE_W_CM || Math.abs(tableY) > HALF_TABLE_H_CM;
      const isOutOfCanvas = mouseX < 0 || mouseX > canvas.width || mouseY < 0 || mouseY > canvas.height;
      const currentlyOff = isOffMap || isOutOfCanvas;

      if (dx !== 0 || dy !== 0) {
        setMission(m => ({
          ...m,
          measurements: (m.measurements || []).map(meas => {
            if (meas.id === dragTarget.id) {
              return {
                ...meas,
                points: meas.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
              };
            }
            return meas;
          }),
        }));
        dragTarget.lastTablePos = { x: tableX, y: tableY };
      }
      dragTarget.isOffMap = currentlyOff;
      return;
    }

    if (activeTool !== 'none') return;

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
        const armAngle = telemetryRef.current.angle;
        const armLocalX = dxWorld * Math.cos(-armAngle) - dyWorld * Math.sin(-armAngle);
        const armLocalY = dxWorld * Math.sin(-armAngle) + dyWorld * Math.cos(-armAngle);

        setMission(m => ({
          ...m,
          robotConfig: {
            ...m.robotConfig,
            arms: m.robotConfig.arms.map(a => a.id === dragTarget.id ? { ...a, xOffset: armLocalX, yOffset: armLocalY } : a)
          }
        }));
      } else if (dragTarget.type === 'pivot') {
        const mouseDx = e.clientX - lastMousePosRef.current.x;
        const mouseDy = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        const basePixelsPerCm = mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10);
        const worldDx = mouseDx / zoomRef.current / basePixelsPerCm;
        const worldDy = -mouseDy / zoomRef.current / basePixelsPerCm;
        
        const pivotAngle = telemetryRef.current.angle;
        const localDy = worldDx * Math.sin(-pivotAngle) + worldDy * Math.cos(-pivotAngle);

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

  const handleMouseUp = (e?: React.MouseEvent) => {
    // If user dragged the measurement line off the map and out of the map view, delete it!
    if (dragTarget?.type === 'measureLine') {
      const canvas = canvasRef.current;
      let shouldDelete = Boolean(dragTarget.isOffMap);

      if (canvas && e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const basePixelsPerCm = mapBaseSizeRef.current.w / (TABLE_WIDTH_MM / 10);
        const tableX = ((mouseX - panRef.current.x) / zoomRef.current - mapBaseSizeRef.current.w / 2) / basePixelsPerCm;
        const tableY = -((mouseY - panRef.current.y) / zoomRef.current - mapBaseSizeRef.current.h / 2) / basePixelsPerCm;

        const isOffMap = Math.abs(tableX) > HALF_TABLE_W_CM || Math.abs(tableY) > HALF_TABLE_H_CM;
        const isOutOfCanvas = mouseX < 0 || mouseX > canvas.width || mouseY < 0 || mouseY > canvas.height;

        const meas = (mission.measurements || []).find(m => m.id === dragTarget.id);
        const allPointsOff = meas && meas.points.length > 0 && meas.points.every(p => Math.abs(p.x) > HALF_TABLE_W_CM || Math.abs(p.y) > HALF_TABLE_H_CM);

        if (isOffMap || isOutOfCanvas || allPointsOff) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        setMission(m => ({
          ...m,
          measurements: (m.measurements || []).filter(item => item.id !== dragTarget.id),
        }));
        setSelectedMeasureId(null);
      }
    }

    isPanningRef.current = false;
    setDragTarget(null);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (dragTarget?.type === 'measureLine') {
      // Dragged line off the map and out of the Map view -> delete measurement
      setMission(m => ({
        ...m,
        measurements: (m.measurements || []).filter(item => item.id !== dragTarget.id),
      }));
      setSelectedMeasureId(null);
    }
    handleMouseUp(e);
    mousePosRef.current = null;
    setHoveredMeasure(null);
  };

  const getCursorClass = () => {
    if (dragTarget !== null) return 'cursor-grabbing';
    if (hoveredMeasure?.type === 'point') return 'cursor-move';
    if (hoveredMeasure?.type === 'line') return 'cursor-grab';
    if (activeTool !== 'none') return 'cursor-crosshair';
    return 'cursor-grab';
  };

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center justify-center overflow-hidden">
      {/* Floating hints for active measuring tool */}
      {activeTool === 'measure' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-yellow-500/40 px-3.5 py-1.5 rounded-full shadow-lg">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
          <span className="text-[11px] font-mono font-bold text-yellow-400 tracking-wider">MEASURE TOOL</span>
          <span className="text-[10px] text-slate-300 font-sans hidden sm:inline">• Click points • Double-click or Enter to finish</span>
        </div>
      )}

      {/* Floating hints for selected measurement */}
      {selectedMeasureId && activeTool === 'none' && !dragTarget && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-yellow-400/50 px-3.5 py-1.5 rounded-full shadow-lg">
          <span className="text-[11px] font-mono font-bold text-yellow-300 tracking-wider">MEASUREMENT SELECTED</span>
          <span className="text-[10px] text-slate-300 font-sans hidden sm:inline">• Drag line to move • Drag points to reposition • Del to delete • Drag off map to delete</span>
        </div>
      )}

      {/* Maximize / Restore floating button on canvas */}
      {onToggleMaximize && (
        <button
          type="button"
          onClick={onToggleMaximize}
          className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-blue-500/60 transition-all cursor-pointer group"
          title={isMaximized ? "Exit Fullscreen (Esc)" : "Maximize Map (Fullscreen)"}
        >
          {isMaximized ? (
            <>
              <Minimize2 size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Exit Fullscreen</span>
              <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">ESC</kbd>
            </>
          ) : (
            <>
              <Maximize2 size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Maximize</span>
            </>
          )}
        </button>
      )}

      {/* Hidden measurements notification banner */}
      {mission.isMeasurementsVisible === false && (mission.measurements?.length || 0) > 0 && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-yellow-500/40 px-3 py-1.5 rounded-lg text-xs shadow-lg">
          <EyeOff size={13} className="text-yellow-400" />
          <span className="text-slate-300 font-mono text-[11px]">
            {mission.measurements?.length} measurement{mission.measurements?.length === 1 ? '' : 's'} hidden
          </span>
          <button
            type="button"
            onClick={() => setMission(m => ({ ...m, isMeasurementsVisible: true }))}
            className="text-yellow-400 hover:text-yellow-300 font-bold ml-1 text-[11px] underline cursor-pointer"
          >
            Show
          </button>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        className={`${getCursorClass()} shadow-2xl`}
      />
    </div>
  );
}
