// src/sandbox.mjs — THE SANDBOX: a tool runs in a box and gets only what it was allowed.
//
// Every estate tool is a page on the same address as DIGI, so a tool opened as a page of its own could reach this page's
// storage. In the Kit a tool opens in a box instead: a frame with SANDBOX's tokens and never allow-same-origin, so the
// tool runs in an origin of its own and cannot read or change anything of DIGI's — not its storage, not your cards, and
// it never moves a score (duels and raids are scored by the card's mind). Before it opens, the box reads the tool's own
// page and says what it asked for: the network its Content-Security-Policy lets it reach (its own address only, the
// hosts it names, or anything, when it states no limit), whether it may load pages in frames, and whether it keeps
// anything in storage it can reach (inside the box it cannot). A page on another address opens in its own tab, and the
// Kit says so. Pure and total: junk reads as a page that asked for nothing it can show.
export const SANDBOX = Object.freeze(['allow-scripts', 'allow-forms']);
export const MAX_PAGE = 2000000;

const META = /<meta\b[^>]*http-equiv\s*=\s*[\x22\x27]?content-security-policy[\x22\x27]?[^>]*>/gi;
const CONTENT = /\bcontent\s*=\s*(\x22([^\x22]*)\x22|\x27([^\x27]*)\x27)/i;

/** a page's Content-Security-Policy, from its meta tags (directive → sources), or null when it states none */
export function policyOf(html) {
  if (typeof html !== 'string' || html.length > MAX_PAGE) return null;
  const metas = html.match(META);
  if (!metas) return null;
  const out = {};
  for (const tag of metas) {
    const c = CONTENT.exec(tag);
    if (!c) continue;
    for (const part of (c[2] !== undefined ? c[2] : c[3]).split(';')) {
      const [name, ...sources] = part.trim().split(/\s+/);
      if (name && !Object.prototype.hasOwnProperty.call(out, name.toLowerCase())) out[name.toLowerCase()] = sources;
    }
  }
  return Object.keys(out).length ? out : null;
}

/** what a directive allows, falling back to default-src as browsers do: { kind: 'none' | 'self' | 'hosts' | 'any', hosts } */
function reach(policy, directive) {
  const s = policy && (policy[directive] || policy['default-src']);
  if (!s) return { kind: 'any', hosts: [] };
  if (s.includes("'none'")) return { kind: 'none', hosts: [] };
  const hosts = s.filter((x) => !x.startsWith("'") && x !== 'data:' && x !== 'blob:');
  if (hosts.includes('*') || hosts.some((h) => /^(https?:|wss?:)$/.test(h))) return { kind: 'any', hosts: [] };
  return hosts.length ? { kind: 'hosts', hosts } : { kind: 'self', hosts: [] };
}

/** what a tool's page asked for: { policy: boolean, network, frames, storage } in plain words for the Kit to show */
export function askedFor(html) {
  const p = policyOf(html), text = typeof html === 'string' && html.length <= MAX_PAGE ? html : '';
  const net = reach(p, 'connect-src'), fr = reach(p, 'frame-src');
  const say = (r, what, nothing) => (r.kind === 'none' ? nothing : r.kind === 'self' ? what + ' on its own address only' : r.kind === 'hosts' ? what + ' on ' + r.hosts.join(', ') : what + ' anywhere: its page states no limit');
  return { policy: p !== null, network: say(net, 'the network', 'no network at all'), frames: say(fr, 'pages in frames', 'no pages in frames'), storage: /\b(localStorage|sessionStorage|indexedDB)\b/.test(text) ? 'it keeps things in its storage, which inside the box is its own and empty' : 'nothing kept in storage that its page shows' };
}

/** whether a tool's page may open in the box here: an https page on this very address (else it opens in its own tab) */
export function boxable(page, here) {
  try { const a = new URL(page), b = new URL(here); return a.protocol === 'https:' && a.origin === b.origin; } catch { return false; }
}
