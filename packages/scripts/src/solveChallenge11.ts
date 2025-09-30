import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  keccak256,
  getAddress,
  concat,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import { contractsData } from "../contracts/types";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================
// Configuration
// ========================
// Check for --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;
// @ts-ignore Defined after deployment
const CHALLENGE11_ADDRESS = contractsData[TARGET_CHAIN.id].Challenge11.address as `0x${string}`;

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

// Load compiled bytecode
const callerArtifact = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../hardhat/artifacts/contracts/C11Caller.sol/C11Caller.json"),
    "utf8"
  )
);

const factoryArtifact = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../hardhat/artifacts/contracts/C11Factory.sol/C11Factory.json"),
    "utf8"
  )
);

const CALLER_BYTECODE = callerArtifact.bytecode as `0x${string}`;
const FACTORY_BYTECODE = factoryArtifact.bytecode as `0x${string}`;

/**
 * Calculate CREATE2 address
 */
function create2Addr(factory: `0x${string}`, salt: `0x${string}`, initCodeHash: `0x${string}`): `0x${string}` {
  const data = concat(["0xff", factory, salt, initCodeHash]);
  return getAddress(`0x${keccak256(data).slice(26)}`);
}

async function solveChallenge11() {

  // Create clients
  const walletClient = createWalletClient({
    account: myWalletAccount,
    chain: TARGET_CHAIN,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: TARGET_CHAIN,
    transport: http(),
  });

  // NFTFlags contract
  const nftFlagsContract = getContract({
    // @ts-ignore Defined after deployment
    address: contractsData[TARGET_CHAIN.id].NFTFlags.address,
    // @ts-ignore Defined after deployment
    abi: contractsData[TARGET_CHAIN.id].NFTFlags.abi,
    client: { public: publicClient },
  });

  console.log("🚀 Challenge 11 - CREATE2 Solution (Safe Version)");
  console.log("📍 Wallet:", myWalletAccount.address);
  console.log("📍 Challenge11:", CHALLENGE11_ADDRESS);
  // Never display private key
  console.log("");

  try {
    // Check if Challenge 1 is completed
    try {
      const hasChallenge1 = await nftFlagsContract.read.hasMinted([
        myWalletAccount.address,
        1n
      ]);
      if (!hasChallenge1) {
        console.log("⚠️ This address has not completed Challenge 1");
        console.log("   Please complete Challenge 1 first");
        return;
      }
    } catch (error: any) {
      if (error.message?.includes("User address is not registered")) {
        console.log("❌ This address is not registered");
        console.log("   Please complete Challenge 1 first");
        return;
      }
    }

    // Check if already solved
    const hasMinted = await nftFlagsContract.read.hasMinted([
      myWalletAccount.address,
      11n
    ]);

    if (hasMinted) {
      console.log("✅ This address has already completed Challenge 11");
      return;
    }

    console.log("📚 Solution mechanism:");
    console.log("   1. msg.sender != tx.origin (must be via contract)");
    console.log("   2. (lastByte(msg.sender) & 0x15) == (lastByte(tx.origin) & 0x15)");
    console.log("");

    // 1) Deploy Factory
    console.log("🏗️ Deploying Factory contract...");
    const factoryDeployTx = await walletClient.deployContract({
      abi: factoryArtifact.abi,
      bytecode: FACTORY_BYTECODE,
      args: [], // Factory contract has no arguments
    });

    console.log("⏳ TX:", factoryDeployTx);
    const factoryReceipt = await publicClient.waitForTransactionReceipt({
      hash: factoryDeployTx
    });

    if (!factoryReceipt.contractAddress) {
      throw new Error("Factory deployment failed");
    }

    const factoryAddress = factoryReceipt.contractAddress as `0x${string}`;
    console.log("✅ Factory: ", factoryAddress);
    console.log("");

    const factoryContract = getContract({
      address: factoryAddress,
      abi: factoryArtifact.abi,
      client: { public: publicClient, wallet: walletClient },
    });

    // 2) Search for address satisfying conditions with CREATE2
    console.log("🔍 Searching for address satisfying conditions...");
    const mask = 0x15;
    const wantBits = parseInt(myWalletAccount.address.slice(-2), 16) & mask;
    console.log(`   EOA: ${myWalletAccount.address}`);
    console.log(`   EOA last byte: 0x${myWalletAccount.address.slice(-2)}`);
    console.log(`   Required bits: 0x${wantBits.toString(16).padStart(2, '0')}`);

    const initCodeHash = keccak256(CALLER_BYTECODE);
    let foundSalt: `0x${string}` | undefined;
    let foundAddr: `0x${string}` | undefined;

    for (let i = 0; i < 1_000_000; i++) {
      const salt = toHex(i, { size: 32 }) as `0x${string}`;
      const addr = create2Addr(factoryAddress, salt, initCodeHash);
      const addrBits = parseInt(addr.slice(-2), 16) & mask;

      if (addrBits === wantBits) {
        foundSalt = salt;
        foundAddr = addr;
        console.log(`✅ Found!`);
        console.log(`   salt: ${i}`);
        console.log(`   Address: ${addr}`);
        console.log(`   Last byte: 0x${addr.slice(-2)}`);
        console.log(`   Bits: 0x${addrBits.toString(16).padStart(2, '0')}`);
        break;
      }

      if (i % 50000 === 0 && i > 0) {
        console.log(`   Searching... ${i}`);
      }
    }

    if (!foundSalt || !foundAddr) {
      throw new Error("Could not find address satisfying conditions");
    }

    console.log("");

    // 3) Deploy Caller
    console.log("🎯 Deploying Caller...");
    const deployTx = await factoryContract.write.deploy([
      foundSalt,
      CALLER_BYTECODE
    ]);

    console.log("⏳ TX:", deployTx);
    const deployReceipt = await publicClient.waitForTransactionReceipt({
      hash: deployTx
    });

    if (deployReceipt.status !== "success") {
      throw new Error("Caller deployment failed");
    }

    console.log("✅ Caller: ", foundAddr);
    console.log("");

    // 4) Execute mintFlag
    console.log("🚀 Executing mintFlag()...");
    const callerContract = getContract({
      address: foundAddr,
      abi: callerArtifact.abi,
      client: { public: publicClient, wallet: walletClient },
    });

    const runTx = await callerContract.write.run([CHALLENGE11_ADDRESS]);
    console.log("⏳ TX:", runTx);

    const runReceipt = await publicClient.waitForTransactionReceipt({
      hash: runTx
    });

    if (runReceipt.status === "success") {
      // Check flag
      const hasMintedAfter = await nftFlagsContract.read.hasMinted([
        myWalletAccount.address,
        11n
      ]);

      if (hasMintedAfter) {
        console.log("");
        console.log("🎉 Challenge 11 complete!");
        console.log("🚩 NFT Flag #11 minted!");
        console.log("");

        // Display NFT balance
        const balance = await nftFlagsContract.read.balanceOf([myWalletAccount.address]);
        console.log(`📊 Current NFT balance: ${balance}`);
      } else {
        console.log("⚠️ Transaction succeeded but flag was not minted");
      }
    } else {
      console.log("❌ Transaction failed");
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message?.substring(0, 200) || error);
  }
}

// Display usage
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 11 CREATE2 Solution (Safe Version)");
  console.log("");
  console.log("Usage:");
  console.log("  1. Set private key in .env file:");
  console.log("     __RUNTIME_DEPLOYER_PRIVATE_KEY=0x...");
  console.log("");
  console.log("  2. Run the script:");
  console.log("     npx tsx src/solveChallenge11.ts");
  console.log("");
  console.log("⚠️ Security Notes:");
  console.log("  - Do not include private key in command line arguments");
  console.log("  - Ensure .env file is included in .gitignore");
  console.log("  - Be careful not to leave private key in logs or history");
  console.log("");
  console.log("Requirements:");
  console.log("  - The specified address must have completed Challenge 1");
  console.log("  - ETH for gas on Optimism network is required");
  process.exit(0);
}

// Execute script
solveChallenge11().catch(console.error);