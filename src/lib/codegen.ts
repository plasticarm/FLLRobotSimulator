import { MissionConfig, Instruction, FunctionNames } from './types';

export function parsePythonCode(code: string, functionNames: FunctionNames): Instruction[] {
    const moveFunction = functionNames.move || 'drive';
    const rotateFunction = functionNames.rotate || 'rotateDegrees';
    const motor1Function = functionNames.motor1 || 'rotateLeftArm';
    const motor2Function = functionNames.motor2 || 'rotateRightArm';

    const lines = code.split('\n');
    const newInstructions: Instruction[] = [];
    
    const regex = /await\s+([a-zA-Z0-9_]+)\s*\(\s*(-?\d+\.?\d*)\s*(?:,\s*(-?\d+\.?\d*))?\s*\)/;
    
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const funcName = match[1];
            const val1 = parseFloat(match[2]);
            const val2 = match[3] ? parseFloat(match[3]) : undefined;
            
            if (funcName === moveFunction) {
                newInstructions.push({
                    id: Math.random().toString(36).substring(2, 9),
                    type: 'move',
                    distance: val1,
                    speed: val2 || 1000
                });
            } else if (funcName === rotateFunction) {
                newInstructions.push({
                    id: Math.random().toString(36).substring(2, 9),
                    type: 'rotate',
                    angle: val1,
                    speed: val2 || 500
                });
            } else if (funcName === motor1Function) {
                newInstructions.push({
                    id: Math.random().toString(36).substring(2, 9),
                    type: 'motor1',
                    angle: val1,
                    speed: val2 || 500
                });
            } else if (funcName === motor2Function) {
                newInstructions.push({
                    id: Math.random().toString(36).substring(2, 9),
                    type: 'motor2',
                    angle: val1,
                    speed: val2 || 500
                });
            }
        }
    });

    return newInstructions;
}

export function generatePythonCode(mission: MissionConfig) {
    const { missionName, robotConfig, instructions, functionNames } = mission;
    const moveFunction = functionNames.move || 'drive';
    const rotateFunction = functionNames.rotate || 'rotateDegrees';
    const motor1Function = functionNames.motor1 || 'rotateLeftArm';
    const motor2Function = functionNames.motor2 || 'rotateRightArm';

    let code = `# This code was automatically generated for mission: ${missionName}
# It assumes a library named '*' with asynchronous commands for movement and rotation.
"""
Available functions in the common library:

setupMotors()
resetYaw()
degreesForDistance(distance_cm)
drive(distance, speed)
rotateRightArm(degrees, speed)
rotateLeftArm(degrees, speed)
rotateCenterArm(degrees, speed)
resetArmRotation()
turn_done()
rotateDegrees(degrees, speed)
spin_turn(robot_degrees, motor_speed)
pivot_turn(robot_degrees, motor_speed)
all_done()
beep(frequency, duration)
"""

from common import *
import runloop

async def main():
    # Starting mission: ${missionName}
    # Initial Position: ${robotConfig.startX}, ${robotConfig.startY} cm
    # Initial Angle: ${robotConfig.startAngle} degrees   
    await init()

`;
    let current_x = robotConfig.startX;
    let current_y = robotConfig.startY;
    let current_angle_deg = robotConfig.startAngle;
    const toRadians = (deg: number) => deg * Math.PI / 180;
    const toDegrees = (rad: number) => rad * 180 / Math.PI;
    
    instructions.forEach((instruction) => {
        const moveSpeed = instruction.speed || 1000;
        const rotateSpeed = instruction.speed || 500;
        
        if (instruction.type === 'move' && instruction.distance !== undefined) {
            code += `    await ${moveFunction}(${instruction.distance.toFixed(2)}, ${moveSpeed.toFixed(0)})\n`;
            const angleRad = toRadians(current_angle_deg);
            current_x += instruction.distance * Math.sin(angleRad);
            current_y += instruction.distance * Math.cos(angleRad);
        } else if (instruction.type === 'rotate' && instruction.angle !== undefined) {
            code += `    await ${rotateFunction}(${instruction.angle.toFixed(2)}, ${rotateSpeed.toFixed(0)})\n`;
            current_angle_deg += instruction.angle;
        } else if (instruction.type === 'followPath' && instruction.points) {
            let pathCurrentX = current_x;
            let pathCurrentY = current_y;
            let pathCurrentAngleDeg = current_angle_deg;

            instruction.points.forEach((point) => {
                const dx = point.x - pathCurrentX;
                const dy = point.y - pathCurrentY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const targetAngleRad = Math.atan2(dx, dy);
                const oldAngleRad = toRadians(pathCurrentAngleDeg);
                let angleDiffRad = targetAngleRad - oldAngleRad;
                
                while(angleDiffRad > Math.PI) angleDiffRad -= 2 * Math.PI;
                while(angleDiffRad < -Math.PI) angleDiffRad += 2 * Math.PI;
                
                const angleDiffDeg = toDegrees(angleDiffRad);
                pathCurrentAngleDeg += angleDiffDeg;

                code += `    await ${rotateFunction}(${angleDiffDeg.toFixed(2)}, 1000)\n`;
                code += `    await ${moveFunction}(${distance.toFixed(2)}, 1000)\n`;

                pathCurrentX = point.x;
                pathCurrentY = point.y;
            });
            
            current_x = pathCurrentX;
            current_y = pathCurrentY;
            current_angle_deg = pathCurrentAngleDeg;
        } else if (instruction.type === 'motor1') {
            code += `    await ${motor1Function}(${instruction.angle?.toFixed(0)}, ${instruction.speed?.toFixed(0)})\n`;
        } else if (instruction.type === 'motor2') {
            code += `    await ${motor2Function}(${instruction.angle?.toFixed(0)}, ${instruction.speed?.toFixed(0)})\n`;
        }
    });
    
    code += `
    # reset the arms before finishing
    await resetArmRotation()

runloop.run(main())
`;
    return code;
}
