import { Instruction, RobotConfig, TelemetryData } from './types';

export const toRadians = (deg: number) => (deg * Math.PI) / 180;
export const toDegrees = (rad: number) => (rad * 180) / Math.PI;

export function calculateTotalTime(instructions: Instruction[], robotConfig: RobotConfig): number {
  let totalTime = 0;
  let finalState = {
    x: robotConfig.startX,
    y: robotConfig.startY,
    angle: toRadians(robotConfig.startAngle),
  };

  instructions.forEach((instruction) => {
    const moveSpeed = instruction.speed || 1000;
    const rotateSpeed = instruction.speed || 500;

    if (instruction.type === 'move' && instruction.distance !== undefined) {
      totalTime += Math.abs(instruction.distance) / (moveSpeed / 100);
      finalState.x += instruction.distance * Math.sin(finalState.angle);
      finalState.y += instruction.distance * Math.cos(finalState.angle);
    } else if (instruction.type === 'rotate' && instruction.angle !== undefined) {
      totalTime += Math.abs(instruction.angle) / (rotateSpeed / 10);
      finalState.angle += toRadians(instruction.angle);
    } else if (instruction.type === 'followPath' && instruction.points) {
      let pathCurrentX = finalState.x;
      let pathCurrentY = finalState.y;
      let pathCurrentAngleRad = finalState.angle;

      instruction.points.forEach((point) => {
        const dx = point.x - pathCurrentX;
        const dy = point.y - pathCurrentY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const targetAngleRad = Math.atan2(dx, dy);
        let angleDiffRad = targetAngleRad - pathCurrentAngleRad;

        while (angleDiffRad > Math.PI) angleDiffRad -= 2 * Math.PI;
        while (angleDiffRad < -Math.PI) angleDiffRad += 2 * Math.PI;

        const angleDiffDeg = toDegrees(angleDiffRad);

        totalTime += Math.abs(angleDiffDeg) / (1000 / 10);
        totalTime += distance / (1000 / 100);

        pathCurrentAngleRad += angleDiffRad;
        pathCurrentX = point.x;
        pathCurrentY = point.y;
      });
      finalState.x = pathCurrentX;
      finalState.y = pathCurrentY;
      finalState.angle = pathCurrentAngleRad;
    } else if (instruction.type === 'motor1' || instruction.type === 'motor2') {
      totalTime += 1; // 1 second pause
    }
  });
  return totalTime;
}

export function getRobotStateAtTime(
  time: number,
  instructions: Instruction[],
  robotConfig: RobotConfig,
  totalTime: number
): TelemetryData & { pathHistory: { x: number; y: number }[] } {
  let currentX = robotConfig.startX;
  let currentY = robotConfig.startY;
  let currentAngleRad = toRadians(robotConfig.startAngle);

  let elapsedTime = 0;
  const pathHistory = [{ x: currentX, y: currentY }];
  
  const finalState = {
    time,
    totalTime,
    x: currentX,
    y: currentY,
    angle: currentAngleRad,
    pathHistory,
    currentDistance: 0,
    currentAngle: 0,
    instructionIndex: -1,
    speed: 0,
  };

  if (time <= 0) return finalState;

  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i];
    let duration = 0;
    const moveSpeed = instruction.speed || 1000;
    const rotateSpeed = instruction.speed || 500;

    if (instruction.type === 'move' && instruction.distance !== undefined) {
      duration = Math.abs(instruction.distance) / (moveSpeed / 100);
      if (elapsedTime + duration >= time) {
        const timeInInstruction = time - elapsedTime;
        const distMoved = (moveSpeed / 100) * timeInInstruction * Math.sign(instruction.distance);
        finalState.x = currentX + distMoved * Math.sin(currentAngleRad);
        finalState.y = currentY + distMoved * Math.cos(currentAngleRad);
        finalState.angle = currentAngleRad;
        finalState.currentDistance = distMoved;
        finalState.instructionIndex = i;
        finalState.speed = moveSpeed;
        finalState.pathHistory.push({ x: finalState.x, y: finalState.y });
        return finalState;
      }
      currentX += instruction.distance * Math.sin(currentAngleRad);
      currentY += instruction.distance * Math.cos(currentAngleRad);
      pathHistory.push({ x: currentX, y: currentY });

    } else if (instruction.type === 'rotate' && instruction.angle !== undefined) {
      duration = Math.abs(instruction.angle) / (rotateSpeed / 10);
      if (elapsedTime + duration >= time) {
        const timeInInstruction = time - elapsedTime;
        const angleRotated = (rotateSpeed / 10) * Math.sign(instruction.angle) * timeInInstruction;
        finalState.x = currentX;
        finalState.y = currentY;
        finalState.angle = currentAngleRad + toRadians(angleRotated);
        finalState.currentAngle = angleRotated;
        finalState.instructionIndex = i;
        finalState.speed = rotateSpeed;
        return finalState;
      }
      currentAngleRad += toRadians(instruction.angle);

    } else if (instruction.type === 'followPath' && instruction.points) {
      let pathCurrentX = currentX;
      let pathCurrentY = currentY;
      let pathCurrentAngleRad = currentAngleRad;
      let pathElapsedTime = 0;

      for (const point of instruction.points) {
        const dx = point.x - pathCurrentX;
        const dy = point.y - pathCurrentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const targetAngleRad = Math.atan2(dx, dy);
        let angleDiffRad = targetAngleRad - pathCurrentAngleRad;

        while(angleDiffRad > Math.PI) angleDiffRad -= 2 * Math.PI;
        while(angleDiffRad < -Math.PI) angleDiffRad += 2 * Math.PI;
        
        const rotationDuration = Math.abs(toDegrees(angleDiffRad)) / (1000 / 10);
        const moveDuration = distance / (1000 / 100);

        if (elapsedTime + pathElapsedTime + rotationDuration >= time) {
          const timeInInstruction = time - (elapsedTime + pathElapsedTime);
          const angleRotated = (1000 / 10) * Math.sign(angleDiffRad) * timeInInstruction;
          finalState.x = pathCurrentX; 
          finalState.y = pathCurrentY;
          finalState.angle = pathCurrentAngleRad + toRadians(angleRotated);
          finalState.currentAngle = angleRotated;
          finalState.instructionIndex = i;
          finalState.speed = 1000;
          return finalState;
        }
        
        pathElapsedTime += rotationDuration;
        pathCurrentAngleRad += angleDiffRad;
        
        if (elapsedTime + pathElapsedTime + moveDuration >= time) {
          const timeInInstruction = time - (elapsedTime + pathElapsedTime);
          const distMoved = (1000 / 100) * timeInInstruction;
          finalState.x = pathCurrentX + distMoved * Math.sin(pathCurrentAngleRad);
          finalState.y = pathCurrentY + distMoved * Math.cos(pathCurrentAngleRad);
          finalState.angle = pathCurrentAngleRad;
          finalState.currentDistance = distMoved;
          finalState.instructionIndex = i;
          finalState.speed = 1000;
          finalState.pathHistory.push({x: finalState.x, y: finalState.y});
          return finalState;
        }
        
        pathElapsedTime += moveDuration;
        pathHistory.push({x: point.x, y: point.y});
        pathCurrentX = point.x;
        pathCurrentY = point.y;
      }
      currentX = pathCurrentX;
      currentY = pathCurrentY;
      currentAngleRad = pathCurrentAngleRad;
    } else if (instruction.type === 'motor1' || instruction.type === 'motor2') {
      duration = 1;
      if (elapsedTime + duration >= time) {
        finalState.x = currentX;
        finalState.y = currentY;
        finalState.angle = currentAngleRad;
        finalState.instructionIndex = i;
        finalState.speed = instruction.speed || 500;
        return finalState;
      }
    }
    elapsedTime += duration;
  }

  finalState.x = currentX;
  finalState.y = currentY;
  finalState.angle = currentAngleRad;
  return finalState;
}

export function calculatePlannedPath(instructions: Instruction[], robotConfig: RobotConfig) {
  const points: {x: number, y: number}[] = [];
  let currentX = robotConfig.startX;
  let currentY = robotConfig.startY;
  let currentAngleRad = toRadians(robotConfig.startAngle);

  points.push({ x: currentX, y: currentY });

  instructions.forEach((instruction) => {
    if (instruction.type === 'move' && instruction.distance !== undefined) {
      currentX += instruction.distance * Math.sin(currentAngleRad);
      currentY += instruction.distance * Math.cos(currentAngleRad);
      points.push({ x: currentX, y: currentY });
    } else if (instruction.type === 'rotate' && instruction.angle !== undefined) {
      currentAngleRad += toRadians(instruction.angle);
    } else if (instruction.type === 'followPath' && instruction.points) {
      instruction.points.forEach((point) => {
        const dx = point.x - currentX;
        const dy = point.y - currentY;
        currentAngleRad = Math.atan2(dx, dy);
        currentX = point.x;
        currentY = point.y;
        points.push({ x: currentX, y: currentY });
      });
    }
  });

  return points;
}
