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

// NFTFlags contract instance
const nftFlagsContract = getContract({
  // @ts-ignore Defined after deployment
  address: contractsData[TARGET_CHAIN.id].NFTFlags.address,
  // @ts-ignore Defined after deployment
  abi: contractsData[TARGET_CHAIN.id].NFTFlags.abi,
  client: { public: publicClient, wallet: walletClient },
});

async function solveChallenge10() {
  console.log("🚀 Starting Challenge 10...");
  console.log("");
  console.log("📚 Challenge 10 Mechanism:");
  console.log("   - 'Give 1 Get 1' - Give Challenge 1 NFT to get Challenge 10");
  console.log("   - Requires Challenge 1 and Challenge 9 NFTs");
  console.log("   - Send Challenge 1 NFT to NFTFlags contract");
  console.log("   - Include Challenge 9 tokenId in data parameter");
  console.log("");

  console.log("📍 Solver address:", myWalletAccount.address);
  console.log("📍 NFTFlags address:", nftFlagsContract.address);
  console.log("");

  try {
    // Check owned NFT count
    const balance = await nftFlagsContract.read.balanceOf([myWalletAccount.address]);
    console.log("🏆 Owned NFT count:", balance.toString());

    // Challenge 10 requires at least 9 NFTs (Challenges 1-9 completed)
    if (balance < 9n) {
      console.error("");
      console.error("❌ Insufficient NFT ownership");
      console.error(`   Current: ${balance}/12`);
      console.error("");
      console.error("📊 Completion status by Challenge:");

      // Check status of each Challenge
      for (let i = 1n; i <= 9n; i++) {
        const hasMinted = await nftFlagsContract.read.hasMinted([
          myWalletAccount.address,
          i
        ]);

        if (hasMinted) {
          console.log(`   ✅ Challenge ${i}: Completed`);
        } else {
          console.error(`   ❌ Challenge ${i}: Not completed`);
        }
      }

      console.error("");
      console.error("💡 Please complete the uncompleted Challenges first");

      // If Challenge 9 is not completed, show specific steps
      const hasChallenge9 = await nftFlagsContract.read.hasMinted([
        myWalletAccount.address,
        9n
      ]);

      if (!hasChallenge9) {
        console.error("");
        console.error("🔧 Run Challenge 9:");
        console.error("   npx tsx src/solveChallenge9.ts");
      }

      // Also display if Challenge 1 is not completed
      const hasChallenge1 = await nftFlagsContract.read.hasMinted([
        myWalletAccount.address,
        1n
      ]);

      if (!hasChallenge1) {
        console.error("");
        console.error("🔧 Run Challenge 1:");
        console.error("   npx tsx src/solveChallenge1.ts");
      }

      process.exit(1);
    }

    // Ensure Challenge 1 and Challenge 9 exist
    const hasChallenge1 = await nftFlagsContract.read.hasMinted([
      myWalletAccount.address,
      1n
    ]);

    const hasChallenge9 = await nftFlagsContract.read.hasMinted([
      myWalletAccount.address,
      9n
    ]);

    if (!hasChallenge1 || !hasChallenge9) {
      console.error("");
      console.error("❌ Missing NFTs required for Challenge 10");

      if (!hasChallenge1) {
        console.error("   ❌ Missing Challenge 1 NFT");
      }

      if (!hasChallenge9) {
        console.error("   ❌ Missing Challenge 9 NFT");
      }

      console.error("");
      console.error("💡 Please complete the missing Challenges first");
      process.exit(1);
    }

    console.log("");
    console.log("✅ Confirmed required NFTs");
    console.log("   - Challenge 1: Owned");
    console.log("   - Challenge 9: Owned");
    console.log("");

    // Check tokenId and challengeId of owned NFTs
    // Get owned tokens from Transfer events
    let challenge1TokenId: bigint | null = null;
    let challenge9TokenId: bigint | null = null;

    console.log("🔍 Starting crawl to identify TokenID...");

    // Filter Transfer events to get token IDs
    let ownedTokens: { tokenId: bigint, challengeId?: bigint }[] = [];

    console.log("📝 Getting owned tokens from Transfer events...");

    // Recent blocks for Optimism, from 0 for local
    const currentBlock = await publicClient.getBlockNumber();
    // Search recent 5M blocks (approx 2-3 months) or specify via environment variable
    const lookbackBlocks = process.env.LOOKBACK_BLOCKS ? BigInt(process.env.LOOKBACK_BLOCKS) : 5_000_000n;
    const deployBlock = isLocal ? 0n : currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : 118_000_000n;
    const chunkSize = isLocal ? 500_000n : 10_000n; // Split every 10,000 blocks for Optimism

    console.log(`   📊 Search range: Block ${deployBlock} to ${currentBlock}`);
    if (!isLocal) {
      console.log(`   📝 Chunk size: ${chunkSize} blocks`);
      const totalChunks = (currentBlock - deployBlock) / chunkSize;
      console.log(`   📊 Estimated chunks: ${totalChunks}`);
    }

    const allTransferLogs = [];
    let chunkCount = 0;
    const estimatedTotalChunks = Math.ceil(Number((currentBlock - deployBlock) / chunkSize));

    // Split and fetch block ranges
    for (let fromBlock = deployBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
      const toBlock = fromBlock + chunkSize > currentBlock ? currentBlock : fromBlock + chunkSize;
      chunkCount++;

      if (!isLocal) {
        // Display progress concisely (for Optimism)
        if (chunkCount % 10 === 1) {
          console.log(`   📦 Processing chunk ${chunkCount}/${estimatedTotalChunks}...`);
        }
      } else {
        console.log(`   🔍 Searching blocks ${fromBlock} - ${toBlock}...`);
      }

      try {
        const logs = await publicClient.getLogs({
          address: nftFlagsContract.address as `0x${string}`,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', indexed: true, name: 'from' },
              { type: 'address', indexed: true, name: 'to' },
              { type: 'uint256', indexed: true, name: 'tokenId' },
            ],
          },
          args: {
            to: myWalletAccount.address,
          },
          fromBlock: fromBlock,
          toBlock: toBlock,
        });

        allTransferLogs.push(...logs);

        if (logs.length > 0) {
          console.log(`      ✅ Found ${logs.length} Transfer events`);
        }
      } catch (error: any) {
        // If still too large, retry with smaller chunks
        if (error.message?.includes("Block range is too large") && !isLocal) {
          const smallerChunkSize = 1_000n;
          console.log(`      ⚠️ Reducing chunk size to ${smallerChunkSize} and retrying...`);

          for (let smallFrom = fromBlock; smallFrom < toBlock; smallFrom += smallerChunkSize) {
            const smallTo = smallFrom + smallerChunkSize > toBlock ? toBlock : smallFrom + smallerChunkSize;

            try {
              const smallLogs = await publicClient.getLogs({
                address: nftFlagsContract.address as `0x${string}`,
                event: {
                  type: 'event',
                  name: 'Transfer',
                  inputs: [
                    { type: 'address', indexed: true, name: 'from' },
                    { type: 'address', indexed: true, name: 'to' },
                    { type: 'uint256', indexed: true, name: 'tokenId' },
                  ],
                },
                args: {
                  to: myWalletAccount.address,
                },
                fromBlock: smallFrom,
                toBlock: smallTo,
              });

              allTransferLogs.push(...smallLogs);
              if (smallLogs.length > 0) {
                console.log(`         ✅ Found ${smallLogs.length} Transfer events`);
              }
            } catch (smallError: any) {
              // Skip if it still fails
              console.log(`         ⚠️ Skipping blocks ${smallFrom}-${smallTo}`);
              continue;
            }
          }
        } else {
          console.log(`      ⚠️ Error: ${error.message?.substring(0, 50)}...`);
          continue;
        }
      }
    }

    console.log(`   ✅ Found total of ${allTransferLogs.length} Transfer events`);

    // Check current owner for each token ID
    for (const log of allTransferLogs) {
      const tokenId = log.args.tokenId!;

      try {
        // Check if still owned
        const currentOwner = await nftFlagsContract.read.ownerOf([tokenId]);

        if (currentOwner.toLowerCase() === myWalletAccount.address.toLowerCase()) {
          console.log(`   ✅ Token found: ID=${tokenId}`);

          let challengeId: bigint | undefined;
          try {
            // If tokenIdToChallengeId is available
            // @ts-ignore - Check if function exists
            challengeId = await nftFlagsContract.read.tokenIdToChallengeId([tokenId]);
          } catch (err) {
            // Skip if tokenIdToChallengeId is not available
          }

          console.log(`   - TokenID ${tokenId}: ${challengeId !== undefined ? `Challenge ${challengeId}` : 'Challenge ID unknown'} (owned)`);
          ownedTokens.push({ tokenId, challengeId });

          if (challengeId === 1n) {
            challenge1TokenId = tokenId;
          } else if (challengeId === 9n) {
            challenge9TokenId = tokenId;
          }
        }
      } catch (e) {
        // This token has already been transferred to someone else or burned
        continue;
      }
    }

    console.log(`\n📊 Owned tokens list (${ownedTokens.length}):`);
    ownedTokens.forEach(token => {
      console.log(`   - TokenID: ${token.tokenId}, ChallengeID: ${token.challengeId ?? 'Unknown'}`);
    });

    // If all required tokens are not found yet
    if (!challenge1TokenId || !challenge9TokenId) {
      console.log("");
      console.log("❌ Required tokens not found");
      console.log("");
      console.log("📊 NFT ownership status:");
      console.log(`   - Owned NFT count: ${ownedTokens.length}/12`);
      console.log(`   - Challenge 1: ${challenge1TokenId ? `✅ Completed (TokenID: ${challenge1TokenId})` : '❌ Not completed'}`);
      console.log(`   - Challenge 9: ${challenge9TokenId ? `✅ Completed (TokenID: ${challenge9TokenId})` : '❌ Not completed'}`);
      console.log(`   - Challenge 10: ❌ Cannot execute (missing required NFTs)`);
      console.log("");

      // If Challenge 1 is not completed
      if (!challenge1TokenId) {
        console.log("💡 Please complete Challenge 1 first:");
        console.log("   npx tsx src/solveChallenge1.ts");
      }

      // If Challenge 9 is not completed
      if (!challenge9TokenId) {
        console.log("💡 Please complete Challenge 9 first:");
        console.log("   npx tsx src/solveChallenge9.ts");
      }

      console.log("");
      console.log("❌ Aborting Challenge 10 due to missing required Challenge NFTs");
      process.exit(1);
    }

    console.log("");
    console.log("✅ Confirmed required NFTs:");
    console.log(`   - Challenge 1: TokenID ${challenge1TokenId}`);
    console.log(`   - Challenge 9: TokenID ${challenge9TokenId}`);

    // Check if Challenge 10 flag is already minted
    const hasMintedChallenge10 = await nftFlagsContract.read.hasMinted([
      myWalletAccount.address,
      10n
    ]);

    if (hasMintedChallenge10) {
      console.log("✅ Challenge 10 flag is already minted");
      return;
    }

    // Encode Challenge 9 tokenId to bytes32
    const dataBytes = encodeAbiParameters(
      [{ type: "uint256" }],
      [challenge9TokenId]
    );

    console.log("");
    console.log("🎯 Sending Challenge 1 NFT to NFTFlags contract...");
    console.log(`   - TokenID: ${challenge1TokenId}`);
    console.log(`   - Data (Challenge 9 TokenID): ${dataBytes}`);

    // Execute safeTransferFrom (onERC721Received will be called)
    const txHash = await nftFlagsContract.write.safeTransferFrom([
      myWalletAccount.address,        // from
      nftFlagsContract.address,       // to (NFTFlags contract itself)
      challenge1TokenId,               // tokenId (Challenge 1)
      dataBytes                        // data (Challenge 9 tokenId)
    ]);

    console.log("⏳ Transaction:", txHash);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash
    });

    if (receipt.status === "success") {
      console.log("");
      console.log("🎉 Transaction successful");

      // Check if Challenge 10 NFT was actually minted
      const hasChallenge10Now = await nftFlagsContract.read.hasMinted([
        myWalletAccount.address,
        10n
      ]);

      if (hasChallenge10Now) {
        console.log("✅ Challenge 10 NFT flag minted!");

        // Check new NFT count
        const newNftCount = await nftFlagsContract.read.balanceOf([myWalletAccount.address]);
        console.log(`📊 Current NFT count: ${newNftCount} (previous: ${ownedTokens.length})`);

        // Check if Challenge 1 NFT was returned
        try {
          const newOwner = await nftFlagsContract.read.ownerOf([challenge1TokenId]);
          if (newOwner.toLowerCase() === myWalletAccount.address.toLowerCase()) {
            console.log("✅ Challenge 1 NFT also returned!");
          } else {
            console.log("⚠️ Challenge 1 NFT was not returned (this may be normal behavior)");
          }
        } catch {
          console.log("⚠️ Error checking Challenge 1 NFT (token may have been consumed)");
        }

        console.log("");
        console.log("🎉 Challenge 10 complete!");
        console.log("");
        console.log("📚 What we learned:");
        console.log("   - ERC721 safeTransferFrom and onERC721Received");
        console.log("   - NFT interaction and callbacks");
        console.log("   - Using data parameter");
        console.log("   - Token exchange mechanism");
      } else {
        console.log("❌ Challenge 10 NFT was not minted");
        console.log("   Transaction succeeded but NFT flag was not obtained");
        console.log("   Please verify you own Challenge 9 NFT");
        process.exit(1);
      }
    } else {
      console.log("❌ Transaction failed");
      process.exit(1);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message || error);

    if (error.message?.includes("Not owner!")) {
      console.log("");
      console.log("💡 Hints:");
      console.log("   - Verify you own Challenge 9 NFT");
      console.log("   - Verify you are using correct tokenId");
    } else if (error.message?.includes("Not the right token")) {
      console.log("");
      console.log("💡 Hints:");
      console.log("   - Challenge 1 and Challenge 9 NFTs required");
      console.log("   - Verify you are sending correct tokenId");
    } else if (error.message?.includes("User address is not registered")) {
      console.log("");
      console.log("💡 Please complete Challenge 1 first");
    }
    process.exit(1);
  }
}

// Display help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 Challenge 10 - Approval Permission Challenge");
  console.log("");
  console.log("Usage:");
  console.log("  npx tsx src/solveChallenge10.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Display this help");
  console.log("");
  console.log("Description:");
  console.log("  Trigger transfer using WETH approval");
  console.log("");
  console.log("Requirements:");
  console.log("  - Challenge 1 completed");
  console.log("  - Optimism: ETH for gas");
  console.log("  - Local: yarn chain & yarn deploy executed");
  process.exit(0);
}

// Execute script
solveChallenge10().catch((error) => {
  console.error(error);
  process.exit(1);
});