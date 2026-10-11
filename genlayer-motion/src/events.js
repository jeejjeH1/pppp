// Exports the picture timeline (text SFX + drum sections) for src/audio.py.
//   node src/events.js out/events.json
import fs from 'node:fs';
import { CUES, IMPACTS, KICK, CLAP, DROPS, DURATION } from './timeline.js';
import { cueEvents } from './overlay.js';

const out = process.argv[2] || 'out/events.json';
fs.writeFileSync(out, JSON.stringify({ duration: DURATION, sfx: cueEvents(CUES), impacts: IMPACTS, kick: KICK, clap: CLAP, drops: DROPS }));
console.log('wrote', out);
