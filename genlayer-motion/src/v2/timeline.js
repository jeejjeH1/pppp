// v2 "A thread of light": no character, everything is built from one particle system.
// 56 s, phrases on a 4-second grid (matches the ambient soundtrack's chord changes).

export const DURATION = 56;

// Particle formations: at `t` the particles start flowing into formation `f`.
export const FORMATIONS = [
  { t: 0, f: 'scatter' },
  { t: 1.0, f: 'logo' },
  { t: 8.0, f: 'chain' },
  { t: 12.4, f: 'web' },
  { t: 20.0, f: 'core' },
  { t: 26.0, f: 'evidence' },
  { t: 30.0, f: 'grid' },
  { t: 31.6, f: 'wave' },
  { t: 34.0, f: 'agents' },
  { t: 38.0, f: 'noise', dur: 1.2 },
  { t: 40.4, f: 'filtered', dur: 1.0 },
  { t: 42.0, f: 'consensus' },
  { t: 48.0, f: 'drift' },
  { t: 51.6, f: 'logoEnd' },
];

const L = (left, top) => ({ left: `${left}px`, top: `${top}px` });
const soft = (c) => ({ anim: 'soft', stagger: Math.min(0.09, 0.9 / c.text.split(/[ |]+/).length), ...c });

const REASONS = [
  { title: 'Real-world|*decisions*', desc: 'Did a specific event happen?|The evidence is spread across|many websites and sources.' },
  { title: 'Beyond|*deterministic* *rules*', desc: 'Interpreting natural language,|context and unstructured|information.' },
  { title: 'Agreements|between *AI* *agents*', desc: 'Was the agreement fulfilled?|Does the result meet the|original requirements?' },
  { title: 'Access|*isn’t* *enough*', desc: 'Web content can be incomplete,|contradictory, outdated —|or deliberately misleading.' },
];

export const CUES = [
  // opening
  { text: 'INTELLIGENT CONTRACTS', anim: 'track', ls: 0.5, in: 3.0, out: 7.6, cls: 'kicker center', style: { top: '700px' } },
  soft({ text: 'Why does GenLayer need _direct_ _web_ _access?_', in: 4.0, out: 7.6, cls: 'h2 center', style: { top: '770px' } }),

  // chain -> world
  soft({ text: 'TODAY', in: 8.6, out: 11.7, cls: 'kicker', style: L(146, 330) }),
  soft({ text: 'Blockchains are|powerful at|*executing* *code.*', in: 8.8, out: 11.7, cls: 'h2', style: L(140, 380) }),
  soft({ text: 'BUT', in: 12.2, out: 15.7, cls: 'kicker pink', style: L(146, 330) }),
  soft({ text: 'the _real_ _world_|extends far|beyond the chain.', in: 12.4, out: 15.7, cls: 'h2', style: L(140, 380) }),

  // web
  soft({ text: 'THE WEB', in: 16.1, out: 19.7, cls: 'kicker', style: L(146, 330) }),
  soft({ text: 'News, documents,|data — published|*every* *day.*', in: 16.2, out: 19.7, cls: 'h2', style: L(140, 380) }),
  soft({ text: 'Deciding on it takes more|than predefined rules.', in: 17.0, out: 19.7, cls: 'body', style: L(146, 650) }),

  // intelligent contracts
  soft({ text: 'THIS IS WHERE @GENLAYER COMES IN', in: 20.2, out: 25.7, cls: 'kicker', style: L(146, 330) }),
  soft({ text: '*Intelligent*|*Contracts*', in: 20.4, out: 25.7, cls: 'h1', style: L(140, 380) }),
  soft({ text: 'Web access + AI models,|evaluating criteria written|in natural language.', in: 21.4, out: 25.7, cls: 'body', style: L(146, 620) }),

  // four reasons
  ...REASONS.flatMap((r, i) => {
    const T = 26 + i * 4;
    return [
      soft({ text: `WHY IT MATTERS  ${i + 1} / 4`, in: T + 0.1, out: T + 3.75, cls: 'kicker', style: L(146, 250) }),
      soft({ text: `0${i + 1}`, in: T, out: T + 3.75, cls: 'num', style: L(130, 290) }),
      soft({ text: r.title, in: T + 0.3, out: T + 3.75, cls: 'h2', style: L(140, 520) }),
      soft({ text: r.desc, in: T + 0.8, out: T + 3.75, cls: 'body', style: L(146, 700) }),
    ];
  }),

  // consensus
  soft({ text: 'HOW VALIDATORS AGREE', in: 42.1, out: 47.7, cls: 'kicker center', style: { top: '110px' } }),
  soft({ text: '*Optimistic* *Democracy*', in: 42.2, out: 47.7, cls: 'h1 center', style: { top: '150px' } }),
  soft({ text: 'Validators use AI models to evaluate results and reach agreement.', in: 43.2, out: 45.7, cls: 'body center', style: { top: '880px' } }),
  soft({ text: 'Not a guarantee against every error — a new way to decide.', in: 45.9, out: 47.7, cls: 'body center', style: { top: '880px' } }),

  // triad
  soft({ text: 'The web provides the _information._', in: 48.2, out: 51.4, cls: 'h2 center', style: { top: '330px' } }),
  soft({ text: 'AI helps *interpret* it.', in: 49.0, out: 51.4, cls: 'h2 center', style: { top: '450px' } }),
  soft({ text: 'GenLayer brings it _on-chain._', in: 49.8, out: 51.4, cls: 'h2 center', style: { top: '570px' } }),

  // close
  soft({ text: 'Could this be the next major step|in the evolution of *blockchain?*', in: 52.2, out: 55.6, cls: 'h3 center', style: { top: '740px' } }),
  { text: '@GENLAYER', anim: 'track', ls: 0.5, in: 53.0, out: 55.6, cls: 'kicker center', style: { top: '930px' } },
];
