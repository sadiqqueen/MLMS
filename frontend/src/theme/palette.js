// frontend/src/theme/palette.js
// Chart / category colors per theme so chart.js dashboards can re-theme
// when the global light/dark preference changes.
//
// Pure data module: no imports, no side effects.
// Consume alongside usePrefs():
//   const { theme } = usePrefs();
//   const pal = getChartPalette(theme);
//   datasets[0].backgroundColor = pal.categories;
//   options.scales.y.grid.color  = pal.grid;
//   options.scales.y.ticks.color = pal.tick;

// Six-step categorical ramps, one per theme.
export const CATEGORY_COLORS_LIGHT = [
  '#0984e3', // blue
  '#00B894', // green
  '#8e44ad', // purple
  '#e17055', // orange
  '#d63031', // red
  '#fdcb6e', // amber
];

export const CATEGORY_COLORS_DARK = [
  '#5AA0E6', // blue
  '#5ECB8B', // green
  '#B79DE8', // purple
  '#F0997E', // orange
  '#FF6B74', // red
  '#FFD98A', // amber
];

const LIGHT = {
  categories: CATEGORY_COLORS_LIGHT,
  grid: '#f0f2f5',
  tick: '#555',
  text: '#555',
  primary: CATEGORY_COLORS_LIGHT[0],
  success: CATEGORY_COLORS_LIGHT[1],
  danger: CATEGORY_COLORS_LIGHT[4],
  accent: CATEGORY_COLORS_LIGHT[2],
};

const DARK = {
  categories: CATEGORY_COLORS_DARK,
  grid: '#2D2D2A',
  tick: '#C7C5BE',
  text: '#C7C5BE',
  primary: CATEGORY_COLORS_DARK[0],
  success: CATEGORY_COLORS_DARK[1],
  danger: CATEGORY_COLORS_DARK[4],
  accent: CATEGORY_COLORS_DARK[2],
};

/**
 * Return the chart palette for the active theme.
 * @param {"light"|"dark"} theme
 * @returns {{ categories: string[], grid: string, tick: string, text: string,
 *            primary: string, success: string, danger: string, accent: string }}
 */
export function getChartPalette(theme) {
  return theme === 'dark' ? DARK : LIGHT;
}

export default getChartPalette;
