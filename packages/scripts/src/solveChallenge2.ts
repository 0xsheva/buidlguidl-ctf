import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================
// Configuration
// ========================
// Check --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;

// Challenge address (switch based on chain)
const CHALLENGE2_ADDRESS = isLocal
  ? "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" // Local
  : "0x0b997E0a306c47EEc755Df75fad7F41977C5582d"; // Optimism

// Private key of account #0 on local chain
const LOCAL_CHAIN_1ST_ACCOUNT_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// Select private key (differentiate between local and production)
const MY_WALLET_PK = isLocal
  ? LOCAL_CHAIN_1ST_ACCOUNT_PK  // Always use Hardhat private key for local
  : (process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY as `0x${string}`) || (() => {
      console.error("❌ __RUNTIME_DEPLOYER_PRIVATE_KEY configuration is required for Optimism network");
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

// Challenge2 contract ABI
const CHALLENGE2_ABI = parseAbi([
  "function justCallMe() external",
  "function hasMinted(address) view returns (bool)",
]);

// Use Challenge2Solution (common for local and production)
const artifactPath = path.join(
  __dirname,
  "../../hardhat/artifacts/contracts/Challenge2Solution.sol/Challenge2Solution.json"
);

let SOLVER_CONTRACT_ABI: any;
let SOLVER_BYTECODE: `0x${string}`;

try {
  const solutionArtifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  SOLVER_CONTRACT_ABI = solutionArtifact.abi;
  SOLVER_BYTECODE = solutionArtifact.bytecode as `0x${string}`;
} catch (error) {
  console.error("❌ Challenge2Solution artifact not found");
  console.error("   Please compile with hardhat: yarn compile");
  process.exit(1);
}

async function solveChallenge2() {
  const chainName = isLocal ? "Local" : "Optimism";
  console.log(`🚀 Challenge 2 - msg.sender != tx.origin Challenge`);
  console.log(`🌐 Network: ${chainName}`);
  console.log("📍 Wallet:", myWalletAccount.address);
  console.log("📍 Challenge2:", CHALLENGE2_ADDRESS);
  console.log("");
  console.log("📚 Solution:");
  console.log("   1. justCallMe() requires msg.sender != tx.origin");
  console.log("   2. Cannot call directly from EOA");
  console.log("   3. Must call through a contract");
  console.log("");

  const challenge2Contract = getContract({
    address: CHALLENGE2_ADDRESS,
    abi: CHALLENGE2_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  try {
    // Check with NFTFlags contract (common for local and production)
    try {
      const { contractsData } = await import("../contracts/types");
      const nftFlagsAddress = contractsData[TARGET_CHAIN.id].NFTFlags.address;
      const nftFlagsAbi = parseAbi([
        "function hasMinted(address user, uint256 challengeId) view returns (bool)",
      ]);

      const hasMinted = await publicClient.readContract({
        address: nftFlagsAddress,
        abi: nftFlagsAbi,
        functionName: "hasMinted",
        args: [myWalletAccount.address, 2n],
      });

      if (hasMinted) {
        console.log("✅ This address has already obtained Challenge 2 NFT");
        console.log("🎉 Challenge 2 is already complete!");
        return;
      }
    } catch (error: any) {
      // Continue on error
    }

    // Deploy Solver contract
    console.log("📝 Deploying Solver contract...");

    // Deploy contract
    const tx = await walletClient.deployContract({
      abi: SOLVER_CONTRACT_ABI,
      bytecode: SOLVER_BYTECODE as `0x${string}`,
      args: [CHALLENGE2_ADDRESS],
    });

    console.log("   TX:", tx);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === "success" && receipt.contractAddress) {
      console.log("   ✅ Mining complete - Block:", receipt.blockNumber);
      console.log("   📍 Solver address:", receipt.contractAddress);

      // Call callChallenge() (common for local and production)
      console.log("");
      console.log("📝 Calling callChallenge()...");

      const solverContract = getContract({
        address: receipt.contractAddress as `0x${string}`,
        abi: SOLVER_CONTRACT_ABI,
        client: { public: publicClient, wallet: walletClient },
      });

      try {
        const callTx = await solverContract.write.callChallenge([]);
        console.log("   TX:", callTx);
        const callReceipt = await publicClient.waitForTransactionReceipt({ hash: callTx });

        if (callReceipt.status === "success") {
          console.log("");
          console.log("🎉 Challenge 2 complete!");
          console.log("🚩 NFT Flag #2 has been minted!");
          console.log("📝 Solution: Successfully executed justCallMe() through contract");
        } else {
          console.error("❌ callChallenge() failed");
          process.exit(1);
        }
      } catch (callError: any) {
        // Treat as success if already minted
        if (callError.message?.includes("User address has already minted for this challenge")) {
          console.log("✅ This address has already obtained Challenge 2 NFT");
          console.log("🎉 Challenge 2 is already complete!");
          return;
        }
        throw callError;
      }
    } else {
      console.error("❌ Transaction failed");
      process.exit(1);
    }
  } catch (error: any) {
    // Treat as success if already minted
    if (error.message?.includes("User address has already minted for this challenge")) {
      console.log("✅ This address has already obtained Challenge 2 NFT");
      console.log("🎉 Challenge 2 is already complete!");
      return;
    }

    console.error("❌ Error:", error.message);

    if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1);
  }
}

// Help display
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 2 - msg.sender != tx.origin Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge2.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  justCallMe() function requires msg.sender != tx.origin");
  console.log("  Must call through a contract");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas fees");
  console.log("  - Local: Execute yarn chain & yarn deploy");
  console.log("");
  console.log("Environment variables:");
  console.log("  If __RUNTIME_DEPLOYER_PRIVATE_KEY is not set,");
  console.log("  local chain private key will be used automatically");
  process.exit(0);
}

// Execute script
solveChallenge2().catch((error) => {
  console.error(error);
  process.exit(1);
});