// These endpoints do not use PostgreSQL. Let guests play without waiting for
// a cold function instance to acquire the migration lock and connect to the DB.
export function needsDatabaseInitialization(method: string, path: string, hasSession: boolean): boolean {
  if (method === 'GET' && ['/api/health', '/api/wheel/health', '/api/config', '/api/auth/google/config'].includes(path)) {
    return false;
  }
  if (method === 'POST' && path === '/api/auth/logout') return false;
  if (!hasSession) {
    if (method === 'GET' && ['/api/auth/me', '/api/games', '/api/games/'].includes(path)) return false;
    if (method === 'POST' && ['/api/wheel/spin', '/api/games/dice/roll', '/api/games/slots/spin', '/api/games/cards/draw'].includes(path)) return false;
  }
  return true;
}
