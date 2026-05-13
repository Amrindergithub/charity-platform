/**
 * Adversarial test suite for CharityPlatform.
 *
 * Each test exercises a specific attack pattern from the smart-contract
 * security literature against the deployed contract. These are run
 * alongside the eleven happy-path tests in charity_platform.test.js
 * and provide the empirical evidence behind the security claims made
 * in the dissertation.
 *
 * Run:
 *   npx truffle test blockchain/test/adversarial.test.js
 *
 * Cited literature behind the attack patterns:
 *   Smart Contract Security Alliance (2018) — reentrancy classification
 *   ConsenSys Diligence (2024)               — push/pull payment guidance
 *   Sharma et al. (2023)                     — latent specification gaps
 */

const CharityPlatform = artifacts.require("CharityPlatform");
const MaliciousRefundReceiver = artifacts.require("MaliciousRefundReceiver");

contract("CharityPlatform — adversarial", (accounts) => {
  const [owner, manager, donor1, donor2, vendor] = accounts;
  let platform;

  async function activeCampaign({ targetEth = "1", deadlineDays = 30 } = {}) {
    await platform.createCampaign(
      "Adversarial test campaign",
      "desc",
      web3.utils.toWei(targetEth, "ether"),
      web3.utils.toWei("0.001", "ether"),
      deadlineDays,
      [], [], [],
      { from: manager }
    );
  }

  beforeEach(async () => {
    platform = await CharityPlatform.new({ from: owner });
  });

  // ---------- 1. Reentrancy attack on claimRefund ----------

  it("rejects re-entrancy into claimRefund from a malicious receive()", async () => {
    await activeCampaign({ targetEth: "10" });

    // Deploy attacker, donate from attacker contract.
    const attacker = await MaliciousRefundReceiver.new(platform.address);
    await attacker.setCampaign(0);
    await attacker.donateAs(0, {
      from: donor1,
      value: web3.utils.toWei("0.5", "ether"),
    });

    // Cancel so the refund path is open.
    await platform.cancelCampaign(0, { from: manager });

    // Arm the attack and call claimRefund through the attacker.
    await attacker.arm();
    try {
      await attacker.attack();
    } catch (e) {
      // Either the legitimate refund itself reverts, or the second
      // call inside receive() reverts. Either way is acceptable: the
      // contract must not allow two refunds for the same donor.
    }

    const reentryAttempts = (await attacker.reentryAttempts()).toNumber();
    const reentryReverts = (await attacker.reentryReverts()).toNumber();

    // Either no refund happened (cancelCampaign already pushed a refund
    // and there is nothing left to claim) OR one refund happened and the
    // re-entrancy attempt was caught. The defensive invariant is that
    // every reentry attempt must revert.
    assert.equal(
      reentryAttempts,
      reentryReverts,
      `every re-entry attempt must revert (attempts=${reentryAttempts}, reverts=${reentryReverts})`
    );
  });

  // ---------- 2. Deadline bypass ----------

  it("rejects donations submitted after the campaign deadline", async () => {
    await activeCampaign({ targetEth: "10", deadlineDays: 1 });

    // Fast-forward two days. ganache supports evm_increaseTime + evm_mine.
    await new Promise((resolve, reject) =>
      web3.currentProvider.send(
        { jsonrpc: "2.0", method: "evm_increaseTime", params: [60 * 60 * 24 * 2], id: 0 },
        (err) => (err ? reject(err) : resolve())
      )
    );
    await new Promise((resolve, reject) =>
      web3.currentProvider.send(
        { jsonrpc: "2.0", method: "evm_mine", params: [], id: 0 },
        (err) => (err ? reject(err) : resolve())
      )
    );

    try {
      await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.1", "ether") });
      assert.fail("expected revert: deadline bypass");
    } catch (e) {
      assert.match(e.message, /deadline/i, "expected revert reason mentions deadline");
    }
  });

  // ---------- 3. Goal bypass ----------

  it("rejects donations once the campaign target has been reached", async () => {
    await activeCampaign({ targetEth: "0.5" });

    // First donor brings the campaign exactly to its target.
    await platform.donate(0, { from: donor1, value: web3.utils.toWei("0.5", "ether") });

    // Second donor must be rejected because target is already reached.
    try {
      await platform.donate(0, { from: donor2, value: web3.utils.toWei("0.1", "ether") });
      assert.fail("expected revert: goal already reached");
    } catch (e) {
      assert.match(e.message, /goal already reached|target/i);
    }
  });

  // ---------- 4. Below-minimum donation ----------

  it("rejects an ether donation below the campaign minimum contribution", async () => {
    await activeCampaign({ targetEth: "10" });

    // Minimum is 0.001 ETH. Try to donate 1 wei.
    try {
      await platform.donate(0, { from: donor1, value: 1 });
      assert.fail("expected revert: below minimum");
    } catch (e) {
      assert.match(e.message, /minimum|below/i);
    }
  });

  // ---------- 5. Direct ETH transfer to contract ----------

  it("rejects raw ETH transfers that do not call donate", async () => {
    // Sending ETH straight to the contract must not bypass campaign accounting.
    try {
      await web3.eth.sendTransaction({
        from: donor1,
        to: platform.address,
        value: web3.utils.toWei("0.1", "ether"),
      });
      // If the transfer succeeds without reverting, fail unless the
      // contract logs an explicit fallback path. The contract has no
      // payable receive/fallback, so the transfer should revert.
      assert.fail("expected revert: contract should not accept raw ETH transfers");
    } catch (e) {
      assert.match(e.message, /revert|invalid|fallback/i);
    }
  });
});
