// Bundled "Wonders of the Philippines" photos (src/wondersArt/*.jpg): name, place and the focal point `fy` used when a tall photo is cropped wide.
const url = (f) => new URL(`./wondersArt/${f}`, import.meta.url).href;
export const WONDERS = {
  siargao: { name: 'Sugba Lagoon', place: 'Siargao, Surigao del Norte', fy: 0.45 },
  baguio: { name: 'Summer Capital', place: 'Baguio City', fy: 0.5 },
  batanes: { name: 'Batanes Highlands', place: 'Batanes', fy: 0.55 },
  boracay: { name: 'White Beach', place: 'Boracay, Aklan', fy: 0.78 },
  palawan: { name: 'Island Lagoon', place: 'Palawan', fy: 0.55 },
  mayon: { name: 'Mayon Volcano & Cagsawa Ruins', place: 'Albay', fy: 0.72 },
  cebu: { name: 'Cebu–Cordova Link', place: 'Cebu', fy: 0.5 },
  manila: { name: 'Manila Bay', place: 'Metro Manila', fy: 0.45 },
  moa: { name: 'Mall of Asia Globe', place: 'Pasay, Metro Manila', fy: 0.8 },
  molo: { name: 'Molo Church', place: 'Iloilo City', fy: 0.45 },
  choco: { name: 'Chocolate Hills', place: 'Bohol', fy: 0.6 },
  vigan: { name: 'Calle Crisologo', place: 'Vigan, Ilocos Sur', fy: 0.55 },
};
export const WONDERS_MONTHS = ['siargao', 'baguio', 'batanes', 'boracay', 'palawan', 'mayon', 'cebu', 'manila', 'moa', 'molo', 'choco', 'vigan']; // Jan..Dec
export const WONDERS_COVER = 'choco';
export const WONDERS_ART = {}; // key -> loaded Image

export function loadWondersArt(onLoad) {
  if (typeof Image === 'undefined') return;
  Object.keys(WONDERS).forEach((k) => {
    if (WONDERS_ART[k]) return;
    const im = new Image();
    im.onload = () => { WONDERS_ART[k] = im; if (onLoad) onLoad(); };
    im.src = url(`${k}.jpg`);
  });
}
