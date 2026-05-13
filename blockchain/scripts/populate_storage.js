// Populate CharityPlatform storage for Ganache screenshot
// Run: npx truffle exec blockchain/scripts/populate_storage.js --network development

module.exports = async function (callback) {
  try {
    const CharityPlatform = artifacts.require("CharityPlatform");
    const c = await CharityPlatform.deployed();
    const acc = await web3.eth.getAccounts();

    console.log("Creating campaign...");
    await c.createCampaign(
      "Local Test Campaign",
      "Demonstration campaign for Ganache storage screenshot",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.01", "ether"),
      30,
      [],
      [],
      []
    );
    console.log("Campaign created. campaignCount =", (await c.campaignCount()).toString());

    console.log("Donating 0.5 ETH from account[1]...");
    await c.donate(0, {
      from: acc[1],
      value: web3.utils.toWei("0.5", "ether"),
    });

    const summary = await c.getSummary(0);
    console.log("Campaign 0 summary:");
    console.log("  name:", summary.name);
    console.log("  raisedAmount:", web3.utils.fromWei(summary.raisedAmount, "ether"), "ETH");
    console.log("  donorsCount:", summary.donorsCount.toString());
    console.log("DONE — refresh Ganache STORAGE tab.");
    callback();
  } catch (err) {
    console.error("ERROR:", err.message);
    callback(err);
  }
};
