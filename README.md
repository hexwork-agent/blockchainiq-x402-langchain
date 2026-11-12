# blockchainiq-x402-langchain

**LangChain tools that pay for [blockchainiq.co](https://www.blockchainiq.co) market data over the
[x402](https://x402.org) payment protocol.** Each tool call settles a real USDC payment
on-chain (Base or Solana) before the data is returned:

| Tool | Resource | Price |
| --- | --- | --- |
| `biq_market_brief` | `GET /api/x402/v1/brief` | $0.01 USDC |
| `biq_event_risk` | `GET /api/x402/v1/event-risk` | $0.05 USDC |

Built for the **BlockchainIQ x402 integration bounties** (LangChain tool slot) — the
integration is a public repo whose tools make working paid x402 calls to `brief` /
`event-risk`.

## How the payment works (x402 v2)

1. The tool calls the resource. The server answers `402 Payment Required` with a
   `PAYMENT-REQUIRED` header listing accepted rails and amounts.
2. The client (`src/client.mjs`, built on `@x402/fetch`) signs a payment on a rail it
   has keys for:
   - **Base (EVM)** — USDC via EIP-3009 signed authorization, or
   - **Solana (SVM)** — USDC via a pre-signed transaction.
3. The request is retried with the `PAYMENT` header. The seller's facilitator settles
   on-chain and answers `200` with a `PAYMENT-RESPONSE` header carrying the settlement
   transaction — this is the verifiable paid call.

**Your wallet only needs USDC — no gas.** Settlement transactions are completed by the
facilitator; the paying wallet just signs.

## Install

```bash
npm install
node test/free-check.mjs     # no wallet needed — hits the free catalog endpoints
```

## Wallets & environment

Configure one or both rails (only the rails you configure are used; with both set,
the client picks whichever the server offers first — use `BIQ_RAIL` to force one):

| Variable | Purpose |
| --- | --- |
| `BIQ_EVM_PRIVATE_KEY` | `0x…` private key of an EVM wallet holding **USDC on Base** (rail: `eip155:8453`) |
| `BIQ_SVM_SECRET_KEY_PATH` | Path to a 64-byte JSON array (solana-keygen format) of a wallet holding **USDC on Solana** |
| `BIQ_SVM_PRIVATE_KEY` | Alternative: base58-encoded 64-byte Solana secret key |
| `BIQ_RAIL` | `auto` (default) / `solana` / `base` |

Example:

```bash
export BIQ_EVM_PRIVATE_KEY=0x...          # wallet with USDC on Base
export BIQ_SVM_SECRET_KEY_PATH=./keypair.json   # wallet with USDC on Solana
node examples/paid-call.mjs brief --rail solana
```

## Run

```bash
# 1. standalone paid call (prints data + decoded settlement tx)
node examples/paid-call.mjs brief            # $0.01
node examples/paid-call.mjs event-risk       # $0.05

# 2. through the LangChain tool (same paid call, tool interface)
node examples/langchain-tool.mjs             # $0.01
```

## Clean-room verification (no secrets, throwaway wallet)

The BlockchainIQ x402 bounty check runs the repo "in an isolated, clean
environment with no secrets and a throwaway wallet." This repo is built for
that: **no keys are hard-coded or fetched — wallets come in via environment
variables only.**

```bash
# 1. make a throwaway wallet (address printed, secret never printed)
node scripts/new-wallet.mjs solana            # or: node scripts/new-wallet.mjs evm

# 2. fund the printed address with USDC (Solana or Base, matching the kind)

# 3. run the paid call with the throwaway wallet
BIQ_SVM_SECRET_KEY_PATH=./throwaway-solana.json node examples/paid-call.mjs brief
```

Only `npm install` + outbound HTTPS to `www.blockchainiq.co` are needed. No
other network access, no config files, no hidden credentials.

## Using the tools with an LLM

```js
import { ChatOpenAI } from "@langchain/openai";
import { toolCalling } from "langchain/experimental/tool_calling";
import { marketBriefTool } from "./src/tools.mjs";

const agent = await toolCalling(new ChatOpenAI({ model: "gpt-4o-mini" }), [marketBriefTool()]);
const res = await agent.invoke({ messages: [["user", "What's happening in crypto right now?"]] });
```

The tools are standard `@langchain/core` `DynamicTool`s (name, description, zod
schema, `func`) — they work with any LangChain tool-calling setup.

## Repo layout

```
src/client.mjs     x402 fetch wrapper: rail selection, key loading, settlement decoding
src/tools.mjs      LangChain tools (biq_market_brief, biq_event_risk)
examples/          runnable demos (standalone paid call, LangChain invocation)
test/free-check.mjs  connectivity smoke test (free endpoints, no payment)
```

## Notes

- Prices live at `https://www.blockchainiq.co/api/x402/v1` (free catalog) — the
  resource set can grow; this repo currently wires `brief` and `event-risk`.
- The free endpoint `GET /api/x402/v1/sample` is useful for testing connectivity
  without paying.
- MIT licensed.
