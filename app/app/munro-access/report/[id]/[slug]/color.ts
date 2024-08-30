export const timeColorScale = {
  1: '#4e516a',
  2: '#4e516a',
  3: '#4e516a',
  4: '#4e516a',
  5: '#1e4572',
  6: '#005c8b',
  7: '#007498',
  8: '#008ba0',
  9: '#00a3a4',
  10: '#00bca1',
  11: '#00d493',
  12: '#69e882',
  13: '#acfa70',

  14: '#da9944',
  15: '#d78449',
  16: '#d07150',
  17: '#c55f56',
  18: '#b6505c',
  19: '#a34460',
  20: '#8e3b62',
  21: '#783461',
  22: '#602e5d',
  23: '#482956',
};

export function hourColor(hour: number): string {
  const h = hour.toString();
  if (Object.hasOwn(timeColorScale, h)) {
    return timeColorScale[h as unknown as keyof typeof timeColorScale];
  }
  return '#FFF';
}
