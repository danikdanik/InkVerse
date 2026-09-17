import { useEffect, useState } from 'react';
import type { ClientConfig } from '@shared/api';
import type { Run } from '@shared/schemas';
import { api } from './lib/api';
import { useRun } from './hooks/useRun';
import { Cover } from './components/Cover';
import { Setup } from './components/Setup';
import { Reader } from './components/Reader';
import { Archive } from './components/Archive';

type Screen = 'cover' | 'setup' | 'reader' | 'archive';

export function App() {
  const [screen, setScreen] = useState<Screen>('cover');
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  const ctrl = useRun(screen === 'reader' ? runId : null);

  useEffect(() => {
    void api.getConfig().then(setConfig).catch(() => {});
    void api.listRuns().then((r) => setRuns(sortRuns(r))).catch(() => {});
  }, []);

  const open = (id: string) => { setRunId(id); setScreen('reader'); };

  if (screen === 'setup') {
    return <Setup config={config} onCreate={open} onBack={() => setScreen('cover')} />;
  }
  if (screen === 'archive') {
    return <Archive onOpen={open} onBack={() => setScreen('cover')} />;
  }
  if (screen === 'reader' && runId) {
    return <Reader ctrl={ctrl} config={config} onExit={() => { setScreen('cover'); void api.listRuns().then((r) => setRuns(sortRuns(r))).catch(() => {}); }} />;
  }
  return (
    <Cover runs={runs}
      onBegin={() => setScreen('setup')}
      onContinue={open}
      onOpenArchive={() => setScreen('archive')} />
  );
}

function sortRuns(r: Run[]): Run[] {
  return [...r].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
