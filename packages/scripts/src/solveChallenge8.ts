import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import { contractsData } from "../contracts/types";

dotenv.config();

// Run on Optimism network
// Check for --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;

// Local chain account #0 private key
const LOCAL_CHAIN_1ST_ACCOUNT_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// Wallet private key for script execution
const MY_WALLET_PK = isLocal
    ? LOCAL_CHAIN_1ST_ACCOUNT_PK  // Always use hardhat private key for local
    : (process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY as `0x${string}`) || (() => {
      console.error("❌ __RUNTIME_DEPLOYER_PRIVATE_KEY is required for Optimism network");
      console.error("   Please set the private key in packages/scripts/.env file");
      process.exit(1);
      return "" as `0x${string}`;
    })();
const myWalletAccount = privateKeyToAccount(MY_WALLET_PK);

// Wallet client (for sending transactions)
const walletClient = createWalletClient({
  account: myWalletAccount,
  chain: TARGET_CHAIN,
  transport: http(),
});

// Public client (for reading blockchain)
const publicClient = createPublicClient({
  chain: TARGET_CHAIN,
  transport: http(),
});

// Challenge8 address
// @ts-ignore Defined after deployment
const CHALLENGE8_ADDRESS = contractsData[TARGET_CHAIN.id].Challenge8.address as `0x${string}`;

async function solveChallenge8() {
  console.log("🚀 Starting Challenge 8...");
  console.log("");
  console.log("📚 Challenge 8 Mechanism:");
  console.log("   - Unverified contract (no ABI)");
  console.log("   - Identify function selector from bytecode");
  console.log("   - 0x8fd628f0 is possibly mintFlag function");
  console.log("");

  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 Challenge8 address:", CHALLENGE8_ADDRESS);
  console.log("");

  try {
    // First, call nftContract() to check NFT contract address
    console.log("📝 Calling nftContract() to check NFT contract address...");

    const nftContractCall = await publicClient.call({
      to: CHALLENGE8_ADDRESS,
      data: "0xd56d229d", // nftContract() selector
    });

    if (nftContractCall.data) {
      console.log("📊 NFT contract address (encoded):", nftContractCall.data);
    }

    // Call 0x8fd628f0 (mintFlag) - need to pass own address as argument
    console.log("");
    console.log("🎯 Calling 0x8fd628f0 (mintFlag)...");
    console.log("📝 Argument: own address", myWalletAccount.address);

    try {
      // Function selector + padded address (32 bytes)
      // Challenge8 contract verifies argument address matches msg.sender before minting NFT
      const dataWithAddress =
        "0x8fd628f0" + // Function selector (mintFlag)
        "000000000000000000000000" + // Padding (12 bytes)
        myWalletAccount.address.substring(2); // Address (20 bytes)

      const txHash = await walletClient.sendTransaction({
        to: CHALLENGE8_ADDRESS,
        data: dataWithAddress as `0x${string}`,
      });

      console.log("⏳ Transaction:", txHash);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash
      });

      if (receipt.status === "success") {
        console.log("✅ Success!");
        console.log("🚩 NFT Flag #8 minted!");
      } else {
        console.log("❌ Transaction failed");
      }
    } catch (error: any) {
      // Treat as success if already minted
      if (error.message?.includes("User address has already minted for this challenge")) {
        console.log("✅ This address has already obtained Challenge 8 NFT");
        console.log("🎉 Challenge 8 is already complete!");
      } else {
        console.log("❌ Error:", error.message);
      }
    }

    console.log("");
    console.log("🎉 Challenge 8 analysis complete!");
    console.log("");
    console.log("📚 What we learned:");
    console.log("   - How to analyze bytecode");
    console.log("   - Interacting with unverified contracts");
    console.log("   - Identifying and calling function selectors");
    console.log("   - Low-level call execution");

  } catch (error: any) {
    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1);
  }
}

// Display help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 8 - Overflow Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge8.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Use uint8 overflow to reset score to 0");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas");
  console.log("  - Local: yarn chain & yarn deploy executed");
  process.exit(0);
}

// Execute script
solveChallenge8().catch((error) => {
  console.error(error);
  process.exit(1);
});