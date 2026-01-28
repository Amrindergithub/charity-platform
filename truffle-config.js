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
  migrations_directory: "./blockchain/migrations/"
};
