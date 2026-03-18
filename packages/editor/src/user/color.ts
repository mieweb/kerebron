export interface ColorPair {
  light: string;
  dark: string;
}

export const userColors: ColorPair[] = [
  { dark: '#30bced', light: '#30bced' },
  { dark: '#6eeb83', light: '#6eeb83' },
  { dark: '#ffbc42', light: '#ffbc42' },
  { dark: '#ecd444', light: '#ecd444' },
  { dark: '#ee6352', light: '#ee6352' },
  { dark: '#9ac2c9', light: '#9ac2c9' },
  { dark: '#8acb88', light: '#8acb88' },
  { dark: '#1be7ff', light: '#1be7ff' },
];

export type ColorMapper = (
  user: { id: string },
  me: { id: string },
) => ColorPair;

function hashString(str: string): number {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }

  return Math.abs(hash);
}

export const defaultColorMapper: ColorMapper = (user, me) => {
  const mineIndex = hashString(me.id);
  let userIndex = hashString(user.id);
  if (mineIndex === userIndex) {
    userIndex++;
  }

  return userColors[userIndex % userColors.length];
};
