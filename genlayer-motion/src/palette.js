// Brand palette used across 3D scene, overlay and textures.
export const C = {
  pink: '#ff87ff',
  purple: '#dc00ff',
  mint: '#a8ffd2',
  mintDeep: '#5dffb0',
  bg: '#07030c',
  white: '#dcd8e8',
  gray: '#a6a3b4',
  grayDark: '#5f5c70',
  navy: '#0b1024',
  gauntlet: '#3b3e5e',
  red: '#ff4d7a',
};

// GenLayer logo traced from the supplied artwork (400x400 px space), made symmetric.
const LEFT = [[183, 34], [20, 372], [178, 310], [129, 286], [122, 279], [183, 152]];
const mirror = (pts) => pts.map(([x, y]) => [401 - x, y]).reverse();
export const LOGO_POLYS = {
  left: LEFT,
  right: mirror(LEFT),
  diamond: [[200.5, 196], [167, 266], [200.5, 283], [234, 266]],
};
export const LOGO_CENTER = [200.5, 203];
