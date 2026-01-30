const CharityPlatform = artifacts.require("CharityPlatform");
const MockUSDT = artifacts.require("MockUSDT");

module.exports = async function (deployer) {
  // Deploy CharityPlatform
  await deployer.deploy(CharityPlatform);
  const charity = await CharityPlatform.deployed();

  // Deploy MockUSDT (6 decimals, open faucet for testing)
  await deployer.deploy(MockUSDT);
  const mockUSDT = await MockUSDT.deployed();

  // Link: tell CharityPlatform to use MockUSDT as its stablecoin
  await charity.setStablecoinAddress(mockUSDT.address);

  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  CharityPlatform deployed to:", charity.address);
  console.log("  MockUSDT deployed to:       ", mockUSDT.address);
  console.log("  Stablecoin linked:           MockUSDT → CharityPlatform");
  console.log("  Chain: Ganache (localhost:7545)");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
};
