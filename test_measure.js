function calculateAngle(p0, p1, p2) {
    const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const b = Math.atan2(p0.y - p1.y, p0.x - p1.x);
    let angle = Math.abs((a - b) * 180 / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
}
console.log(calculateAngle({x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}));
