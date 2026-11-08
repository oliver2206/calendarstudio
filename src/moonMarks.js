// Small moon faces for templates that have no empty cell to hold a full moon cell: one face in the corner of the date cell
// of each phase day (new / first quarter / full / last quarter), using the same artwork set as every other moon.
import { moonPhasesForMonth } from './moon.js';

const KEY = ['new', 'fq', 'full', 'lq'];

/**
 * @param place (day) => {x, y, d} top-left + size of the face for that day, or null when the day is not drawn
 * @returns moon layers ([] when moons are switched off / "No moon")
 */
export function moonDayMarks(cfg, m, place, color, light = '#ffffff') {
  if (!cfg.showMoon) return [];
  return moonPhasesForMonth(cfg.year, m, Number(cfg.utcOffset) || 0)
    .map((p) => {
      const b = place(p.day);
      return b ? { type: 'moon', name: `Moon ${KEY[p.phase]} ${p.day}`, phase: KEY[p.phase], color, light, x: b.x, y: b.y, w: b.d, h: b.d } : null;
    })
    .filter(Boolean);
}
