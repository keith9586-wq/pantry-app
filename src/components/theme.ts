import type { Urgency } from '../lib/expiry';

export const colors = {
  bg: '#F7F7F4',
  card: '#FFFFFF',
  text: '#1C1C1A',
  muted: '#6B6B66',
  border: '#E3E3DE',
  primary: '#2F7D4F',
  primarySoft: '#E4F2E9',
  danger: '#C2410C',
  dangerSoft: '#FDEBE1',
  warn: '#B7791F',
  warnSoft: '#FCF3DC',
};

export const urgencyColor: Record<Urgency, { fg: string; bg: string }> = {
  expired: { fg: colors.danger, bg: colors.dangerSoft },
  today: { fg: colors.danger, bg: colors.dangerSoft },
  soon: { fg: colors.warn, bg: colors.warnSoft },
  ok: { fg: colors.primary, bg: colors.primarySoft },
  unknown: { fg: colors.muted, bg: colors.border },
};

export const space = (n: number) => n * 4;
