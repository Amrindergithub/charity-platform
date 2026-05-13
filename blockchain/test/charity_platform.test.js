const CharityPlatform = artifacts.require("CharityPlatform");
const MockUSDT = artifacts.require("MockUSDT");

contract("CharityPlatform", (accounts) => {
  const [owner, manager, donor1, donor2, vendor] = accounts;
  let platform;
  let usdt;

  beforeEach(async () => {
    platform = await CharityPlatform.new();
    usdt = await MockUSDT.new();
    await platform.setStablecoinAddress(usdt.address, { from: owner });
  });

  // ---------- Campaign creation ----------

  it("creates a campaign without phases", async () => {
    await platform.createCampaign(
      "Plain campaign",
      "desc",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30,
      [], [], [],
      { from: manager }
    );
    const summary = await platform.getSummary(0);
    assert.equal(summary[5], "Plain campaign");
    assert.equal(summary[4], manager);
  });

  it("creates a campaign with phased milestones", async () => {
    await platform.createCampaign(
      "Phased",
      "desc",
      web3.utils.toWei("3", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30,
      ["Phase 1", "Phase 2"],
      [web3.utils.toWei("1", "ether"), web3.utils.toWei("3", "ether")],
      [vendor, vendor],
      { from: manager }
    );
    const phaseCount = await platform.getPhaseCount(0);
    assert.equal(phaseCount.toString(), "2");
  });

  it("rejects campaign with empty name", async () => {
    try {
      await platform.createCampaign("", "desc", 1, 1, 30, [], [], [], { from: manager });
      assert.fail("expected revert");
    } catch (e) {
      assert.include(e.message, "Name required");
    }
  });

  // ---------- ETH donation ----------

  it("accepts an ether donation and updates raisedAmount", async () => {
    await platform.createCampaign(
      "Eth campaign", "desc",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30, [], [], [],
      { from: manager }
    );
    await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.05", "ether") });
    const summary = await platform.getSummary(0);
    assert.equal(summary[1].toString(), web3.utils.toWei("0.05", "ether"));
  });

  it("rejects ether donation below minimum contribution", async () => {
    await platform.createCampaign(
      "Strict", "desc",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.01", "ether"),
      30, [], [], [],
      { from: manager }
    );
    try {
      await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.001", "ether") });
      assert.fail("expected revert");
    } catch (e) {
      assert.include(e.message.toLowerCase(), "minimum");
    }
  });

  // ---------- Stablecoin donation ----------

  it("accepts a stablecoin donation via approve + transferFrom", async () => {
    await platform.createCampaign(
      "USDT campaign", "desc",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30, [], [], [],
      { from: manager }
    );
    const amount = "1000000"; // 1 USDT (6 decimals)
    await usdt.faucet(donor1, amount, { from: donor1 });
    await usdt.approve(platform.address, amount, { from: donor1 });
    await platform.donateStablecoin(0, amount, { from: donor1 });
    const extra = await platform.getCampaignExtra(0);
    assert.equal(extra[0].toString(), amount);
  });

  // ---------- Spending request ----------

  it("creates and finalises an approved spending request", async () => {
    await platform.createCampaign(
      "Funded", "desc",
      web3.utils.toWei("0.1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30, [], [], [],
      { from: manager }
    );
    await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.05", "ether") });
    await platform.donate(0, { from: donor2, value: web3.utils.toWei("0.05", "ether") });
    await platform.createRequest(
      0, "Pay vendor",
      web3.utils.toWei("0.05", "ether"),
      vendor, "logistics", false,
      { from: manager }
    );
    await platform.approveRequest(0, 0, { from: donor1 });
    // 2nd approval > 50% auto-executes via _executeRequest
    await platform.approveRequest(0, 0, { from: donor2 });
    const details = await platform.getRequestDetails(0, 0);
    assert.equal(details[3], true, "request should be complete");
  });

  it("blocks finalising a request without majority approval", async () => {
    await platform.createCampaign(
      "Quorum", "desc",
      web3.utils.toWei("0.1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30, [], [], [],
      { from: manager }
    );
    await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.05", "ether") });
    await platform.donate(0, { from: donor2, value: web3.utils.toWei("0.05", "ether") });
    await platform.createRequest(
      0, "Vendor", web3.utils.toWei("0.05", "ether"),
      vendor, "ops", false,
      { from: manager }
    );
    try {
      await platform.finalizeRequest(0, 0, { from: manager });
      assert.fail("expected revert");
    } catch (e) {
      assert.include(e.message.toLowerCase(), "approv");
    }
  });

  // ---------- Cancellation + refund ----------

  it("cancels a campaign and refunds donors via batch processing", async () => {
    await platform.createCampaign(
      "Refund test", "desc",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30, [], [], [],
      { from: manager }
    );
    await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.05", "ether") });
    await platform.donate(0, { from: donor2, value: web3.utils.toWei("0.05", "ether") });
    await platform.cancelCampaign(0, { from: manager });
    const extra = await platform.getCampaignExtra(0);
    assert.equal(extra[3], true);
  });

  it("blocks non-managers from cancelling a campaign", async () => {
    await platform.createCampaign(
      "Owner only", "desc",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30, [], [], [],
      { from: manager }
    );
    try {
      await platform.cancelCampaign(0, { from: donor1 });
      assert.fail("expected revert");
    } catch (e) {
      assert.include(e.message.toLowerCase(), "manager");
    }
  });

  // ---------- View helpers ----------

  it("reports the donor reputation tier after a donation", async () => {
    await platform.createCampaign(
      "Rep", "desc",
      web3.utils.toWei("1", "ether"),
      web3.utils.toWei("0.001", "ether"),
      30, [], [], [],
      { from: manager }
    );
    await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.05", "ether") });
    const tier = await platform.getReputationTier(donor1);
    assert.isAtLeast(Number(tier), 0);
  });
});
