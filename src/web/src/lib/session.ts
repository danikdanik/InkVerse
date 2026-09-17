/** Durable per-browser session id, sent as x-inkverse-session on every request. */
const KEY = 'inkverse.session';

export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}
