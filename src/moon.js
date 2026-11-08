// Principal moon phases (new, first quarter, full, last quarter) using the
// algorithm from Jean Meeus, "Astronomical Algorithms", chapter 49.
// Accuracy is within about a minute, which is plenty for a printed calendar.

const rad = (d) => (d * Math.PI) / 180;
const norm = (d) => ((d % 360) + 360) % 360;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));

/** k integer = new moon, +.25 first quarter, +.5 full moon, +.75 last quarter. Returns JDE (TT). */
export function phaseJDE(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = norm(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
  const Mp = norm(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
  const F = norm(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
  const Om = norm(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
  const phase = Math.round((((k % 1) + 1) % 1) * 4) % 4;
  const E2 = E * E;

  let c;
  if (phase === 0) {
    c =
      -0.4072 * sin(Mp) + 0.17241 * E * sin(M) + 0.01608 * sin(2 * Mp) + 0.01039 * sin(2 * F) +
      0.00739 * E * sin(Mp - M) - 0.00514 * E * sin(Mp + M) + 0.00208 * E2 * sin(2 * M) -
      0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M) -
      0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F) -
      0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(Om) - 0.00007 * sin(Mp + 2 * M) +
      0.00004 * sin(2 * Mp - 2 * F) + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F) + 0.00003 * sin(Mp - M + 2 * F) -
      0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
  } else if (phase === 2) {
    c =
      -0.40614 * sin(Mp) + 0.17302 * E * sin(M) + 0.01614 * sin(2 * Mp) + 0.01043 * sin(2 * F) +
      0.00734 * E * sin(Mp - M) - 0.00515 * E * sin(Mp + M) + 0.00209 * E2 * sin(2 * M) -
      0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M) -
      0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F) -
      0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(Om) - 0.00007 * sin(Mp + 2 * M) +
      0.00004 * sin(2 * Mp - 2 * F) + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F) + 0.00003 * sin(Mp - M + 2 * F) -
      0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
  } else {
    c =
      -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M) + 0.00862 * sin(2 * Mp) +
      0.00804 * sin(2 * F) + 0.00454 * E * sin(Mp - M) + 0.00204 * E2 * sin(2 * M) -
      0.0018 * sin(Mp - 2 * F) - 0.0007 * sin(Mp + 2 * F) - 0.0004 * sin(3 * Mp) -
      0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F) + 0.00032 * E * sin(M - 2 * F) -
      0.00028 * E2 * sin(Mp + 2 * M) + 0.00027 * E * sin(2 * Mp + M) - 0.00017 * sin(Om) -
      0.00005 * sin(Mp - M - 2 * F) + 0.00004 * sin(2 * Mp + 2 * F) - 0.00004 * sin(Mp + M + 2 * F) +
      0.00004 * sin(Mp - 2 * M) + 0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(3 * M) +
      0.00002 * sin(2 * Mp - 2 * F) + 0.00002 * sin(Mp - M + 2 * F) - 0.00002 * sin(3 * Mp + M);
    const W =
      0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) +
      0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    c += phase === 1 ? W : -W;
  }
  jde += c;

  const A = [
    [299.77 + 0.107408 * k - 0.009173 * T2, 0.000325],
    [251.88 + 0.016321 * k, 0.000165],
    [251.83 + 26.651886 * k, 0.000164],
    [349.42 + 36.412478 * k, 0.000126],
    [84.66 + 18.206239 * k, 0.00011],
    [141.74 + 53.303771 * k, 0.000062],
    [207.14 + 2.453732 * k, 0.00006],
    [154.84 + 7.30686 * k, 0.000056],
    [34.52 + 27.261239 * k, 0.000047],
    [207.19 + 0.121824 * k, 0.000042],
    [291.34 + 1.844379 * k, 0.00004],
    [161.72 + 24.198154 * k, 0.000037],
    [239.56 + 25.513099 * k, 0.000035],
    [331.55 + 3.592518 * k, 0.000023],
  ];
  A.forEach(([a, w]) => (jde += w * sin(norm(a))));
  return { jde, phase };
}

/**
 * Phases that fall inside the given month, in the given UTC offset (hours).
 * @returns {{phase:0|1|2|3, day:number, hour:number, minute:number}[]} 0 new, 1 first quarter, 2 full, 3 last quarter
 */
export function moonPhasesForMonth(year, month0, utcOffsetHours = 0) {
  const approx = (year + (month0 + 0.5) / 12 - 2000) * 12.3685;
  const k0 = Math.floor(approx) - 2;
  const t = year - 2000;
  const deltaT = 62.92 + 0.32217 * t + 0.005589 * t * t; // seconds, valid ~2005-2050
  const out = [];
  for (let i = 0; i <= 28; i++) {
    const { jde, phase } = phaseJDE(k0 + i * 0.25);
    const ms = (jde - 2440587.5) * 86400000 - deltaT * 1000 + utcOffsetHours * 3600000 + 30000; // +30 s => round to minute
    const d = new Date(ms);
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month0) {
      out.push({ phase, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), ms });
    }
  }
  return out.sort((a, b) => a.ms - b.ms);
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function formatMoonTime(p, month0) {
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${p.day} ${MON[month0]} ${h12}:${String(p.minute).padStart(2, '0')} ${p.hour < 12 ? 'AM' : 'PM'}`;
}
