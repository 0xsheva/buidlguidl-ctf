import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import * as readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================
// Challenge Execution Settings
// ========================
const CHALLENGES = [
  { number: 1, name: "Name Registration" },
  { number: 2, name: "msg.sender != tx.origin" },
  { number: 3, name: "Mint from Constructor" },
  { number: 4, name: "Encoding" },
  { number: 5, name: "Decryption" },
  { number: 6, name: "Secret Number" },
  { number: 7, name: "Delegate Call" },
  { number: 8, name: "Overflow" },
  { number: 9, name: "Etherswap" },
  { number: 10, name: "Multi-Token Transfer" },
  { number: 11, name: "CREATE2 Prediction" },
  { number: 12, name: "RLP Verification" },
];

// Check --local flag from command line arguments
const isLocal = process.argv.includes("--local");

// Colored console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

/**
 * Execute challenge
 */
async function runChallenge(number: number): Promise<boolean> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, `solveChallenge${number}.ts`);

    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.bright}🎯 Challenge ${number} executing...${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const args = ["tsx", scriptPath];
    // Pass --local flag if present
    if (isLocal) {
      args.push("--local");
    }
    const child = spawn("npx", args, {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`\n${colors.green}✅ Challenge ${number} completed!${colors.reset}\n`);
        resolve(true);
      } else {
        console.log(`\n${colors.red}❌ Challenge ${number} failed (error code: ${code})${colors.reset}\n`);
        resolve(false);
      }
    });

    child.on("error", (err) => {
      console.error(`${colors.red}❌ Challenge ${number} execution error:${colors.reset}`, err);
      resolve(false);
    });
  });
}

/**
 * Execution confirmation prompt
 */
async function confirmExecution(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`${colors.yellow}⚠️  Warning: Will execute Challenges 1-12 in sequence.${colors.reset}`);
    console.log(`${colors.yellow}   This will consume gas. Continue? (y/n)${colors.reset}`);

    // Check TTY environment
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.once("data", (key) => {
        process.stdin.setRawMode(false);
        process.stdin.pause();

        const answer = key.toString().toLowerCase();
        console.log(""); // Add newline
        resolve(answer === "y" || answer === "yes");
      });
    } else {
      // Use readline when not in TTY environment
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question("", (answer: string) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      });
    }
  });
}

/**
 * Main process
 */
async function main() {
  console.log(`${colors.bright}${colors.blue}`);
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║      🚀 BuidlGuidl CTF - All Challenges       ║");
  console.log("║                  Challenge 1-12                ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`${colors.reset}`);

  if (isLocal) {
        console.log(`${colors.yellow}🌐 Network: Local (31337)${colors.reset}`);
  } else {
    console.log(`${colors.cyan}🌐 Network: Optimism${colors.reset}`);
  }
  console.log("");

  console.log("\n📋 Challenges to execute:");
  CHALLENGES.forEach((c) => {
    console.log(`   ${colors.cyan}${c.number.toString().padStart(2, "0")}${colors.reset}: ${c.name}`);
  });

  // Execution confirmation
  const shouldContinue = await confirmExecution();
  if (!shouldContinue) {
        console.log(`\n${colors.yellow}⏸️  Execution cancelled${colors.reset}`);
    process.exit(0);
  }

    console.log(`\n${colors.green}🎬 Starting execution...${colors.reset}\n`);

  // Record execution results
  const results: { number: number; success: boolean }[] = [];
  const startTime = Date.now();

  // Execute each challenge in sequence
  for (const challenge of CHALLENGES) {
    const success = await runChallenge(challenge.number);
    results.push({ number: challenge.number, success });

    // Handle failure cases
    if (!success) {
            // Challenge 1-9 are critical (prerequisites for Challenge 10) so auto-abort
      if (challenge.number >= 1 && challenge.number <= 9) {
        console.log(`\n${colors.red}❌ Challenge ${challenge.number} failed${colors.reset}`);
        console.log(`${colors.yellow}⚠️  Challenge ${challenge.number} is a prerequisite for subsequent challenges${colors.reset}`);
        console.log(`${colors.yellow}⏸️  Automatically aborting execution${colors.reset}`);
        break;
      }

      // Confirm whether to continue for Challenge 10-12
      console.log(`${colors.yellow}Challenge ${challenge.number} failed. Continue? (y/n)${colors.reset}`);

      const shouldContinue = await new Promise<boolean>((resolve) => {
        // Check TTY environment
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.setEncoding("utf8");

          process.stdin.once("data", (key) => {
            process.stdin.setRawMode(false);
            process.stdin.pause();

            const answer = key.toString().toLowerCase();
            console.log(""); // Add newline
            resolve(answer === "y" || answer === "yes");
          });
        } else {
          // Use readline when not in TTY environment
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          rl.question("", (answer: string) => {
            rl.close();
            resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
          });
        }
      });

      if (!shouldContinue) {
        console.log(`\n${colors.yellow}⏸️  Execution aborted${colors.reset}`);
        break;
      }
    }
  }

  // Calculate execution time
  const endTime = Date.now();
  const totalTime = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  // Display result summary
  console.log(`\n${colors.bright}${colors.blue}`);
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║                  📊 Result Summary                ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`${colors.reset}`);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`\n⏱️  Execution time: ${minutes}m ${seconds}s`);
  console.log(`✅ Success: ${successCount}/${results.length}`);
  console.log(`❌ Failed: ${failCount}/${results.length}`);

  console.log("\n📝 Details:");
  results.forEach((r) => {
    const icon = r.success ? "✅" : "❌";
    const color = r.success ? colors.green : colors.red;
    const challenge = CHALLENGES.find((c) => c.number === r.number);
    console.log(`   ${icon} Challenge ${r.number.toString().padStart(2, "0")}: ${color}${challenge?.name}${colors.reset}`);
  });

  if (successCount === CHALLENGES.length) {
    console.log(`\n${colors.bright}${colors.green}`);
    console.log("🎉🎉🎉 All challenges completed! Congratulations! 🎉🎉🎉");
    console.log(`${colors.reset}`);
  } else if (successCount > 0) {
    console.log(`\n${colors.yellow}⚡ Cleared ${successCount} challenges!${colors.reset}`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// Show help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("📖 BuidlGuidl CTF - All Challenges Execution");
  console.log("");
  console.log("Usage:");
  console.log("  yarn ctf:all [options]");
  console.log("  npx tsx src/solveAllChallenges.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --local  Run on local chain (requires: yarn chain & yarn deploy)");
  console.log("  --help   Show this help");
  console.log("");
  console.log("Description:");
  console.log("  Execute Challenges 1 through 12 in sequence");
  console.log("  Record success/failure of each challenge and display summary at the end");
  console.log("");
  console.log("Individual execution:");
  console.log("  yarn ctf:1  - Execute Challenge 1 only");
  console.log("  yarn ctf:2  - Execute Challenge 2 only");
  console.log("  ...");
  console.log("  yarn ctf:12 - Execute Challenge 12 only");
  console.log("");
  console.log("Requirements:");
  console.log("  - Environment variable __RUNTIME_DEPLOYER_PRIVATE_KEY");
  console.log("  - ETH for gas fees on Optimism");
  process.exit(0);
}

// Clean exit on Ctrl+C
process.on("SIGINT", () => {
  console.log(`\n\n${colors.yellow}⏸️  Execution interrupted${colors.reset}`);
  process.exit(0);
});

main().catch((error) => {
  console.error(`${colors.red}❌ Error:${colors.reset}`, error);
  process.exit(1);
});