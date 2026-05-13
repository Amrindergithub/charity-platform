const CharityPlatform = artifacts.require("CharityPlatform");
const MockUSDT = artifacts.require("MockUSDT");

const CHAIN_LABELS = {
  1: "Ethereum Mainnet",
  5777: "Ganache (localhost:7545)",
  11155111: "Sepolia testnet",
  80002: "Polygon Amoy testnet",
};

module.exports = async function (deployer, network) {
  // Deploy CharityPlatform
  await deployer.deploy(CharityPlatform);
  const charity = await CharityPlatform.deployed();

  // Deploy MockUSDT (6 decimals, open faucet for testing)
  await deployer.deploy(MockUSDT);
  const mockUSDT = await MockUSDT.deployed();

  // Link: tell CharityPlatform to use MockUSDT as its stablecoin
  await charity.setStablecoinAddress(mockUSDT.address);

  const chainId = await web3.eth.getChainId();
  const label = CHAIN_LABELS[chainId] || `${network} (chainId ${chainId})`;

  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  CharityPlatform deployed to:", charity.address);
  console.log("  MockUSDT deployed to:       ", mockUSDT.address);
  console.log("  Stablecoin linked:           MockUSDT → CharityPlatform");
  console.log("  Chain:", label);
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
};
