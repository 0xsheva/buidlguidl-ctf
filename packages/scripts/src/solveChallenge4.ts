import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  encodeAbiParameters,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import * as dotenv from "dotenv";
import { contractsData } from "../contracts/types";

dotenv.config();

// Execute on Optimism network
// Check --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Chain selection
const TARGET_CHAIN = isLocal ? chains.hardhat : chains.optimism;

// Private key of account #0 on local chain
const LOCAL_CHAIN_1ST_ACCOUNT_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// Hardhat's default mnemonic
const HARDHAT_MNEMONIC =
  "test test test test test test test test test test test junk";

// Private key for script execution
const MY_WALLET_PK = isLocal
    ? LOCAL_CHAIN_1ST_ACCOUNT_PK  // Use Hardhat private key for local
    : (process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY as `0x${string}`) || (() => {
      console.error("❌ __RUNTIME_DEPLOYER_PRIVATE_KEY configuration is required for Optimism network");
      console.error("   Please set private key in packages/scripts/.env file");
      process.exit(1);
      return "" as `0x${string}`;
    })();
const myWalletAccount = privateKeyToAccount(MY_WALLET_PK);

// Generate minter account (Hardhat account #12)
// This account is added as minter in deploy script
// Note: Deploy script uses derivation path "m/44'/60'/0'/0/12"
const minterAccount = mnemonicToAccount(HARDHAT_MNEMONIC, {
  path: "m/44'/60'/0'/0/12"
});

// Wallet client (for sending transactions)
const walletClient = createWalletClient({
  account: myWalletAccount,
  chain: TARGET_CHAIN,
  transport: http(),
});

// Public client (for blockchain read operations)
const publicClient = createPublicClient({
  chain: TARGET_CHAIN,
  transport: http(),
});

// Challenge4 contract instance
const challenge4Contract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].Challenge4.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].Challenge4.abi,
  client: { public: publicClient, wallet: walletClient },
});

// Unified implementation (common for local and production)
async function solveChallenge4() {
  const chainName = isLocal ? "Local" : "Optimism";
  console.log(`🚀 Starting to solve Challenge 4 on ${chainName}...`);
  console.log("");
  console.log("📚 Challenge 4 Mechanism:");
  console.log("   - Requires signature from specific minter account");
  console.log("   - Message format: keccak256(abi.encode('BG CTF Challenge 4', msg.sender))");
  console.log("   - Hardhat account #12 is registered as minter");
  console.log("");

  console.log("📝 Minter address:", minterAccount.address);
  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 Challenge4 address:", challenge4Contract.address);
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
        4n
      ]);

      if (hasMinted) {
        console.log("✅ This address has already obtained Challenge 4 NFT");
        console.log("🎉 Challenge 4 is already complete!");
        return;
      }
    } catch {
      // Ignore hasMinted check errors
    }

    // Check minter status
    const isMinter = await challenge4Contract.read.isMinter([
      minterAccount.address
    ]);
    console.log("📊 Minter status:", isMinter);

    if (!isMinter) {
      console.error("❌ This account is not registered as minter");

      // Try other indices
      console.log("");
      console.log("🔍 Checking other account indices...");

      let foundMinter = null;
      for (let i = 0; i < 20; i++) {
        const testAccount = mnemonicToAccount(HARDHAT_MNEMONIC, {
          path: `m/44'/60'/0'/0/${i}`
        });

        const isThisMinter = await challenge4Contract.read.isMinter([
          testAccount.address
        ]);

        if (isThisMinter) {
          console.log(`✅ Found minter! Index ${i}: ${testAccount.address}`);
          foundMinter = testAccount;
          break;
        }
      }

      if (!foundMinter) {
        console.log("❌ Minter account not found");
        console.log("💡 Please re-run deploy script to add minter");
        process.exit(1);
      }

      // Use the found minter
      const messageData = encodeAbiParameters(
        [{ type: "string" }, { type: "address" }],
        ["BG CTF Challenge 4", myWalletAccount.address]
      );
      const messageHash = keccak256(messageData);
      const signature = await foundMinter.signMessage({
        message: { raw: messageHash }
      });

      const txHash = await challenge4Contract.write.mintFlag([
        foundMinter.address,
        signature
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash
      });

      if (receipt.status === "success") {
        console.log("🎉 Challenge 4 complete!");
        console.log("🚩 NFT Flag #4 has been minted!");
        return;
      } else {
        console.error("❌ Transaction failed");
        process.exit(1);
      }
    }

    // Create message (same format as Solidity's abi.encode)
    // Same as Solidity's abi.encode("BG CTF Challenge 4", msg.sender)
    const messageData = encodeAbiParameters(
      [{ type: "string" }, { type: "address" }],
      ["BG CTF Challenge 4", myWalletAccount.address]
    );
    const messageHash = keccak256(messageData);

    console.log("📝 Message data:", messageData);
    console.log("📝 Message hash:", messageHash);

    // Create EIP-191 format signature
    // signMessage hashes the message and adds EIP-191 prefix
    // Challenge4 processes keccak256(abi.encode(...)) with toEthSignedMessageHash()
    // Therefore, pass the hash as raw message
    console.log("✍️  Creating signature...");
    const signature = await minterAccount.signMessage({
      message: { raw: messageHash },
    });

    console.log("📝 Signature:", signature);
    console.log("");

    // Call mintFlag function
    console.log("📤 Calling mintFlag function...");
    console.log("   - minter:", minterAccount.address);
    console.log("   - signature:", signature);

    const txHash = await challenge4Contract.write.mintFlag([
      minterAccount.address,
      signature
    ]);

    console.log("⏳ Transaction hash:", txHash);
    console.log("⏳ Waiting for transaction confirmation...");

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    if (receipt.status === "success") {
      console.log("");
      console.log("🎉 Challenge 4 complete!");
      console.log("🚩 NFT Flag #4 has been minted!");
      console.log("");
      console.log("📚 What we learned:");
      console.log("   - Creating and verifying ECDSA signatures");
      console.log("   - EIP-191 message signature standard");
      console.log("   - Using Solidity's abi.encode and keccak256");
      console.log("   - HD wallet derivation paths");
    } else {
      console.error("❌ Transaction failed");
      process.exit(1);
    }
  } catch (error: any) {
    // Treat as success if already minted
    if (error.message?.includes("User address has already minted for this challenge")) {
      console.log("✅ This address has already obtained Challenge 4 NFT");
      console.log("🎉 Challenge 4 is already complete!");
      return;
    }

    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("Not a minter")) {
      console.log("");
      console.log("💡 Hint:");
      console.log("   - Verify minter address is correct");
      console.log("   - Check which account was added in deploy script");
      console.log("   - Redeploy contract with yarn deploy --reset");
    } else if (error.message?.includes("Invalid signature")) {
      console.log("");
      console.log("💡 Hint:");
      console.log("   - Verify message format is correct");
      console.log("   - Check if signer's address matches minter");
    } else if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1);
  }
}

// Display help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 4 - Signature Verification Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge4.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Execute on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Mint flag using minter account's signature");
  console.log("  Uses account derived from Hardhat's mnemonic");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas fees");
  console.log("  - Local: yarn chain & yarn deploy executed");
  process.exit(0);
}

// Execute script
solveChallenge4().catch((error) => {
  console.error(error);
  process.exit(1);
});