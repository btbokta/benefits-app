import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, seed } from '../db.js';

const dataDir = resolve(process.cwd(), 'apps', 'resource-server', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = resolve(dataDir, 'benefits.sqlite');
process.env.DB_PATH = dbPath;

const db = getDb(dbPath);
seed(db);
console.log('Seed complete:', dbPath);
