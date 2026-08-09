export type InstructionType = 'move' | 'rotate' | 'followPath' | 'motor1' | 'motor2';
export type ActiveTool = 'none' | 'measure' | 'path';

export interface Point {
  x: number;
  y: number;
}

export interface Instruction {
  id: string;
  type: InstructionType;
  distance?: number;
  angle?: number;
  speed?: number;
  points?: Point[];
}

export interface Arm {
  id: string;
  xOffset: number;
  yOffset: number;
  width: number;
  height: number;
  rotation: number;
}

export interface RobotConfig {
  startX: number;
  startY: number;
  startAngle: number;
  width: number;
  height: number;
  pivotY: number;
  color: string;
  pathColor: string;
  arms: Arm[];
}

export interface FunctionNames {
  move: string;
  rotate: string;
  motor1: string;
  motor2: string;
}

export interface MissionConfig {
  missionName: string;
  robotConfig: RobotConfig;
  instructions: Instruction[];
  map2Opacity: number;
  isMissionNamesVisible: boolean;
  playbackSpeed: number;
  functionNames: FunctionNames;
}

export interface TelemetryData {
  time: number;
  totalTime: number;
  x: number;
  y: number;
  angle: number;
  currentDistance: number;
  currentAngle: number;
  instructionIndex: number;
  speed: number;
}
