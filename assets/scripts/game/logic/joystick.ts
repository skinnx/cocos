// Pure floating-joystick math (no 'cc'). SPEC §3: appears where the thumb lands in the lower 65% of the screen,
// speed proportional to deflection, 12% dead-zone.
export const DEAD_ZONE = 0.12;
export const ACTIVE_FRACTION = 0.65;

/** Whether a touch at screen y (design units, origin bottom) may start the joystick. */
export function inJoystickZone(sy: number, visH: number): boolean {
  return sy <= visH * ACTIVE_FRACTION;
}

/**
 * Move direction for core (tile space, +y DOWN) from a drag in screen space (+y UP). Magnitude in [0, 1]; inside
 * the dead-zone returns {0,0}; outside, the magnitude is rescaled so it ramps from 0 at the dead-zone edge.
 */
export function joystickDir(dx: number, dy: number, radius: number, dead = DEAD_ZONE): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (radius <= 0 || d / radius <= dead) return { x: 0, y: 0 };
  const m = Math.min(1, (d / radius - dead) / (1 - dead));
  return { x: (dx / d) * m, y: (-dy / d) * m };
}

/** Knob offset clamped to the base radius. */
export function knobOffset(dx: number, dy: number, radius: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d <= radius || d === 0) return { x: dx, y: dy };
  return { x: (dx / d) * radius, y: (dy / d) * radius };
}

/** Keyboard (desktop testing) → direction. */
export function keysDir(up: boolean, down: boolean, left: boolean, right: boolean): { x: number; y: number } {
  const x = (right ? 1 : 0) - (left ? 1 : 0), y = (down ? 1 : 0) - (up ? 1 : 0);
  const m = Math.hypot(x, y);
  return m ? { x: x / m, y: y / m } : { x: 0, y: 0 };
}
