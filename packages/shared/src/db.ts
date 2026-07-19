import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const seedDir = resolve(__dir, 'seed');

let _db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (_db) return _db;
  const path = dbPath ?? process.env.DB_PATH ?? resolve(process.cwd(), 'data', 'benefits.sqlite');
  _db = new Database(path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      department TEXT NOT NULL,
      title TEXT NOT NULL,
      managerEmail TEXT,
      role TEXT NOT NULL,
      salary INTEGER NOT NULL,
      hrNotes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('medical','dental','vision')),
      monthlyPremium INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeEmail TEXT NOT NULL COLLATE NOCASE,
      planId INTEGER NOT NULL REFERENCES plans(id),
      coverageLevel TEXT NOT NULL CHECK(coverageLevel IN ('self','self+spouse','family')),
      effectiveDate TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pto_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeEmail TEXT NOT NULL UNIQUE COLLATE NOCASE,
      vacationHours INTEGER NOT NULL DEFAULT 0,
      sickHours INTEGER NOT NULL DEFAULT 0,
      personalHours INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      actor TEXT NOT NULL,
      userSub TEXT NOT NULL,
      tool TEXT NOT NULL,
      scopeRequired TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('allow','deny')),
      httpStatus INTEGER NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      tokenJti TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS token_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cacheKey TEXT NOT NULL UNIQUE,
      accessToken TEXT NOT NULL,
      scope TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      chain TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL
    );
  `);
}

export function seed(db: Database.Database): void {
  const empCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as { c: number }).c;
  if (empCount > 0) return;

  const employees = JSON.parse(readFileSync(resolve(seedDir, 'employees.json'), 'utf8'));
  const plans = JSON.parse(readFileSync(resolve(seedDir, 'plans.json'), 'utf8'));
  const enrollments = JSON.parse(readFileSync(resolve(seedDir, 'enrollments.json'), 'utf8'));
  const pto = JSON.parse(readFileSync(resolve(seedDir, 'pto_balances.json'), 'utf8'));

  const insertEmp = db.prepare(
    `INSERT INTO employees (firstName, lastName, email, department, title, managerEmail, role, salary, hrNotes)
     VALUES (@firstName, @lastName, @email, @department, @title, @managerEmail, @role, @salary, @hrNotes)`
  );
  const insertPlan = db.prepare(
    `INSERT INTO plans (name, type, monthlyPremium) VALUES (@name, @type, @monthlyPremium)`
  );
  const insertEnrollment = db.prepare(
    `INSERT INTO enrollments (employeeEmail, planId, coverageLevel, effectiveDate)
     VALUES (@employeeEmail, @planId, @coverageLevel, @effectiveDate)`
  );
  const insertPto = db.prepare(
    `INSERT INTO pto_balances (employeeEmail, vacationHours, sickHours, personalHours)
     VALUES (@employeeEmail, @vacationHours, @sickHours, @personalHours)`
  );

  const tx = db.transaction(() => {
    for (const e of employees) insertEmp.run(e);
    for (const p of plans) insertPlan.run(p);
    for (const en of enrollments) insertEnrollment.run(en);
    for (const p of pto) insertPto.run(p);
  });
  tx();

  console.log(`Seeded ${employees.length} employees, ${plans.length} plans, ${enrollments.length} enrollments, ${pto.length} PTO rows.`);
}
