export function calculateWind() {
    const speed = Math.random() * 20 - 10;
    const direction = speed > 0 ? 1 : -1;
    return { speed, direction };
}

export function calculateTrajectory(angle, power, wind) {
    const angleRad = (angle * Math.PI) / 180;
    const velocity = power * 10;
    
    const vx = Math.cos(angleRad) * velocity;
    const vy = -Math.sin(angleRad) * velocity;
    
    return { vx, vy };
}

export function checkCollision(projectile, target, radius = 40) {
    const distance = Math.sqrt(
        Math.pow(target.x - projectile.x, 2) + 
        Math.pow(target.y - projectile.y, 2)
    );
    
    return distance < radius;
}