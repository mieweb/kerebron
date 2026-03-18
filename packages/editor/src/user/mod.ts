export interface User {
  id: string;
  name: string;
}

export function generateBlankUser(): User {
  return {
    id: '',
    name: 'User unset',
  };
}

export function generateRandomUser(): User {
  const random = Math.random() * 100;
  return {
    id: 'random:' + random,
    name: 'Anonymous ' + Math.floor(random),
  };
}

export * from './color.ts';
