// Bundled "Year of the Goat 2027" artwork used by the goat template (src/goatArt/*.jpg).
// `bg` = the picture's own background colour, so a picture placed with fit "contain" blends into the page.
const url = (f) => new URL(`./goatArt/${f}`, import.meta.url).href;
export const GOAT_FILES = {
  banner: { file: 'banner.jpg', bg: '#ffffff' },
  flower: { file: 'flower.jpg', bg: '#ee3a48' },
  swirl: { file: 'swirl.jpg', bg: '#a6000c' },
  fu: { file: 'fu.jpg', bg: '#f2f2ec' },
  gold: { file: 'gold.jpg', bg: '#6b1013' },
};
export const GOAT_ART = {}; // key -> loaded Image (filled by loadGoatArt)
export const GOAT_ORDER = ['banner', 'flower', 'swirl', 'fu', 'gold'];

export function loadGoatArt(onLoad) {
  if (typeof Image === 'undefined') return;
  Object.entries(GOAT_FILES).forEach(([k, v]) => {
    if (GOAT_ART[k]) return;
    const im = new Image();
    im.onload = () => { GOAT_ART[k] = im; if (onLoad) onLoad(); };
    im.src = url(v.file);
  });
}
