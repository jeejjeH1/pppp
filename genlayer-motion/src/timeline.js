// Master timeline. 120 BPM -> 1 beat = 0.5 s, 1 bar = 2 s. Every cut lands on a beat
// so the soundtrack (src/audio.py) hits line up with the picture.

export const DURATION = 56;

export const SCENES = [
  { id: 'intro', start: 0, end: 4 },
  { id: 'hook', start: 4, end: 10 },
  { id: 'world', start: 10, end: 16 },
  { id: 'ic', start: 16, end: 22 },
  { id: 'reasons', start: 22, end: 34 },
  { id: 'consensus', start: 34, end: 40 },
  { id: 'triad', start: 40, end: 46 },
  { id: 'finale', start: 46, end: 56 },
];

// camera shake / chroma / flash hits (k = shake energy, flash = white flash)
export const IMPACTS = [
  { t: 2.0, k: 1.2, flash: 0.9 },
  { t: 4.0, k: 1.3, flash: 0.35 },
  { t: 10.0, k: 0.5, flash: 0.25 },
  { t: 12.0, k: 1.0, flash: 0.6 },
  { t: 16.0, k: 1.0, flash: 0.6 },
  { t: 22.0, k: 0.6, flash: 0.35 },
  { t: 25.0, k: 0.5, flash: 0.3 },
  { t: 28.0, k: 0.5, flash: 0.3 },
  { t: 31.0, k: 0.8, flash: 0.4 },
  { t: 34.0, k: 0.6, flash: 0.4 },
  { t: 37.5, k: 0.9, flash: 0.5 },
  { t: 40.0, k: 0.6, flash: 0.45 },
  { t: 43.0, k: 0.8, flash: 0.5 },
  { t: 46.0, k: 1.4, flash: 1.0 },
  { t: 50.5, k: 0.4, flash: 0.2 },
];

const L = (left, top) => ({ left: `${left}px`, top: `${top}px` });
const chip = (txt, cls = '') => `<span class="chip ${cls}">${txt}</span>`;

const REASONS = [
  { title: 'Real-world|*decisions*', desc: 'Did the event happen?|The evidence lives across|many websites and sources.' },
  { title: 'Beyond|*deterministic* *logic*', desc: 'Interpreting natural language,|context and unstructured|information.' },
  { title: 'An economy of|*AI* *agents*', desc: 'Was the agreement fulfilled?|Does the result meet the|original requirements?' },
  { title: 'Web access|*isn’t* *enough*', desc: 'Content can be incomplete,|contradictory, outdated —|or deliberately misleading.' },
];

export const CUES = [
  // ---------- S1 intro
  { text: '> initializing intelligent_contract ...', anim: 'type', cps: 30, in: 0.15, out: 1.85, cls: 'mono center', style: { top: '930px' } },
  { text: 'GenLayer', anim: 'scramble', settle: 0.15, stagger: 0.05, in: 2.05, out: 3.45, cls: 'brand center', style: { top: '820px' } },
  { text: 'INTELLIGENT CONTRACTS', in: 2.35, out: 3.45, anim: 'track', ls: 0.5, cls: 'kicker center', style: { top: '965px' } },

  // ---------- S2 hook
  { text: 'THE BIG QUESTION', anim: 'scramble', in: 4.05, out: 7.2, cls: 'kicker pink', style: L(150, 300) },
  { text: 'Why does *GenLayer*|need _direct_|_web_ _access?_', anim: 'type', cps: 30, in: 4.25, out: 7.2, cls: 'h1', style: L(140, 350) },
  { text: 'AND WHY IT MATTERS', anim: 'scramble', in: 7.3, out: 9.85, cls: 'kicker pink', style: L(150, 300) },
  { text: 'How could it change|the way we think about|*smart* *contracts?*', anim: 'type', cps: 40, in: 7.45, out: 9.85, cls: 'h1', style: L(140, 350) },

  // ---------- S3 chain -> world
  { text: 'Blockchains are powerful at|*executing* *code.*', anim: 'chars', in: 10.1, out: 11.85, cls: 'h2 center', style: { top: '150px' } },
  { text: '…and processing on-chain data.', anim: 'type', cps: 36, in: 10.6, out: 11.85, cls: 'body center', style: { top: '790px' } },
  { text: 'But the|_real_ _world_|goes far beyond|the chain.', in: 12.05, out: 15.85, anim: 'slam', cls: 'h1', style: L(140, 250), stagger: 0.25 },
  { text: 'News. Documents. Data.|Published across the web — every day.', anim: 'type', cps: 40, in: 13.6, out: 15.85, cls: 'body', style: L(146, 800) },

  // ---------- S4 intelligent contracts
  { text: 'THIS IS WHERE @GENLAYER COMES IN', anim: 'scramble', stagger: 0.02, in: 16.05, out: 21.85, cls: 'kicker center', style: { top: '110px' } },
  { text: '*Intelligent* *Contracts*', in: 16.0, out: 21.85, anim: 'slam', cls: 'h1 center', style: { top: '150px', fontSize: '120px' }, stagger: 0.25 },
  {
    html: `<div class="chips">${chip('WEB ACCESS')}${chip('+', 'op')}${chip('AI MODELS')}${chip('→', 'op')}${chip('CRITERIA IN NATURAL LANGUAGE', 'mint')}</div>`,
    in: 18.0, out: 21.85, cls: 'center', style: { top: '930px' }, stagger: 0.25,
  },

  // ---------- S5 four reasons
  ...REASONS.flatMap((r, i) => {
    const T = 22 + i * 3;
    return [
      { text: `WHY IT MATTERS · ${i + 1}/4`, anim: 'scramble', stagger: 0.02, in: T + 0.05, out: T + 2.85, cls: 'kicker', style: L(150, 215) },
      { text: `0${i + 1}`, in: T, out: T + 2.85, anim: 'slam', cls: 'num', style: L(130, 250) },
      { text: r.title, anim: 'chars', in: T + 0.15, out: T + 2.85, cls: 'h2', style: L(140, 500) },
      { text: r.desc, anim: 'type', cps: 62, in: T + 0.55, out: T + 2.85, cls: 'body', style: L(146, 700) },
    ];
  }),

  // ---------- S6 consensus
  { text: 'HOW VALIDATORS AGREE', anim: 'scramble', in: 34.05, out: 39.85, cls: 'kicker center', style: { top: '110px' } },
  { text: '*Optimistic* *Democracy*', in: 34.0, out: 39.85, anim: 'slam', cls: 'h1 center', style: { top: '150px' }, stagger: 0.25 },
  { text: 'AI models + validators evaluate results|and reach agreement.', anim: 'type', cps: 42, in: 34.8, out: 37.35, cls: 'body center', style: { top: '850px' } },
  { text: 'It won’t erase every AI error — but it’s a new way|to decide _beyond_ _simple_ _computation._', anim: 'type', cps: 52, in: 37.55, out: 39.85, cls: 'body center', style: { top: '850px' } },

  // ---------- S7 triad
  { text: 'The web provides the _information._', anim: 'type', cps: 34, in: 40.05, out: 45.85, cls: 'h2 center', style: { top: '250px' } },
  { text: 'AI helps *interpret* it.', anim: 'type', cps: 30, in: 41.5, out: 45.85, cls: 'h2 center', style: { top: '400px' } },
  { text: '*GenLayer* brings it on-chain.', in: 43.0, out: 45.85, anim: 'slam', cls: 'h1 center', style: { top: '560px' }, stagger: 0.125 },
  { text: 'THROUGH INTELLIGENT CONTRACTS', anim: 'scramble', stagger: 0.02, in: 43.6, out: 45.85, cls: 'kicker center', style: { top: '720px' } },

  // ---------- S8 finale
  { text: 'The question is no longer what smart contracts can _execute_ —', anim: 'type', cps: 44, in: 46.5, out: 50.3, cls: 'h3 center', style: { top: '110px' } },
  { text: 'but what *decisions* decentralized systems can *support.*', anim: 'type', cps: 44, in: 48.0, out: 50.3, cls: 'h3 center', style: { top: '190px' } },
  { text: 'Could this be the next major step|in the evolution of *blockchain?*', anim: 'chars', in: 50.5, out: 55.4, cls: 'h2 center', style: { top: '100px' } },
  { text: 'INTELLIGENT CONTRACTS  ·  @GENLAYER', anim: 'scramble', stagger: 0.025, in: 51.5, out: 55.4, cls: 'kicker center', style: { top: '960px' } },
];

// Where the drums play (shared by the soundtrack and the beat-reactive visuals).
// Gaps right before 16 / 40 / 46 are the "drop" silences.
export const KICK = [[4, 15.5], [16, 34], [37.5, 39.75], [40, 45.5], [46, 50.5]];
export const CLAP = [[8, 15.5], [16, 34], [40, 45.5], [46, 50.5]];
export const DROPS = [16, 40, 46];
