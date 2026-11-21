import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { config } from '../config';
import { ENTITIES } from './entities';
import { Init1763600000000 } from './migrations/1763600000000-Init';
import { MediaLibrary1763700000000 } from './migrations/1763700000000-MediaLibrary';
import { ShareSettings1763800000000 } from './migrations/1763800000000-ShareSettings';

export const MIGRATIONS = [Init1763600000000, MediaLibrary1763700000000, ShareSettings1763800000000];

export function dataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    url: config().DATABASE_URL,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
    logging: ['error'],
  };
}

export const createDataSource = () => new DataSource(dataSourceOptions());
