import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  keccak256,
  toHex,
  toRlp,
  toBytes,
  hexToBytes,
  numberToBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import { contractsData } from "../contracts/types";

dotenv.config();

// ========================
// Configuration
// ========================
// Check for --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;
// @ts-ignore Defined after deployment
const CHALLENGE12_ADDRESS = contractsData[TARGET_CHAIN.id].Challenge12.address as `0x${string}`;

// Local chain account #0 private key
const LOCAL_CHAIN_1ST_ACCOUNT_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// Private key selection (local vs production)
const MY_WALLET_PK = isLocal
  ? LOCAL_CHAIN_1ST_ACCOUNT_PK  // Always use hardhat private key for local
  : (process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY as `0x${string}`) || (() => {
      console.error("❌ __RUNTIME_DEPLOYER_PRIVATE_KEY is required for Optimism network");
      console.error("   Please set the private key in packages/scripts/.env file");
      process.exit(1);
      return "" as `0x${string}`;
    })();

const myWalletAccount = privateKeyToAccount(MY_WALLET_PK);

// Clients
const walletClient = createWalletClient({
  account: myWalletAccount,
  chain: TARGET_CHAIN,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: TARGET_CHAIN,
  transport: http(),
});

// Challenge12 contract ABI
const CHALLENGE12_ABI = [
  {
    "inputs": [],
    "name": "preMintFlag",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes", "name": "_headerRlpBytes", "type": "bytes"}],
    "name": "mintFlag",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "blockNumber",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

/**
 * Helper: Convert to bytes with proper handling
 */
function toFieldBytes(value: any): Uint8Array {
  if (value === undefined || value === null) {
    throw new Error("Undefined value passed to toFieldBytes");
  }

  // If numeric
  if (typeof value === 'bigint' || typeof value === 'number') {
    const bigintValue = BigInt(value);
    if (bigintValue === 0n) {
      // In RLP, 0 is treated as an empty byte array
      return new Uint8Array([]);
    }
    // Negative values not supported
    if (bigintValue < 0n) {
      throw new Error("Negative values not supported");
    }
    // Represent with minimal bytes
    const hex = bigintValue.toString(16);
    const padded = hex.length % 2 === 0 ? hex : '0' + hex;
    return hexToBytes(('0x' + padded) as `0x${string}`);
  }

  // If string
  if (typeof value === 'string') {
    // Empty string or 0x0 case
    if (value === '' || value === '0x' || value === '0x0' || value === '0x00') {
      return new Uint8Array([]);
    }
    // Hex string
    if (value.startsWith('0x')) {
      return hexToBytes(value as `0x${string}`);
    }
    // Regular string (UTF-8)
    return new TextEncoder().encode(value);
  }

  // If Uint8Array, return as is
  if (value instanceof Uint8Array) {
    return value;
  }

  // Otherwise use viem's toBytes function
  return toBytes(value);
}

/**
 * Helper: Convert nonce to exactly 8 bytes
 */
function toNonceBytes(nonce: string | undefined): Uint8Array {
  if (!nonce || nonce === "0x0000000000000000") {
    return hexToBytes("0x0000000000000000");
  }

  const bytes = hexToBytes(nonce as `0x${string}`);
  if (bytes.length === 8) {
    return bytes;
  }

  const result = new Uint8Array(8);
  if (bytes.length < 8) {
    result.set(bytes, 8 - bytes.length);
  } else {
    result.set(bytes.slice(0, 8));
  }

  return result;
}

/**
 * Try RLP combinations via bruteforce
 */
async function bruteforceRLP(blockNumber: bigint): Promise<`0x${string}` | null> {
  const block = await publicClient.getBlock({
    blockNumber: blockNumber,
    includeTransactions: false,
  });

  if (!block) {
    throw new Error(`Block ${blockNumber} not found`);
  }

  const anyBlock = block as any;
  const targetHash = block.hash;

  console.log("🎯 Target block:", blockNumber);
  console.log("   Hash:", targetHash);
  console.log("\n📊 Block fields:");

  // Debug: Display all block fields
  console.log("   parentHash:", block.parentHash);
  console.log("   sha3Uncles:", anyBlock.sha3Uncles ?? "not present");
  console.log("   miner/coinbase:", anyBlock.miner ?? anyBlock.coinbase ?? "not present");
  console.log("   stateRoot:", block.stateRoot);
  console.log("   transactionsRoot:", block.transactionsRoot);
  console.log("   receiptsRoot:", block.receiptsRoot);
  console.log("   logsBloom:", anyBlock.logsBloom ? "present" : "not present");
  console.log("   difficulty:", anyBlock.difficulty ?? "0");
  console.log("   number:", block.number);
  console.log("   gasLimit:", block.gasLimit);
  console.log("   gasUsed:", block.gasUsed);
  console.log("   timestamp:", block.timestamp);
  console.log("   extraData:", anyBlock.extraData ?? "0x");
  console.log("   mixHash:", anyBlock.mixHash ?? "not present");
  console.log("   nonce:", anyBlock.nonce ?? "not present");

  console.log("\n📊 Optional fields:");
  const optionalFields = {
    baseFeePerGas: anyBlock.baseFeePerGas,
    withdrawalsRoot: anyBlock.withdrawalsRoot,
    blobGasUsed: anyBlock.blobGasUsed,
    excessBlobGas: anyBlock.excessBlobGas,
    parentBeaconBlockRoot: anyBlock.parentBeaconBlockRoot,
    requestsHash: anyBlock.requestsHash,
  };

  Object.entries(optionalFields).forEach(([key, value]) => {
    console.log(`   ${key}: ${value !== undefined ? `✅ present (${value})` : '❌ absent'}`);
  });

  // Process logsBloom
  let logsBloom = anyBlock.logsBloom as string;
  if (logsBloom) {
    logsBloom = logsBloom.replace(/\s+/g, '');
    const bloomBytes = hexToBytes(logsBloom as `0x${string}`);
    if (bloomBytes.length !== 256) {
      throw new Error(`Invalid logsBloom length: ${bloomBytes.length}, expected 256`);
    }
  }

  // Base fields (always included)
  const baseFields = [
    toFieldBytes(block.parentHash),
    toFieldBytes(anyBlock.sha3Uncles ?? "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347"),
    toFieldBytes(anyBlock.miner ?? anyBlock.coinbase ?? "0x4200000000000000000000000000000000000011"),
    toFieldBytes(block.stateRoot),
    toFieldBytes(block.transactionsRoot),
    toFieldBytes(block.receiptsRoot),
    toFieldBytes(logsBloom),
    toFieldBytes(anyBlock.difficulty ?? 0n),
    toFieldBytes(block.number),
    toFieldBytes(block.gasLimit),
    toFieldBytes(block.gasUsed),
    toFieldBytes(block.timestamp),
    toFieldBytes(anyBlock.extraData ?? "0x"),
    toFieldBytes(anyBlock.mixHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000"),
    toNonceBytes(anyBlock.nonce ?? "0x0000000000000000"),
  ];

  // For Optimism, EIP-1559 fields may be required
  // Try combinations with baseFeePerGas first
  const availableOptionalFields: Array<{ name: string, value: any }> = [];

  if (optionalFields.baseFeePerGas !== undefined) {
    availableOptionalFields.push({ name: "baseFeePerGas", value: optionalFields.baseFeePerGas });
  }
  if (optionalFields.withdrawalsRoot !== undefined) {
    availableOptionalFields.push({ name: "withdrawalsRoot", value: optionalFields.withdrawalsRoot });
  }
  if (optionalFields.blobGasUsed !== undefined) {
    availableOptionalFields.push({ name: "blobGasUsed", value: optionalFields.blobGasUsed });
  }
  if (optionalFields.excessBlobGas !== undefined) {
    availableOptionalFields.push({ name: "excessBlobGas", value: optionalFields.excessBlobGas });
  }
  if (optionalFields.parentBeaconBlockRoot !== undefined) {
    availableOptionalFields.push({ name: "parentBeaconBlockRoot", value: optionalFields.parentBeaconBlockRoot });
  }
  if (optionalFields.requestsHash !== undefined) {
    availableOptionalFields.push({ name: "requestsHash", value: optionalFields.requestsHash });
  }

  const totalCombinations = Math.pow(2, availableOptionalFields.length);
  console.log(`\n🔍 Testing ${totalCombinations} combinations with ${availableOptionalFields.length} optional fields...`);
  console.log("   Available fields:", availableOptionalFields.map(f => f.name).join(", "));

  // Try specific combinations first (common patterns for Optimism)
  const priorityMasks: number[] = [];

  // baseFeePerGas only (most common for Optimism)
  if (availableOptionalFields.some(f => f.name === "baseFeePerGas")) {
    const baseFeeIndex = availableOptionalFields.findIndex(f => f.name === "baseFeePerGas");
    priorityMasks.push(1 << baseFeeIndex);
  }

  // All fields
  if (totalCombinations > 1) {
    priorityMasks.push(totalCombinations - 1);
  }

  // Try priority combinations first
  for (const mask of priorityMasks) {
    const headerList = [...baseFields];
    const included: string[] = [];

    for (let i = 0; i < availableOptionalFields.length; i++) {
      if (mask & (1 << i)) {
        headerList.push(toFieldBytes(availableOptionalFields[i].value));
        included.push(availableOptionalFields[i].name);
      }
    }

    const rlpBytes = toRlp(headerList);
    const calculatedHash = keccak256(rlpBytes);

    console.log(`   Testing priority mask ${mask}: ${included.join(", ") || "none"}`);

    if (calculatedHash.toLowerCase() === targetHash?.toLowerCase()) {
      console.log(`\n✅ Found matching combination! (priority mask: ${mask})`);
      console.log("   Included fields:", included.length > 0 ? included.join(", ") : "none");
      console.log("   RLP bytes:", rlpBytes);
      console.log("   RLP length:", (rlpBytes.length - 2) / 2, "bytes");
      return rlpBytes;
    }
  }

  // Try remaining combinations
  for (let mask = 0; mask < totalCombinations; mask++) {
    if (priorityMasks.includes(mask)) continue; // Skip already tested combinations

    const headerList = [...baseFields];
    const included: string[] = [];

    for (let i = 0; i < availableOptionalFields.length; i++) {
      if (mask & (1 << i)) {
        headerList.push(toFieldBytes(availableOptionalFields[i].value));
        included.push(availableOptionalFields[i].name);
      }
    }

    const rlpBytes = toRlp(headerList);
    const calculatedHash = keccak256(rlpBytes);

    if (mask % 10 === 0) {
      console.log(`   Testing mask ${mask}/${totalCombinations}...`);
    }

    if (calculatedHash.toLowerCase() === targetHash?.toLowerCase()) {
      console.log(`\n✅ Found matching combination! (mask: ${mask})`);
      console.log("   Included fields:", included.length > 0 ? included.join(", ") : "none");
      console.log("   RLP bytes:", rlpBytes);
      console.log("   RLP length:", (rlpBytes.length - 2) / 2, "bytes");
      return rlpBytes;
    }
  }

  console.log("\n❌ No matching combination found");
  console.log("   Tried all", totalCombinations, "combinations");
  return null;
}

/**
 * Step 1: Execute preMintFlag
 */
async function executePreMint(): Promise<bigint> {
  console.log("📝 Step 1: Execute preMintFlag()");

  const challenge12Contract = getContract({
    address: CHALLENGE12_ADDRESS,
    abi: CHALLENGE12_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  const currentBlock = await publicClient.getBlockNumber();
  console.log("   Current block:", currentBlock);

  const tx = await challenge12Contract.write.preMintFlag();
  console.log("   TX:", tx);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

  if (receipt.status !== "success") {
    throw new Error("preMintFlag failed");
  }

  console.log("   ✅ Mining complete - Block:", receipt.blockNumber);

  const recordedBlock = await challenge12Contract.read.blockNumber([myWalletAccount.address]);
  console.log("   Recorded block:", recordedBlock);

  return recordedBlock;
}

/**
 * Step 2: Execute mintFlag
 */
async function executeMint(preMintBlock: bigint) {
  console.log("\n📝 Step 2: Execute mintFlag()");

  const targetBlock = preMintBlock + 2n;
  console.log("   Target block:", targetBlock);

  const challenge12Contract = getContract({
    address: CHALLENGE12_ADDRESS,
    abi: CHALLENGE12_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  // Wait for target block
  let currentBlock = await publicClient.getBlockNumber();
  console.log("   Current block:", currentBlock);

  if (currentBlock > preMintBlock + 256n) {
    throw new Error("256 block deadline exceeded");
  }

  if (currentBlock < targetBlock) {
    console.log("   ⏳ Waiting for block", targetBlock, "...");

    // In local environment, we need to mine blocks
    if (isLocal) {
      // Mine blocks in hardhat
      const blocksToMine = Number(targetBlock - currentBlock);
      console.log(`   ⛏️ Local environment: Mining ${blocksToMine} blocks...`);

      // Use Hardhat RPC method to mine blocks
      for (let i = 0; i < blocksToMine; i++) {
        await publicClient.request({
          method: "evm_mine",
        } as any);
      }

      // Check block number
      currentBlock = await publicClient.getBlockNumber();
      console.log("   ✅ Mining complete - Current block:", currentBlock);
    } else {
      // In production, wait for blocks to be mined automatically
      console.log("   ⏳ Waiting for block generation (Optimism ~2 sec/block)...");

      while (currentBlock < targetBlock) {
        // Average block time on Optimism is 2 seconds
        const blocksToWait = Number(targetBlock - currentBlock);
        const estimatedWaitTime = blocksToWait * 2000; // 2 sec/block

        console.log(`      Remaining ${blocksToWait} blocks (~${estimatedWaitTime / 1000} seconds)`);

        // Wait for block arrival using Promise
        await new Promise<void>((resolve) => {
          const unwatch = publicClient.watchBlockNumber({
            onBlockNumber: (blockNumber) => {
              currentBlock = blockNumber;
              console.log(`      New block: ${blockNumber}`);
              if (blockNumber >= targetBlock) {
                unwatch();
                resolve();
              }
            },
            emitOnBegin: false,
            poll: true,
            pollingInterval: 2000, // Poll every 2 seconds
          });
        });
      }
    }
  }

  // Find RLP via bruteforce
  console.log("\n🔧 Bruteforce RLP search...");
  const rlpBytes = await bruteforceRLP(targetBlock);

  if (!rlpBytes) {
    throw new Error("Could not find correct RLP combination");
  }

  // In local environment, mine additional block for blockhash to work
  if (isLocal) {
    console.log("\n⛏️ Mining additional block for blockhash verification...");
    await publicClient.request({
      method: "evm_mine",
    } as any);
    const afterMineBlock = await publicClient.getBlockNumber();
    console.log("   Current block:", afterMineBlock);
  }

  // Execute mintFlag
  console.log("\n🎯 Execute mintFlag()...");

  try {
    await publicClient.simulateContract({
      address: CHALLENGE12_ADDRESS,
      abi: CHALLENGE12_ABI,
      functionName: 'mintFlag',
      args: [rlpBytes],
      account: myWalletAccount,
    });
    console.log("   ✅ Pre-check successful");
  } catch (error: any) {
    // If already minted, treat as success
    if (error.message?.includes("User address has already minted for this challenge")) {
      console.log("✅ This address has already minted the NFT for Challenge 12");
      console.log("🎉 Challenge 12 is already complete!");
      return;
    }
    throw new Error(`Pre-check failed: ${error.message}`);
  }

  const tx = await challenge12Contract.write.mintFlag([rlpBytes]);
  console.log("   TX:", tx);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

  if (receipt.status !== "success") {
    throw new Error("mintFlag failed");
  }

  console.log("   ✅ Mining complete - Block:", receipt.blockNumber);
}

async function solveChallenge12() {
  console.log("🚀 Challenge 12 - RLP Verification Challenge");
  console.log("📍 Wallet:", myWalletAccount.address);
  console.log("📍 Challenge12:", CHALLENGE12_ADDRESS);
  console.log("");
  console.log("📚 Solution:");
  console.log("   1. Record block number with preMintFlag()");
  console.log("   2. Bruteforce RLP search for block 2 blocks later");
  console.log("   3. Execute mintFlag() with correct combination");
  console.log("");

  try {
    const challenge12Contract = getContract({
      address: CHALLENGE12_ADDRESS,
      abi: CHALLENGE12_ABI,
      client: { public: publicClient, wallet: walletClient },
    });

    // Check existing preMint block
    let preMintBlock = await challenge12Contract.read.blockNumber([myWalletAccount.address]);

    if (preMintBlock === 0n) {
      // Execute preMint
      preMintBlock = await executePreMint();
    } else {
      console.log("📝 Existing preMint block:", preMintBlock);

      const currentBlock = await publicClient.getBlockNumber();
      if (currentBlock > preMintBlock + 256n) {
        console.log("   ⚠️ 256 block deadline expired, re-executing");
        preMintBlock = await executePreMint();
      }
    }

    // Execute mint
    await executeMint(preMintBlock);

    console.log("\n🎉 Challenge 12 complete!");
    console.log("🚩 NFT Flag #12 minted!");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Help display
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 12 - RLP Verification Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge12.ts");
  console.log("");
  console.log("Description:");
  console.log("  Works without debug_getRawHeader");
  console.log("  Tries all 64 combinations to discover correct RLP");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - ETH for gas on Optimism");
  process.exit(0);
}

// Execute script
solveChallenge12().catch((error) => {
  console.error(error);
  process.exit(1);
});