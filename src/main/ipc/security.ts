import { randomUUID } from 'crypto';
import os from 'os';
import type Database from 'better-sqlite3';

type Actor = {
  id?: string | number;
  name?: string;
  role?: string;
  ip?: string;
};

const getLanIp = () => {
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    if (!values) continue;
    for (const address of values) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return '127.0.0.1';
};

export const resolveActor = (payload: any): Required<Actor> => {
  const actor = payload?.actor || {};
  return {
    id: String(actor.id || 'system'),
    name: String(actor.name || '系统'),
    role: String(actor.role || 'admin'),
    ip: String(actor.ip || getLanIp())
  };
};

export const assertRole = (role: string, allowRoles: string[]) => {
  if (!allowRoles.includes(role)) {
    throw new Error('无权限执行该操作');
  }
};

export const writeAuditLog = (
  db: Database.Database,
  payload: {
    module: string;
    action: string;
    targetId?: string;
    beforeData?: unknown;
    afterData?: unknown;
    actor: Required<Actor>;
  }
) => {
  db.prepare(`
    INSERT INTO audit_logs (
      id, module, action, target_id, before_data, after_data,
      operator_id, operator_name, operator_role, ip_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    payload.module,
    payload.action,
    payload.targetId || null,
    payload.beforeData ? JSON.stringify(payload.beforeData) : null,
    payload.afterData ? JSON.stringify(payload.afterData) : null,
    payload.actor.id,
    payload.actor.name,
    payload.actor.role,
    payload.actor.ip
  );
};
