/**
 * LangChain tools for blockchainiq.co market data, paid over x402.
 *
 * Each tool is a standard @langchain/core DynamicTool: it has a name,
 * description and a zod schema, and its `func` performs the HTTP call.
 * The call settles a real USDC payment (x402 v2) before returning data —
 * $0.01 USDC for the market brief, $0.05 USDC for event risk.
 */
import { DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';
import { API_BASE, RESOURCES, buildPaymentFetch, paymentResponse } from './client.mjs';

async function paidGet(resource) {
  const spec = RESOURCES[resource];
  const paidFetch = await buildPaymentFetch();
  const res = await paidFetch(API_BASE + spec.path, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) throw new Error(`blockchainiq.co ${spec.path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { data, payment: paymentResponse(res) };
}

/** LangChain tool: current market brief ($0.01 USDC per call). */
export function marketBriefTool() {
  return new DynamicTool({
    name: 'biq_market_brief',
    description:
      'Get the current crypto/market brief from blockchainiq.co ' +
      '(top movers, majors, sentiment). This tool pays $0.01 USDC per call ' +
      'over the x402 payment protocol (USDC on Base or Solana, depending on ' +
      'the configured wallet) before returning the data.',
    schema: z.object({}),
    func: async () => {
      const { data, payment } = await paidGet('brief');
      return JSON.stringify({ source: 'blockchainiq.co /api/x402/v1/brief', x402_payment: payment, data }, null, 2);
    },
  });
}

/** LangChain tool: crypto event-risk digest ($0.05 USDC per call). */
export function eventRiskTool() {
  return new DynamicTool({
    name: 'biq_event_risk',
    description:
      'Get the current crypto event-risk digest from blockchainiq.co ' +
      '(dated risks, catalysts, tail scenarios). This tool pays $0.05 USDC ' +
      'per call over the x402 payment protocol before returning the data.',
    schema: z.object({}),
    func: async () => {
      const { data, payment } = await paidGet('event-risk');
      return JSON.stringify({ source: 'blockchainiq.co /api/x402/v1/event-risk', x402_payment: payment, data }, null, 2);
    },
  });
}
