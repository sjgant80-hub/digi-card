// sandbox.test.mjs — a tool opens in a box that never shares this page's origin, and before it does the Kit says what the
// tool's own page asked for: the network and frames its Content-Security-Policy allows, and whether it keeps anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SANDBOX, MAX_PAGE, policyOf, askedFor, boxable } from '../src/sandbox.mjs';

const page = (csp, body = '') => '<!doctype html><html><head><meta charset="utf-8" />' + (csp === null ? '' : '<meta http-equiv="Content-Security-Policy" content="' + csp + '" />') + '</head><body>' + body + '</body></html>';

test('the box: scripts and forms, and never the same origin, a pop-up, a download or the top window', () => {
  assert.deepEqual(SANDBOX, ['allow-scripts', 'allow-forms']);
  assert.ok(Object.isFrozen(SANDBOX));
  for (const never of ['allow-same-origin', 'allow-popups', 'allow-top-navigation', 'allow-downloads', 'allow-modals']) assert.equal(SANDBOX.includes(never), false, never);
  assert.equal(MAX_PAGE, 2000000);
});

test('a page’s policy: read from its meta tags, the first of each directive standing', () => {
  assert.deepEqual(policyOf(page("default-src 'self'; connect-src 'self' https://api.example.com; img-src data:")), { 'default-src': ["'self'"], 'connect-src': ["'self'", 'https://api.example.com'], 'img-src': ['data:'] });
  assert.equal(policyOf(page(null)), null, 'a page that states none');
  assert.deepEqual(policyOf("<meta http-equiv='content-security-policy' content='connect-src none'>"), { 'connect-src': ['none'] }, 'single quotes, any case');
  assert.deepEqual(policyOf('<meta http-equiv=Content-Security-Policy content="default-src \'self\'">' + '<meta http-equiv="Content-Security-Policy" content="default-src *; frame-src \'none\'">'), { 'default-src': ["'self'"], 'frame-src': ["'none'"] }, 'two tags: the first of each directive stands');
  assert.equal(policyOf('<meta http-equiv="Content-Security-Policy">'), null, 'no content');
  assert.equal(policyOf('<meta http-equiv="Content-Security-Policy" content="  ;  ">'), null, 'an empty policy states nothing');
  for (const junk of [null, 5, {}, 'x'.repeat(MAX_PAGE + 1)]) assert.equal(policyOf(junk), null);
  assert.notEqual(policyOf(page("default-src 'self'") + 'x'.repeat(MAX_PAGE - 200)), null, 'a page just under the cap is read');
  const at = page("default-src 'self'", 'localStorage'), exact = at + 'x'.repeat(MAX_PAGE - at.length);
  assert.equal(exact.length, MAX_PAGE);
  assert.notEqual(policyOf(exact), null, 'a page of exactly the cap is read');
  assert.match(askedFor(exact).storage, /^it keeps things/, 'and its words are read');
  assert.equal(askedFor(exact + 'x').storage, 'nothing kept in storage that its page shows', 'one more and it is not');
});

test('what a tool asked for, in plain words: its network, its frames, its storage', () => {
  assert.deepEqual(askedFor(page("default-src 'self'")), { policy: true, network: 'the network on its own address only', frames: 'pages in frames on its own address only', storage: 'nothing kept in storage that its page shows' });
  assert.deepEqual(askedFor(page("default-src 'self'; connect-src https://a.example https://b.example data:; frame-src 'none'")), { policy: true, network: 'the network on https://a.example, https://b.example', frames: 'no pages in frames', storage: 'nothing kept in storage that its page shows' });
  assert.equal(askedFor(page(null)).network, 'the network anywhere: its page states no limit');
  assert.equal(askedFor(page(null)).policy, false);
  assert.equal(askedFor(page("img-src 'self'")).network, 'the network anywhere: its page states no limit', 'no connect-src and no default-src: no limit');
  for (const any of ['*', 'https:', 'wss:', 'http:']) assert.equal(askedFor(page("connect-src 'self' " + any)).network, 'the network anywhere: its page states no limit', any);
  assert.equal(askedFor(page("connect-src blob: 'self'")).network, 'the network on its own address only');
  assert.deepEqual([askedFor(page("default-src 'none'")).network, askedFor(page("default-src 'none'")).frames], ['no network at all', 'no pages in frames'], 'none is none');
  assert.equal(askedFor(page("default-src 'self'", '<script>localStorage.setItem(1,2)</script>')).storage, 'it keeps things in its storage, which inside the box is its own and empty');
  for (const word of ['sessionStorage', 'indexedDB']) assert.match(askedFor(page(null, word)).storage, /^it keeps things/, word);
  assert.equal(askedFor(page(null, 'mylocalStorageX')).storage, 'nothing kept in storage that its page shows', 'whole words only');
  for (const junk of [null, 5]) assert.deepEqual(askedFor(junk), { policy: false, network: 'the network anywhere: its page states no limit', frames: 'pages in frames anywhere: its page states no limit', storage: 'nothing kept in storage that its page shows' });
});

test('boxable: an https page on this very address; anything else opens in its own tab', () => {
  const here = 'https://sjgant80-hub.github.io/digi-card/';
  assert.equal(boxable('https://sjgant80-hub.github.io/acg-assessor/', here), true);
  for (const no of ['https://example.com/tool/', 'http://sjgant80-hub.github.io/acg-assessor/', 'https://sjgant80-hub.github.io:8443/x/', 'javascript:alert(1)', 'not a url', null]) assert.equal(boxable(no, here), false, String(no));
  assert.equal(boxable('https://sjgant80-hub.github.io/x/', 'junk'), false);
});
