/**
 * x402 payment client for blockchainiq.co.
 *
 * Builds a `fetch` that transparently handles HTTP 402 responses:
 *   1. first request returns 402 + PAYMENT-REQUIRED (accepts: rails, amounts)
 *   2. client signs a payment on a rail it has keys for (USDC on Base via
 *      EIP-3009, or USDC on Solana via a pre-signed transaction)
 *   3. request is retried with the PAYMENT header; the server's facilitator
 *      settles on-chain and answers 200 with a PAYMENT-RESPONSE header that
 *      carries the settlement transaction.
 *
 * No gas is needed in the paying wallet: settlement transactions are
 * completed by the facilitator. The wallet only needs USDC.
 */
import { readFileSync } from 'node:fs';
import { x402Client, wrapFetchWithPayment, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { toClientSvmSigner } from '@x402/svm';
import { privateKeyToAccount } from 'viem/accounts';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { base58 } from '@scure/base';

export const API_BASE = 'https://www.blockchainiq.co';

export const RESOURCES = {
  'brief': { path: '/api/x402/v1/brief', price: '$0.01', title: 'Market brief' },
  'event-risk': { path: '/api/x402/v1/event-risk', price: '$0.05', title: 'Event risk' },
};

/** Build a Solana keypair signer from env. Async (WebCrypto). */
export async function svmSignerFromEnv() {
  const keyPath = process.env.BIQ_SVM_SECRET_KEY_PATH;
  const b58 = process.env.BIQ_SVM_PRIVATE_KEY;
  if (keyPath) {
    const raw = JSON.parse(readFileSync(keyPath, 'utf8'));
    if (!Array.isArray(raw) || raw.length !== 64) throw new Error('BIQ_SVM_SECRET_KEY_PATH must point to a 64-byte JSON array (solana-keygen format)');
    return createKeyPairSignerFromBytes(Uint8Array.from(raw));
  }
  if (b58) {
    return createKeyPairSignerFromBytes(base58.decode(b58));
  }
  return null;
}

/**
 * Build a fetch wrapper with x402 payment handling.
 * @param {object} opts
 * @param {'auto'|'solana'|'base'} [opts.rail] which rails to enable (default: $BIQ_RAIL or 'auto')
 */
export async function buildPaymentFetch(opts = {}) {
  const rail = opts.rail || process.env.BIQ_RAIL || 'auto';
  const schemes = [];

  if (rail === 'auto' || rail === 'base') {
    const pk = process.env.BIQ_EVM_PRIVATE_KEY;
    if (!pk) {
      if (rail === 'base') throw new Error('rail=base but BIQ_EVM_PRIVATE_KEY is not set');
    } else {
      schemes.push({ network: 'eip155:8453', client: new ExactEvmScheme(privateKeyToAccount(pk)) });
    }
  }
  if (rail === 'auto' || rail === 'solana') {
    const signer = await svmSignerFromEnv();
    if (!signer) {
      if (rail === 'solana') throw new Error('rail=solana but no Solana key configured (BIQ_SVM_SECRET_KEY_PATH or BIQ_SVM_PRIVATE_KEY)');
    } else {
      schemes.push({ network: 'solana:*', client: new ExactSvmScheme(toClientSvmSigner(signer)) });
    }
  }

  if (schemes.length === 0) {
    throw new Error(
      'No payment keys configured. Set BIQ_EVM_PRIVATE_KEY (0x…, USDC on Base) ' +
      'and/or BIQ_SVM_SECRET_KEY_PATH / BIQ_SVM_PRIVATE_KEY (USDC on Solana).'
    );
  }

  const client = new x402Client();
  for (const s of schemes) client.register(s.network, s.client);
  return wrapFetchWithPayment(fetch, client);
}

/** Decode the PAYMENT-RESPONSE header (settlement details incl. tx hash). */
export function paymentResponse(res) {
  const h = res.headers.get('PAYMENT-RESPONSE');
  return h ? decodePaymentResponseHeader(h) : null;
}
