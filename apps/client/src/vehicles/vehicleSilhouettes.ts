import * as THREE from 'three';

/** Side-profile control points (x = along length, y = height) per silhouette tag, used to
 * extrude an original chassis shape for each vehicle personality. Coordinates are in the
 * 0..1 range and get scaled to the vehicle's actual halfLength/halfHeight at build time. */
const PROFILES: Record<string, Array<[number, number]>> = {
  'heavy-fender': [
    [-1, 0.05], [-0.95, 0.55], [-0.55, 0.85], [0.1, 0.95], [0.6, 0.75], [0.95, 0.4], [1, 0.05],
    [1, -0.05], [-1, -0.05],
  ],
  'low-wide': [
    [-1, 0.02], [-0.9, 0.3], [-0.3, 0.5], [0.25, 0.55], [0.75, 0.35], [1, 0.08],
    [1, -0.05], [-1, -0.05],
  ],
  'balanced-sport': [
    [-1, 0.04], [-0.85, 0.45], [-0.35, 0.7], [0.2, 0.75], [0.7, 0.5], [1, 0.15],
    [1, -0.05], [-1, -0.05],
  ],
  'angled-spoiler': [
    [-1, 0.03], [-0.9, 0.4], [-0.4, 0.6], [0.15, 0.62], [0.55, 0.7], [0.85, 0.5], [1, 0.2],
    [1, -0.05], [-1, -0.05],
  ],
  'monster-frame': [
    [-1, 0.1], [-0.9, 0.6], [-0.4, 0.98], [0.2, 1.0], [0.7, 0.8], [1, 0.45],
    [1, -0.05], [-1, -0.05],
  ],
  'exhaust-heavy': [
    [-1, 0.03], [-0.9, 0.35], [-0.45, 0.55], [0.1, 0.6], [0.55, 0.45], [0.9, 0.55], [1, 0.2],
    [1, -0.05], [-1, -0.05],
  ],
  'sleek-narrow': [
    [-1, 0.02], [-0.9, 0.25], [-0.2, 0.4], [0.35, 0.42], [0.8, 0.25], [1, 0.06],
    [1, -0.05], [-1, -0.05],
  ],
  'aggressive-wing': [
    [-1, 0.03], [-0.85, 0.38], [-0.3, 0.5], [0.25, 0.5], [0.6, 0.65], [0.9, 0.55], [1, 0.15],
    [1, -0.05], [-1, -0.05],
  ],
};

export function buildChassisShape(silhouette: string, halfLength: number, halfHeight: number): THREE.Shape {
  const points = PROFILES[silhouette] ?? PROFILES['balanced-sport']!;
  const shape = new THREE.Shape();
  points.forEach(([px, py], i) => {
    const x = px * halfLength;
    const y = py * (halfHeight * 2);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}
