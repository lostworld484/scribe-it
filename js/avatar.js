// Avatar maker: a coloured blob with a choice of eyes, mouth and hat.
const INK = '#1b1f3b';
export const EYES = [
  '<circle cx="14" cy="18" r="4.5" fill="#fff"/><circle cx="26" cy="18" r="4.5" fill="#fff"/><circle cx="15" cy="19" r="2.2" fill="' + INK + '"/><circle cx="27" cy="19" r="2.2" fill="' + INK + '"/>',
  '<path d="M10 19q4-5 8 0M22 19q4-5 8 0" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  '<circle cx="13.5" cy="17.5" r="6" fill="#fff"/><circle cx="26.5" cy="17.5" r="6" fill="#fff"/><circle cx="14.5" cy="18.5" r="3" fill="' + INK + '"/><circle cx="27.5" cy="18.5" r="3" fill="' + INK + '"/><circle cx="15.5" cy="17" r="1" fill="#fff"/><circle cx="28.5" cy="17" r="1" fill="#fff"/>',
  '<path d="M9.5 17h9M21.5 17h9" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/><path d="M10.5 17a4 3.5 0 0 0 7 0M22.5 17a4 3.5 0 0 0 7 0" fill="' + INK + '"/>',
  '<circle cx="14" cy="18" r="4.5" fill="#fff"/><circle cx="15" cy="19" r="2.2" fill="' + INK + '"/><path d="M22 19q4-5 8 0" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  '<path d="M10 15l8 3-8 3M30 15l-8 3 8 3" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
];
export const MOUTHS = [
  '<path d="M14 27q6 5 12 0" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  '<path d="M13 26h14q-1 7-7 7t-7-7z" fill="' + INK + '"/><path d="M15.5 30.5q4.5 3 9 0" fill="#ff7a9a"/>',
  '<ellipse cx="20" cy="29" rx="3.2" ry="3.8" fill="' + INK + '"/>',
  '<path d="M15 28h10" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>',
  '<path d="M14 27q6 5 12 0" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M19 29.5h5v3a2.5 2.5 0 0 1-5 0z" fill="#ff7a9a" stroke="' + INK + '" stroke-width="1.2"/>',
  '<path d="M14 29q3-3 6 0t6 0" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
];
export const HATS = [
  '',
  '<path d="M11 9l3-7 3 5 3-6 3 6 3-5 3 7z" fill="#ffd23f" stroke="#c99a00" stroke-width="1.2" stroke-linejoin="round"/>',
  '<path d="M20 -2l7 11H13z" fill="#ff4f7b" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/><circle cx="20" cy="-2" r="2.2" fill="#ffd23f"/>',
  '<path d="M9 9a11 8 0 0 1 22 0z" fill="#2347c6"/><path d="M27 8h10a2 2 0 0 1 0 3H27z" fill="#152f93"/>',
  '<path d="M26 4l5 3-5 3zM36 4l-5 3 5 3z" fill="#ff4f7b" stroke="' + INK + '" stroke-width="1"/><circle cx="31" cy="7" r="1.8" fill="#ff4f7b" stroke="' + INK + '" stroke-width="1"/>',
  '<path d="M20 5v-4" stroke="#0f7a45" stroke-width="2" stroke-linecap="round"/><path d="M20 2q-6-5-8 1 5 2 8-1zM20 2q6-5 8 1-5 2-8-1z" fill="#2fbf7f"/>'
];
export const PARTS = { e: EYES.length, m: MOUTHS.length, h: HATS.length };
const okCol = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#9aa0c0';
export function cleanAv(a) {
  const n = (v, max) => { v = Math.floor(+v); return v >= 0 && v < max ? v : 0; };
  a = a && typeof a === 'object' ? a : {};
  return { e: n(a.e, PARTS.e), m: n(a.m, PARTS.m), h: n(a.h, PARTS.h) };
}
export function avatarSvg(col, a, big) {
  a = cleanAv(a);
  const size = big ? `style="width:${big === true ? 72 : big}px;height:${big === true ? 72 : big}px;margin:auto"` : '';
  return `<svg class="av" ${size} viewBox="0 -4 40 44" aria-hidden="true"><path d="M20 3c10 0 17 6 17 17s-7 17-17 17S3 31 3 20 10 3 20 3z" fill="${okCol(col)}"/>${EYES[a.e]}${MOUTHS[a.m]}${HATS[a.h]}</svg>`;
}
