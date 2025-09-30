import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  parseAbi,
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import { contractsData } from "../contracts/types";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Alternative to __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Challenge6 contract instance
const challenge6Contract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].Challenge6.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].Challenge6.abi,
  client: { public: publicClient, wallet: walletClient },
});

// Challenge6Solution ABI
const SOLUTION_ABI = parseAbi([
  "constructor(address _challenge)",
  "function name() public pure returns (string memory)",
  "function solve() public",
  "function solveWithGas(uint256 gasLimit) public",
  "function challenge() public view returns (address)",
  "function owner() public view returns (address)",
]);

// Load Challenge6Solution bytecode and ABI
async function getSolutionArtifact(): Promise<{ bytecode: string, abi: any }> {
  const artifactPath = path.join(
    __dirname,
    "../../hardhat/artifacts/contracts/Challenge6Solution.sol/Challenge6Solution.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return { bytecode: artifact.bytecode, abi: artifact.abi };
}

async function solveChallenge6() {
  const chainName = isLocal ? "local" : "Optimism";
  console.log(`🚀 Starting Challenge 6 on ${chainName}...`);
  console.log("");
  console.log("📚 Challenge 6 Mechanism:");
  console.log("   - Must be called from Solution contract");
  console.log("   - name() function returns correct name");
  console.log("   - code parameter = count << 8 (count * 256)");
  console.log("   - Gas limit: 190,000～200,000");
  console.log("");

  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 Challenge6 address:", challenge6Contract.address);
  console.log("");

  try {
    // Check with NFTFlags contract (already minted?)
    const nftFlagsContract = getContract({
      // @ts-ignore Defined after deployment
      address: contractsData[TARGET_CHAIN.id].NFTFlags.address,
      // @ts-ignore Defined after deployment
      abi: contractsData[TARGET_CHAIN.id].NFTFlags.abi,
      client: { public: publicClient },
    });

    try {
      const hasMinted = await nftFlagsContract.read.hasMinted([
        myWalletAccount.address,
        6n
      ]);

      if (hasMinted) {
        console.log("✅ This address has already obtained Challenge 6 NFT");
        console.log("🎉 Challenge 6 is already complete!");
        return;
      }
    } catch {
      // Ignore hasMinted check errors
    }
    // Check current count
    const currentCount = await challenge6Contract.read.count();
    console.log("📊 Current count:", currentCount.toString());

    // Calculate code
    const code = currentCount << 8n;
    console.log("📝 Calculated code:", code.toString());

    // Deploy Challenge6Solution contract
    console.log("");
    console.log("🔨 Deploying Solution contract...");

    const solutionArtifact = await getSolutionArtifact();

    // Encode constructor arguments (Challenge6 address)
    const constructorArgs = encodeAbiParameters(
      [{ type: "address" }],
      [challenge6Contract.address]
    );

    // Combine bytecode with constructor arguments
    const deploymentBytecode = solutionArtifact.bytecode + constructorArgs.slice(2);

    // Send deployment transaction
    const deployHash = await walletClient.sendTransaction({
      data: deploymentBytecode as `0x${string}`,
    });

    console.log("⏳ Deploy transaction:", deployHash);
    const deployReceipt = await publicClient.waitForTransactionReceipt({
      hash: deployHash
    });

    if (!deployReceipt.contractAddress) {
      throw new Error("Solution contract deployment failed");
    }

    const solutionAddress = deployReceipt.contractAddress;
    console.log("✅ Solution contract deployed:", solutionAddress);

    // Create Solution contract instance
    const solutionContract = getContract({
      address: solutionAddress,
      abi: solutionArtifact.abi,
      client: { public: publicClient, wallet: walletClient },
    });

    // Verify name() function behavior
    const solutionName = await solutionContract.read.name([]);
    console.log("📝 Solution contract name():", solutionName);

    // Call solve() function to mint flag
    console.log("");
    console.log("🎯 Solving Challenge 6 with precise gas control...");
    console.log("🔬 Identifying accurate gas value with scientific approach");

    // First, identify accurate gas value using measureGasWithLimit function
    console.log("\n📊 Step 1: Identify accurate gas limit with binary search");

    // Challenge6 requires gasleft() in range: 190,000～200,000
    const TARGET_MIN = 190000n;
    const TARGET_MAX = 200000n;
    const TARGET_IDEAL = 195000n; // Target middle value

    // Initial range for binary search
    let searchMin = 190000n;
    let searchMax = 210000n;
    let optimalGasLimit: bigint | null = null;
    let iterations = 0;
    const maxIterations = 20;

    console.log(`Target: gasleft() within ${TARGET_MIN}～${TARGET_MAX} range inside Challenge6`);

    while (iterations < maxIterations && optimalGasLimit === null) {
      const testGasLimit = (searchMin + searchMax) / 2n;
      iterations++;

      try {
        console.log(`\n🧪 Attempt ${iterations}: Testing gas limit ${testGasLimit}...`);

        // Use measureGasWithLimit function to actually call with specified gas limit
        const measureTx = await solutionContract.write.measureGasWithLimit([testGasLimit], {
          gas: 300000n, // Give sufficient gas for outer transaction
        });

        await publicClient.waitForTransactionReceipt({
          hash: measureTx,
        });

        // Get measurement results
        const estimatedGasLeft = await solutionContract.read.lastGasLeft();
        const wasSuccess = await solutionContract.read.success();

        console.log(`   Estimated gasleft(): ${estimatedGasLeft}`);
        console.log(`   Success: ${wasSuccess}`);

        // Check if within target range
        if (estimatedGasLeft >= TARGET_MIN && estimatedGasLeft <= TARGET_MAX) {
          console.log(`   ✅ Perfect! Within target range`);
          optimalGasLimit = testGasLimit;
          break;
        } else if (estimatedGasLeft < TARGET_MIN) {
          console.log(`   ⬆️ Gas too low, increasing`);
          searchMin = testGasLimit + 1n;
        } else {
          console.log(`   ⬇️ Gas too high, decreasing`);
          searchMax = testGasLimit - 1n;
        }

        // Exit if search range inverted
        if (searchMin > searchMax) {
          console.log("   ⚠️ Search range converged");
          // Use last tested value if close
          if (Math.abs(Number(estimatedGasLeft - TARGET_IDEAL)) < 10000) {
            optimalGasLimit = testGasLimit;
          }
          break;
        }
      } catch (error: any) {
        console.log(`   ❌ Measurement error:`, error.message);
        // Adjust range on error
        if (error.message?.includes("out of gas")) {
          searchMin = testGasLimit + 1n;
        } else {
          searchMax = testGasLimit - 1n;
        }
      }
    }

    // If optimal gas limit not found, estimate by calculation
    if (!optimalGasLimit) {
      console.log("\n⚠️ Not found by binary search, estimating by calculation");
      // Calculate backwards so gasleft() becomes 195000 inside Challenge6
      // Consider call overhead about 5000
      optimalGasLimit = TARGET_IDEAL + 5000n;
      console.log(`Estimated value: ${optimalGasLimit}`);
    }

    console.log(`\n📊 Step 2: Execute with identified gas limit ${optimalGasLimit}`);

    // Try identified gas limit and surrounding values (for fine-tuning)
    const finalGasLimits = [
      optimalGasLimit - 1000n,
      optimalGasLimit - 500n,
      optimalGasLimit,
      optimalGasLimit + 500n,
      optimalGasLimit + 1000n,
    ];

    for (const gasLimit of finalGasLimits) {
      try {
        console.log(`\n🎯 Final execution: Calling solveWithGas with gas limit ${gasLimit}...`);

        // Get current nonce
        const txNonce = await publicClient.getTransactionCount({
          address: myWalletAccount.address,
          blockTag: 'pending'
        });

        // Call solveWithGas function (uses assembly internally for precise gas control)
        const solveTx = await solutionContract.write.solveWithGas([gasLimit], {
          gas: 300000n, // Give sufficient gas for outer transaction
          nonce: txNonce,
        });

        console.log("⏳ Transaction:", solveTx);
        const solveReceipt = await publicClient.waitForTransactionReceipt({
          hash: solveTx
        });

        if (solveReceipt.status === "success") {
          console.log("");
          console.log("🎉 Challenge 6 complete! (Deterministic solution)");
          console.log("🚩 NFT Flag #6 minted!");
          console.log("");
          console.log("📚 Solution key points:");
          console.log("   - Precise gas control using assembly");
          console.log("   - Optimal value identification by binary search");
          console.log("   - Deterministic solution not relying on luck");
          console.log(`   - Successful gas limit: ${gasLimit}`);
          console.log(`   - gasleft() inside Challenge6: approximately ${gasLimit - 5000n}`);
          return; // Exit on success
        } else {
          console.log("❌ Transaction failed");
        }
      } catch (innerError: any) {
        // Treat as success if already minted
        if (innerError.message?.includes("User address has already minted for this challenge")) {
          console.log("✅ This address has already obtained Challenge 6 NFT");
          console.log("🎉 Challenge 6 is already complete!");
          return;
        }
        console.log(`❌ Failed with gas limit ${gasLimit}:`, innerError.message);
      }
    }

    // If all attempts failed
    console.log("\n❌ Solution failed. Challenge6 contract may have been modified");
    process.exit(1);

  } catch (error: any) {
    // Treat as success if already minted
    if (error.message?.includes("User address has already minted for this challenge")) {
      console.log("✅ This address has already obtained Challenge 6 NFT");
      console.log("🎉 Challenge 6 is already complete!");
      return;
    }

    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("Wrong gas")) {
      console.log("");
      console.log("💡 Hints:");
      console.log("   - Adjust gas limit");
      console.log("   - Must be within 190,000～200,000 range");
    } else if (error.message?.includes("Wrong code")) {
      console.log("");
      console.log("💡 Hints:");
      console.log("   - Verify code calculation");
      console.log("   - count << 8 (count * 256)");
    } else if (error.message?.includes("Wrong name")) {
      console.log("");
      console.log("💡 Hints:");
      console.log("   - Check name() function return value");
      console.log("   - Must return exactly \"BG CTF Challenge 6 Solution\"");
    } else if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1);
  }
}

// Display help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 6 - Gas Limit Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge6.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Use Solution contract to execute within gas limit");
  console.log("  Try multiple gas limits to succeed");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas");
  console.log("  - Local: yarn chain & yarn deploy executed");
  process.exit(0);
}

// Execute script
solveChallenge6().catch((error) => {
  console.error(error);
  process.exit(1);
});