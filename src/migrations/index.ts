import * as migration_20260810_154228_initial from './20260810_154228_initial';
import * as migration_20260818_143035_brand_global from './20260818_143035_brand_global';

export const migrations = [
  {
    up: migration_20260810_154228_initial.up,
    down: migration_20260810_154228_initial.down,
    name: '20260810_154228_initial',
  },
  {
    up: migration_20260818_143035_brand_global.up,
    down: migration_20260818_143035_brand_global.down,
    name: '20260818_143035_brand_global'
  },
];
