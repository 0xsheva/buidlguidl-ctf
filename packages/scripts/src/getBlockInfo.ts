import { createPublicClient, http } from 'viem';
import * as chains from 'viem/chains';

async function main() {
  const publicClient = createPublicClient({
    chain: chains.optimism,
    transport: http(),
  });

  const targetBlock = 141752327n;
  const block = await publicClient.getBlock({
    blockNumber: targetBlock,
    includeTransactions: false,
  });

  console.log(JSON.stringify(block, (key, value) =>
    typeof value === 'bigint' ? '0x' + value.toString(16) : value, 2));
}

main().catch(console.error);