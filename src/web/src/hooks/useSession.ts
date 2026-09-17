import { useMemo } from 'react';
import { getSessionId } from '../lib/session';

export function useSession(): string {
  return useMemo(() => getSessionId(), []);
}
