// One list of event sources with their own refresh interval. The CLI runs them all; the Worker runs each when it is due.
import { ANTARA, collectAntara } from './antara.mjs';
import { BNPB, collectBnpb } from './bnpb-dibi.mjs';
import { GDELT, collectGdelt } from './gdelt.mjs';
import { PETABENCANA, collectPetaBencana } from './petabencana.mjs';

/**
 * Intervals follow how often each provider changes and what it tolerates:
 * citizen reports are live (10 min), news feeds move quickly (15 min), GDELT is rate limited and paced (30 min),
 * BNPB DIBI is a preliminary table updated through the day (3 h).
 */
export const EVENT_SOURCES = [
  { meta: PETABENCANA, run: collectPetaBencana, intervalMinutes: 10, retentionDays: 7 },
  { meta: ANTARA, run: collectAntara, intervalMinutes: 15, retentionDays: 14 },
  { meta: GDELT, run: collectGdelt, intervalMinutes: 30, retentionDays: 14 },
  { meta: BNPB, run: collectBnpb, intervalMinutes: 180, retentionDays: 60 }
];

export const BNPB_ID = BNPB.id;
