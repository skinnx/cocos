import type { Game, Phase } from './core';
export interface PreviewBot { tick(): void }
export function makeBot(_g: Game): PreviewBot { return { tick() {} }; }
export function gotoPhase(_g: Game, _p: Phase, _n?: number) {}
