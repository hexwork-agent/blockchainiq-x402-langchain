#!/usr/bin/env node
/**
 * Standalone paid-call demo (no LangChain/LLM involved).
 *
 *   node examples/paid-call.mjs [brief|event-risk] [--rail auto|solana|base]
 *
 * Makes a real x402 paid call to blockchainiq.co and prints the data plus the
 * decoded PAYMENT-RESPONSE header (the on-chain settlement transaction).
 *
 * Env: see README ("Wallets & environment").
 */
import { API_BASE, RESOURCES, buildPaymentFetch, paymentResponse } from '../src/client.mjs';

const [resource = 'brief', railFlag, railValue] = [
  process.argv[2] || 'brief',
  process.argv.indexOf('--rail'),
  process.argv[process.argv.indexOf('--rail') + 1],
];
if (railFlag > -1) process.env.BIQ_RAIL = railValue;

if (!RESOURCES[resource]) {
  console.error(`unknown resource "${resource}" — use one of: ${Object.keys(RESOURCES).join(', ')}`);
  process.exit(1);
}

const spec = RESOURCES[resource];
const paidFetch = await buildPaymentFetch();

console.log(`GET ${API_BASE}${spec.path}  (price: ${spec.price} USDC via x402)`);
const t0 = Date.now();
const res = await paidFetch(API_BASE + spec.path, { method: 'GET' });
const ms = Date.now() - t0;
console.log(`HTTP ${res.status} in ${ms} ms`);
if (!res.ok) {
  console.error((await res.text()).slice(0, 500));
  process.exit(2);
}
const data = await res.json();
console.log('\n--- data (truncated) ---');
console.log(JSON.stringify(data, null, 1).slice(0, 900));

const payment = paymentResponse(res);
if (payment) {
  console.log('\n--- x402 settlement (PAYMENT-RESPONSE, decoded) ---');
  console.log(JSON.stringify(payment, null, 1));
} else {
  console.log('\n(no PAYMENT-RESPONSE header — resource was served unpaid?)');
}
process.exit(0);
