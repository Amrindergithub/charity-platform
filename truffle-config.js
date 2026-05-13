const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config();

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777"
    },
    ganache: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777"
    },
    polygon_amoy: {
      provider: () => new HDWalletProvider(
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology"
      ),
      network_id: 80002,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 20000000,
      gasPrice: 3000000000
    },
    sepolia: {
      provider: () => new HDWalletProvider(
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.SEPOLIA_RPC || "https://rpc.sepolia.org"
      ),
      network_id: 11155111,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 8000000,
      verify: {
        apiUrl: "https://api.etherscan.io/v2/api?chainid=11155111",
        apiKey: process.env.ETHERSCAN_API_KEY,
        explorerUrl: "https://sepolia.etherscan.io/address"
      }
    }
  },
  compilers: {
    solc: {
      version: "0.8.28",
      settings: {
        viaIR: true,
        evmVersion: "paris",
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  contracts_directory: "./blockchain/contracts/",
  contracts_build_directory: "./frontend/src/contracts/",
  migrations_directory: "./blockchain/migrations/",
  test_directory: "./blockchain/test/",
  plugins: ["truffle-plugin-verify", "solidity-coverage"],
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  },
  mocha: {
    reporter: "eth-gas-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 2.5,
      showTimeSpent: true,
      src: "blockchain/contracts",
      artifactType: "truffle-v5",
      excludeContracts: ["Migrations"],
      forceConsoleOutput: true,
      noColors: false
    }
  }
};
