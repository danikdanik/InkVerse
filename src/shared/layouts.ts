import type { LayoutTemplateId } from './schemas';
/** Trusted page layouts. Grid is 12 cols; rows in fr. Each slot has a fixed aspect so images never shift content. */
export type Aspect = '16:9' | '4:3' | '3:2' | '1:1' | '3:4' | '2:3';
export interface LayoutSlot { slot: number; col: string; row: string; aspect: Aspect }
export interface LayoutTemplate { id: LayoutTemplateId; panels: number; rows: string; slots: LayoutSlot[] }
export const LAYOUTS: Record<LayoutTemplateId, LayoutTemplate> = {
  'opening-trio': { id: 'opening-trio', panels: 3, rows: '3fr 2fr', slots: [
    { slot: 0, col: '1 / 13', row: '1 / 2', aspect: '16:9' },
    { slot: 1, col: '1 / 6', row: '2 / 3', aspect: '1:1' },
    { slot: 2, col: '6 / 13', row: '2 / 3', aspect: '3:2' } ] },
  'single-splash': { id: 'single-splash', panels: 1, rows: '1fr', slots: [ { slot: 0, col: '1 / 13', row: '1 / 2', aspect: '3:2' } ] },
  'duo-stack': { id: 'duo-stack', panels: 2, rows: '1fr 1fr', slots: [
    { slot: 0, col: '1 / 13', row: '1 / 2', aspect: '16:9' }, { slot: 1, col: '1 / 13', row: '2 / 3', aspect: '16:9' } ] },
  'duo-side': { id: 'duo-side', panels: 2, rows: '1fr', slots: [
    { slot: 0, col: '1 / 8', row: '1 / 2', aspect: '4:3' }, { slot: 1, col: '8 / 13', row: '1 / 2', aspect: '3:4' } ] },
  'wide-over-insert': { id: 'wide-over-insert', panels: 2, rows: '2fr 1fr', slots: [
    { slot: 0, col: '1 / 13', row: '1 / 2', aspect: '16:9' }, { slot: 1, col: '7 / 13', row: '2 / 3', aspect: '3:2' } ] },
  'ending-splash': { id: 'ending-splash', panels: 1, rows: '1fr', slots: [ { slot: 0, col: '1 / 13', row: '1 / 2', aspect: '16:9' } ] },
};
export const aspectRatio = (a: Aspect) => { const [w, h] = a.split(':').map(Number); return w / h; };
