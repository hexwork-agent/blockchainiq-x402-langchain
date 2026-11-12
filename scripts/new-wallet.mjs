#!/usr/bin/env node
/**
 * Generate a throwaway wallet for clean-room verification (no secrets, no
 * hard-coded keys — the checkout runs the repo with a fresh wallet).
 *
 *   node scripts/new-wallet.mjs [solana|evm] [outfile]
 *
 * - solana: writes a 64-byte JSON array (solana-keygen format) to outfile
 *           (default: ./throwaway-solana.json) — fund it with USDC on Solana,
 *           then run: BIQ_SVM_SECRET_KEY_PATH=./throwaway-solana.json node examples/paid-call.mjs brief
 * - evm:    writes a private key to outfile (default: ./throwaway-evm.json) —
 *           fund the address with USDC on Base, then run:
 *           BIQ_EVM_PRIVATE_KEY=$(node -e "console.log(require('./throwaway-evm.json').privateKey)") node examples/paid-call.mjs brief
 *
 * The public address is printed; the secret key is never printed.
 */
import { writeFileSync } from 'node:fs';
import { ed25519 } from '@noble/curves/ed25519';
import { base58 } from '@scure/base';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const [kind = 'solana', outfile] = [process.argv[2] || 'solana', process.argv[3]];

if (kind === 'solana') {
  const path = outfile || './throwaway-solana.json';
  const seed = ed25519.utils.randomPrivateKey(); // 32 bytes
  const pub = ed25519.getPublicKey(seed);        // 32 bytes
  const secret64 = new Uint8Array(64);           // solana-keygen format: secret | public
  secret64.set(seed, 0);
  secret64.set(pub, 32);
  writeFileSync(path, JSON.stringify(Array.from(secret64), null, 0), { mode: 0o600 });
  console.log(`wrote ${path} (mode 600)`);
  console.log('public address:', base58.encode(pub));
  console.log('\nFund this address with USDC on Solana, then run:');
  console.log(`  BIQ_SVM_SECRET_KEY_PATH=${path} node examples/paid-call.mjs brief`);
} else if (kind === 'evm') {
  const path = outfile || './throwaway-evm.json';
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  writeFileSync(path, JSON.stringify({ privateKey: pk, address: account.address }, null, 2), { mode: 0o600 });
  console.log(`wrote ${path} (mode 600)`);
  console.log('public address:', account.address);
  console.log('\nFund this address with USDC on Base, then run:');
  console.log(`  BIQ_EVM_PRIVATE_KEY=*** privateKey from ${path}) node examples/paid-call.mjs brief --rail base`);
} else {
  console.error('usage: node scripts/new-wallet.mjs [solana|evm] [outfile]');
  process.exit(1);
}
