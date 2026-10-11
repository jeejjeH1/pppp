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
  { type: 'type', text: '> initializing intelligent_contract ...', in: 0.15, out: 1.85, dur: 1.4, cls: 'mono center', style: { top: '930px' } },
  { text: 'GenLayer', in: 2.1, out: 3.45, anim: 'track', cls: 'brand center', style: { top: '820px' } },
  { text: 'INTELLIGENT CONTRACTS', in: 2.35, out: 3.45, anim: 'track', ls: 0.5, cls: 'kicker center', style: { top: '965px' } },

  // ---------- S2 hook
  { text: 'THE BIG QUESTION', in: 4.15, out: 7.2, cls: 'kicker pink', style: L(150, 300) },
  { text: 'Why does *GenLayer*|need _direct_|_web_ _access?_', in: 4.25, out: 7.2, cls: 'h1', style: L(140, 350), stagger: 0.09 },
  { text: 'AND WHY IT MATTERS', in: 7.35, out: 9.85, cls: 'kicker pink', style: L(150, 300) },
  { text: 'How could it change|the way we think about|*smart* *contracts?*', in: 7.45, out: 9.85, cls: 'h1', style: L(140, 350), stagger: 0.08 },

  // ---------- S3 chain -> world
  { text: 'Blockchains are powerful at|*executing* *code.*', in: 10.15, out: 11.85, cls: 'h2 center', style: { top: '150px' }, stagger: 0.06 },
  { text: '…and processing on-chain data.', in: 10.7, out: 11.85, cls: 'body center', style: { top: '790px' } },
  { text: 'But the|_real_ _world_|goes far beyond|the chain.', in: 12.15, out: 15.85, anim: 'slam', cls: 'h1', style: L(140, 250), stagger: 0.1 },
  { text: 'News. Documents. Data.|Published across the web — every day.', in: 13.3, out: 15.85, cls: 'body', style: L(146, 800) },

  // ---------- S4 intelligent contracts
  { text: 'THIS IS WHERE @GENLAYER COMES IN', in: 16.1, out: 21.85, cls: 'kicker center', style: { top: '110px' } },
  { text: '*Intelligent* *Contracts*', in: 16.25, out: 21.85, anim: 'slam', cls: 'h1 center', style: { top: '150px', fontSize: '120px' }, stagger: 0.12 },
  {
    html: `<div class="chips">${chip('WEB ACCESS')}${chip('+', 'op')}${chip('AI MODELS')}${chip('→', 'op')}${chip('CRITERIA IN NATURAL LANGUAGE', 'mint')}</div>`,
    in: 18.0, out: 21.85, cls: 'center', style: { top: '930px' }, stagger: 0.18,
  },

  // ---------- S5 four reasons
  ...REASONS.flatMap((r, i) => {
    const T = 22 + i * 3;
    return [
      { text: `WHY IT MATTERS · ${i + 1}/4`, in: T + 0.05, out: T + 2.85, cls: 'kicker', style: L(150, 215) },
      { text: `0${i + 1}`, in: T + 0.05, out: T + 2.85, anim: 'slam', cls: 'num', style: L(130, 250) },
      { text: r.title, in: T + 0.2, out: T + 2.85, cls: 'h2', style: L(140, 500), stagger: 0.07 },
      { text: r.desc, in: T + 0.55, out: T + 2.85, cls: 'body', style: L(146, 700), stagger: 0.025 },
    ];
  }),

  // ---------- S6 consensus
  { text: 'HOW VALIDATORS AGREE', in: 34.1, out: 39.85, cls: 'kicker center', style: { top: '110px' } },
  { text: '*Optimistic* *Democracy*', in: 34.2, out: 39.85, anim: 'slam', cls: 'h1 center', style: { top: '150px' }, stagger: 0.12 },
  { text: 'AI models + validators evaluate results|and reach agreement.', in: 34.9, out: 37.35, cls: 'body center', style: { top: '850px' }, stagger: 0.03 },
  { text: 'It won’t erase every AI error — but it’s a new way|to decide _beyond_ _simple_ _computation._', in: 37.6, out: 39.85, cls: 'body center', style: { top: '850px' }, stagger: 0.03 },

  // ---------- S7 triad
  { text: 'The web provides the _information._', in: 40.1, out: 45.85, cls: 'h2 center', style: { top: '250px' }, stagger: 0.06 },
  { text: 'AI helps *interpret* it.', in: 41.55, out: 45.85, cls: 'h2 center', style: { top: '400px' }, stagger: 0.06 },
  { text: '*GenLayer* brings it on-chain.', in: 43.0, out: 45.85, anim: 'slam', cls: 'h1 center', style: { top: '560px' }, stagger: 0.09 },
  { text: 'THROUGH INTELLIGENT CONTRACTS', in: 43.6, out: 45.85, anim: 'track', ls: 0.32, cls: 'kicker center', style: { top: '720px' } },

  // ---------- S8 finale
  { text: 'The question is no longer what smart contracts can _execute_ —', in: 46.6, out: 50.3, cls: 'h3 center', style: { top: '110px' }, stagger: 0.05 },
  { text: 'but what *decisions* decentralized systems can *support.*', in: 48.0, out: 50.3, cls: 'h3 center', style: { top: '190px' }, stagger: 0.05 },
  { text: 'Could this be the next major step|in the evolution of *blockchain?*', in: 50.6, out: 55.4, cls: 'h2 center', style: { top: '100px' }, stagger: 0.07 },
  { text: 'INTELLIGENT CONTRACTS  ·  @GENLAYER', in: 51.6, out: 55.4, anim: 'track', ls: 0.3, cls: 'kicker center', style: { top: '960px' } },
];
