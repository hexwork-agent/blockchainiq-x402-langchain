#!/usr/bin/env node
/**
 * Connectivity smoke test — free resources only, no wallet, no payment.
 *   node test/free-check.mjs
 */
import { API_BASE } from '../src/client.mjs';

let fail = 0;
for (const path of ['/api/x402/v1', '/api/x402/v1/sample']) {
  try {
    const r = await fetch(API_BASE + path);
    const j = await r.json();
    const ok = r.status === 200 && j && (j.data !== undefined || j.transactions !== undefined);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${path} -> HTTP ${r.status}`);
    if (!ok) fail = 1;
  } catch (e) {
    console.log(`FAIL  ${path} -> ${e.message}`);
    fail = 1;
  }
}
process.exit(fail);
