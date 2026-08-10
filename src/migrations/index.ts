import * as migration_20260810_154228_initial from './20260810_154228_initial';

export const migrations = [
  {
    up: migration_20260810_154228_initial.up,
    down: migration_20260810_154228_initial.down,
    name: '20260810_154228_initial'
  },
];
