import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

// ========================
// Configuration
// ========================
// Check --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;

// Challenge address (switch based on chain)
const CHALLENGE1_ADDRESS = isLocal
  ? "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" // Local
  : "0xfa2Aad507B1Fa963A1fd6F8a491A7088Cd4538A5"; // Optimism

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

// Challenge1 contract ABI
const CHALLENGE1_ABI = [
  {
    "inputs": [{"internalType": "string", "name": "builderName", "type": "string"}],
    "name": "registerMe",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "builderNames",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

async function main() {
  console.log("🚀 Challenge 1 - Name Registration Challenge");
  console.log("🌐 Network:", isLocal ? "Local (31337)" : "Optimism");
  console.log("📍 Wallet:", myWalletAccount.address);
  console.log("📍 Challenge1:", CHALLENGE1_ADDRESS);
  console.log("");
  console.log("📚 Solution:");
  console.log("   Register by passing a name to registerMe() function");
  console.log("");

  const challenge1Contract = getContract({
    address: CHALLENGE1_ADDRESS,
    abi: CHALLENGE1_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  try {
    // Check if already registered
    const currentName = await challenge1Contract.read.builderNames([myWalletAccount.address]);

    if (currentName && currentName !== "") {
      console.log("✅ Already registered");
      console.log("📝 Registered name:", currentName);
      console.log("🎉 Challenge 1 is already complete!");
      return;
    }

    // Call registerMe function
    console.log("📝 Executing registerMe()...");
    const builderName = "BuidlGuidl_CTF_Player";
    console.log("   Name:", builderName);

    const tx = await challenge1Contract.write.registerMe([builderName]);
    console.log("   TX:", tx);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status === "success") {
      console.log("   ✅ Mining complete - Block:", receipt.blockNumber);

      // Verify registered name
      const registeredName = await challenge1Contract.read.builderNames([myWalletAccount.address]);
      console.log("");
      console.log("🎉 Challenge 1 complete!");
      console.log("📝 Registered name:", registeredName);
      console.log("🚩 NFT Flag #1 has been minted!");
    } else {
      console.error("❌ Transaction failed");
      process.exit(1);
    }
  } catch (error: any) {
    // Treat as success if already minted
    if (error.message?.includes("User address has already minted for this challenge") ||
        error.message?.includes("already registered")) {
      console.log("✅ This address has already obtained Challenge 1 NFT");
      console.log("🎉 Challenge 1 is already complete!");
      return;
    }

    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Help display
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 1 - Name Registration Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge1.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Simple challenge to register by passing a name to registerMe() function");
  console.log("");
  console.log("Requirements:");
  console.log("  - Optimism: ETH for gas fees");
  console.log("  - Local: Execute yarn chain & yarn deploy");
  console.log("");
  console.log("Environment variables:");
  console.log("  If __RUNTIME_DEPLOYER_PRIVATE_KEY is not set,");
  console.log("  local chain private key will be used automatically");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});