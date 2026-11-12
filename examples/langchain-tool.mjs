#!/usr/bin/env node
/**
 * LangChain usage: invoke the biq_market_brief tool directly (no LLM key
 * needed for this demo). The tool settles a $0.01 USDC x402 payment on its
 * first call and returns the market brief.
 *
 * To use it with an LLM, add it to your chain/agent the usual way:
 *
 *   import { ChatOpenAI } from "@langchain/openai";
 *   import { toolCalling } from "langchain/experimental/tool_calling";
 *   const model = ChatOpenAI({ model: "gpt-4o-mini" });
 *   const agent = await toolCalling(model, [marketBriefTool()]);
 *   await agent.invoke({ messages: [["user", "What's happening in crypto right now?"]] });
 */
import { marketBriefTool, eventRiskTool } from '../src/tools.mjs';

const tool = marketBriefTool();
console.log('tool name:      ', tool.name);
console.log('tool description:', tool.description);
console.log('tool schema:    ', JSON.stringify(tool.schema.shape ? Object.keys(tool.schema.shape) : null));
console.log('\ninvoking tool (pays $0.01 USDC via x402)...\n');

const out = await tool.invoke({});
console.log(out.slice(0, 1200));

// also show the second tool builds cleanly (not invoked, to avoid extra cost)
const er = eventRiskTool();
console.log(`\n(event-risk tool available as "${er.name}", $0.05 USDC per call — not invoked here)`);
