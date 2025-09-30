import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  toHex,
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

// Challenge9 contract instance
const challenge9Contract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].Challenge9.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].Challenge9.abi,
  client: { public: publicClient, wallet: walletClient },
});

async function solveChallenge9() {
  console.log("🚀 Starting Challenge 9...");
  console.log("");
  console.log("📚 Challenge 9 Mechanism:");
  console.log("   - Password is a private variable (but readable from storage)");
  console.log("   - Requires password masked with bit operations");
  console.log("   - mask = ~(bytes32(uint256(0xFF) << ((31 - (count % 32)) * 8)))");
  console.log("   - newPassword = password & mask");
  console.log("");

  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 Challenge9 address:", challenge9Contract.address);
  console.log("");

  try {
    // Create NFTFlags contract instance
    const nftFlagsContract = getContract({
      // @ts-ignore Defined after deployment
      address: contractsData[TARGET_CHAIN.id].NFTFlags.address,
      // @ts-ignore Defined after deployment
      abi: contractsData[TARGET_CHAIN.id].NFTFlags.abi,
      client: { public: publicClient },
    });

    // Check if Challenge 9 is already completed
    const hasChallenge9Already = await nftFlagsContract.read.hasMinted([
      myWalletAccount.address,
      9n
    ]);

    if (hasChallenge9Already) {
      console.log("✅ Challenge 9 is already completed");
      console.log("🎉 You own NFT Flag #9");
      const balance = await nftFlagsContract.read.balanceOf([myWalletAccount.address]);
      console.log(`📊 Current NFT count: ${balance}/12`);
      return; // Exit as success
    }

    // Read original password from storage
    // slot 1: password (slot 0 is nftContract)
    console.log("📖 Reading password from storage...");

    const passwordSlot = await publicClient.getStorageAt({
      address: challenge9Contract.address as `0x${string}`,
      slot: toHex(1, { size: 32 }), // slot 1
    });

    console.log("🔒 Original password (bytes32):", passwordSlot);

    // Read count from storage
    // slot 2: count
    console.log("📖 Getting latest count value...");
    const countSlot = await publicClient.getStorageAt({
      address: challenge9Contract.address as `0x${string}`,
      slot: toHex(2, { size: 32 }), // slot 2
    });

    const count = BigInt(countSlot!);
    console.log("🔢 Current count:", count.toString());
    console.log("   (May have changed due to other users' executions)");

    // Calculate mask
    const shiftBits = (31n - (count % 32n)) * 8n;
    console.log("📐 Shift bits:", shiftBits.toString());

    // Bit operations in JavaScript
    // Left shift 0xFF
    const ffShifted = BigInt(0xFF) << shiftBits;
    console.log("📊 0xFF << " + shiftBits + " =", "0x" + ffShifted.toString(16).padStart(64, "0"));

    // NOT mask (bit inversion)
    const mask = ~ffShifted;
    // Limit to 32 bytes (256 bits) mask
    const mask32Bytes = mask & ((1n << 256n) - 1n);
    console.log("🎭 Mask:", "0x" + mask32Bytes.toString(16).padStart(64, "0"));

    // Apply mask to password
    const originalPassword = BigInt(passwordSlot!);
    const maskedPassword = originalPassword & mask32Bytes;
    console.log("🔑 Masked password:", "0x" + maskedPassword.toString(16).padStart(64, "0"));

    // Call mintFlag
    console.log("");
    console.log("🎯 Calling mintFlag()...");

    // Send as bytes32
    const maskedPasswordBytes32 = "0x" + maskedPassword.toString(16).padStart(64, "0");

    try {
      const mintTx = await challenge9Contract.write.mintFlag([
        maskedPasswordBytes32 as `0x${string}`
      ]);

      console.log("⏳ Transaction:", mintTx);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: mintTx
      });

      if (receipt.status === "success") {
        console.log("✅ Transaction successful");

        // Wait briefly (for block confirmation)
        console.log("⏳ Waiting for block confirmation...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if Challenge 9 NFT was actually minted
        const hasChallenge9Now = await nftFlagsContract.read.hasMinted([
          myWalletAccount.address,
          9n
        ]);

        if (hasChallenge9Now) {
          console.log("✅ Challenge 9 NFT flag minted!");

          // Check new NFT count
          const newNftCount = await nftFlagsContract.read.balanceOf([myWalletAccount.address]);
          console.log(`📊 Current NFT count: ${newNftCount}`);

          console.log("");
          console.log("🎉 Challenge 9 complete!");
          console.log("");
          console.log("📚 What we learned:");
          console.log("   - Reading storage (private variables can be read)");
          console.log("   - Bit operations (shift, NOT, AND)");
          console.log("   - Understanding mask processing");
          console.log("   - Dangers of private variables");
        } else {
          console.log("❌ Challenge 9 NFT was not minted");
          console.log("   Transaction succeeded but NFT flag was not obtained");
          console.log("   Count value may have changed");
          console.log("");
          console.log("💡 Please retry:");
          console.log("   npx tsx src/solveChallenge9.ts");
          process.exit(1);
        }
      } else {
        console.log("❌ mintFlag failed");
        process.exit(1);
      }
    } catch (mintError: any) {
      // Treat as success if already minted
      if (mintError.message?.includes("User address has already minted for this challenge")) {
        console.log("✅ This address has already obtained Challenge 9 NFT");
        console.log("🎉 Challenge 9 is already complete!");
      } else {
        throw mintError;
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("Wrong password")) {
      console.log("");
      console.log("💡 Hints:");
      console.log("   - Check mask calculation");
      console.log("   - Re-check count value");
      console.log("   - Pay attention to bit operation order");
    } else if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1);
  }
}

// Display help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 9 - Balance Overflow Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge9.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Overflow balance to mint flag");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas");
  console.log("  - Local: yarn chain & yarn deploy executed");
  process.exit(0);
}

// Execute script
solveChallenge9().catch((error) => {
  console.error(error);
  process.exit(1);
});