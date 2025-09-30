![BuidlGuidl CTF](https://raw.githubusercontent.com/BuidlGuidl/ctf.buidlguidl.com/refs/heads/main/packages/nextjs/public/readme-image.jpg)

# 🚀 BuidlGuidl CTF Quick Start

## 📖 About This Repository

This repository contains **solution scripts** for the [BuidlGuidl CTF](https://ctf.buidlguidl.com/).

The BuidlGuidl CTF is a Capture The Flag (CTF) challenge platform for learning Ethereum smart contract security and Solidity programming. This repository provides automated solution scripts for all 12 challenges.

**Official CTF Site**: https://ctf.buidlguidl.com/

### 🎓 Educational Purpose

This repository is intended for **educational purposes only**. The solutions are provided to help developers:
- Learn smart contract security concepts
- Understand common vulnerabilities in Solidity
- Practice blockchain development techniques
- Study automated testing and scripting with TypeScript and Viem

### ⚖️ Ethical Use

**Important**: These solutions should only be used:
- ✅ For learning and educational purposes
- ✅ To understand security concepts after attempting challenges yourself
- ✅ To improve your smart contract development skills

**Do NOT use these solutions to**:
- ❌ Cheat or skip the learning process
- ❌ Exploit vulnerabilities in production contracts
- ❌ Harm others or their systems

### 📜 Disclaimer

The code in this repository is provided "as is" for educational purposes. Users are responsible for understanding and applying security concepts ethically. Always attempt challenges independently before reviewing solutions.

## 📋 Prerequisites

Before getting started, make sure you have the following:

- **Node.js** v18 or higher
- **Yarn** package manager
- **Optimism ETH** for gas fees (not required for local testing)
- Basic understanding of:
  - Ethereum and smart contracts
  - Solidity programming language
  - TypeScript
  - Command line operations

## 🛠️ Tech Stack

This project is built with:

- **Framework**: [Scaffold-ETH 2](https://scaffoldeth.io/)
- **Languages**: TypeScript, Solidity
- **Libraries**:
  - [Viem](https://viem.sh/) - TypeScript interface for Ethereum
  - [Hardhat](https://hardhat.org/) - Development environment
- **Network**: Optimism (Ethereum Layer 2)
- **Development Tools**: ESLint, Prettier

## 📋 Command List (Run from project root)

### Execute All Challenges at Once
```bash
# Optimism network (production environment)
yarn ctf:all

# Local chain execution
yarn ctf:all --local
```

### Execute Individual Challenges
```bash
# Optimism network (production environment)
yarn ctf:1   # Challenge 1: Name Registration
yarn ctf:2   # Challenge 2: msg.sender != tx.origin
yarn ctf:3   # Challenge 3: Mint from Constructor
yarn ctf:4   # Challenge 4: Encoding
yarn ctf:5   # Challenge 5: Decryption
yarn ctf:6   # Challenge 6: Secret Number
yarn ctf:7   # Challenge 7: Delegate Call
yarn ctf:8   # Challenge 8: Overflow
yarn ctf:9   # Challenge 9: Etherswap
yarn ctf:10  # Challenge 10: Multi-Token Transfer
yarn ctf:11  # Challenge 11: CREATE2 Prediction
yarn ctf:12  # Challenge 12: RLP Verification

# Local chain execution
yarn ctf:1 --local
yarn ctf:2 --local
# ... etc
```

## ⚙️ Initial Setup

### 1. Install Dependencies
```bash
yarn install
```

### 2. Environment Variable Configuration (Important)

#### For Optimism Network Execution (Production Environment)
Create a `packages/scripts/.env` file and set your private key:

```bash
# Copy .env.example to create .env (recommended)
cd packages/scripts
cp .env.example .env
# Edit the created .env file to set your private key
```

Or create directly:
```bash
# Create .env file
cd packages/scripts
echo "__RUNTIME_DEPLOYER_PRIVATE_KEY=0xYourPrivateKey" > .env
```

Or manually create `packages/scripts/.env`:
```bash
# Required for solving actual CTF on Optimism
__RUNTIME_DEPLOYER_PRIVATE_KEY=0xEnterYourPrivateKeyHere
```

🔒 **Security Warning**:
- Never share your private key with others
- `.env` file is not committed to Git (included in `.gitignore`)
- Always separate test private keys from production private keys

⚠️ **Important**: For Optimism network execution, the private key **must** be set in `.env`. The script will exit with an error if not configured.

#### For Local Environment Testing

✅ **--local Flag Support**: All challenge scripts support local execution with the `--local` flag.

**Quick Start (Local)**:
```bash
# 1. Start local chain (in terminal 1)
yarn chain

# 2. Deploy contracts (in terminal 2)
yarn deploy

# 3. Run challenges with --local flag (in terminal 2)
yarn ctf:1 --local  # Individual execution
yarn ctf:all --local  # All challenges at once
```

**Network & Private Key Behavior**:

| Flag | Network | Private Key | Configuration Required? |
|------|---------|-------------|------------------------|
| None | Optimism | Environment variable | ✅ Yes - `.env` file required |
| `--local` | Hardhat (localhost:8545) | Hardhat account #0 (automatic) | ❌ No - uses default key |

**Note**: Challenge 10 may not be deployed in local environment.

### 3. Verify Configuration
Check if environment variable is correctly set:
```bash
# In packages/scripts directory
cd packages/scripts
cat .env  # Verify file exists and private key is set
```

### 4. Prepare Gas Fee
ETH is required for gas fees on Optimism network (not needed for local testing).

📍 **Check Optimism Network Wallet Address**:
```bash
# Run Challenge 1 with --help option to check configuration
yarn ctf:1 --help
```

## 🎯 Execution Examples

### Execute on Optimism Network (Recommended)
```bash
# 1. Set private key in .env file
# 2. Run from root directory
yarn ctf:all

# Or individually
yarn ctf:5
```

### Testing on Local Chain
```bash
# 1. Start local chain
yarn chain

# 2. Deploy contracts
yarn deploy

# 3. Execute (add --local flag)
yarn ctf:1 --local
yarn ctf:all --local
```

## 📊 Execution Results

```
╔════════════════════════════════════════════════╗
║      🚀 BuidlGuidl CTF - All Challenges       ║
║                  Challenge 1-12                ║
╚════════════════════════════════════════════════╝

✅ Success: 12/12
🎉🎉🎉 All challenges completed! Congratulations! 🎉🎉🎉
```

## 🛠️ Troubleshooting

### Network Selection
**Easy switching with --local flag**
- With `--local` flag: Connects to Hardhat chain (localhost:8545, chainId: 31337)
- Without flag: Connects to Optimism network
- Local execution automatically uses Hardhat private key, production requires environment variable private key

### Insufficient Gas Fee Error
```bash
Error: insufficient funds for gas
```
→ Add ETH for gas fees to your Optimism network wallet

### Permission Error
```bash
Error: execution reverted
```
→ Previous challenges may not be completed. Execute sequentially from Challenge 1

## 📚 Learning Resources

### Official Documentation
- [BuidlGuidl CTF](https://ctf.buidlguidl.com/) - Official CTF platform
- [Scaffold-ETH 2 Docs](https://docs.scaffoldeth.io/) - Framework documentation
- [Viem Documentation](https://viem.sh/) - TypeScript Ethereum library
- [Hardhat Documentation](https://hardhat.org/docs) - Development environment

### Smart Contract Security
- [Solidity Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html) - Official Solidity security guide
- [Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/) - ConsenSys security guide
- [SWC Registry](https://swcregistry.io/) - Smart Contract Weakness Classification
- [Ethernaut](https://ethernaut.openzeppelin.com/) - OpenZeppelin's CTF challenges

### Community & Support
- [BuidlGuidl Discord](https://discord.gg/buidlguidl) - Join the community
- [Ethereum Stack Exchange](https://ethereum.stackexchange.com/) - Q&A platform

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report Issues**: Found a bug or have a suggestion? [Open an issue](../../issues)
2. **Improve Documentation**: Help make the README clearer
3. **Share Solutions**: Propose alternative or more efficient solutions
4. **Add Tests**: Improve test coverage

### Contribution Guidelines

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please ensure your code:
- Follows the existing code style
- Includes comments for complex logic
- Works with both local and Optimism networks

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [BuidlGuidl](https://buidlguidl.com/) for creating this educational CTF platform
- [Scaffold-ETH 2](https://scaffoldeth.io/) for the excellent framework
- All contributors and the Ethereum developer community

---

**Happy Learning! 🚀**

If you find this repository helpful, please consider giving it a ⭐️