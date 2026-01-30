// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title MockUSDT
 * @notice A local-only ERC-20 token that mimics Tether (USDT) for testing
 * @dev 6 decimals (same as real USDT). Includes an open faucet so any
 *      address can mint test tokens. DO NOT deploy to mainnet.
 *
 *      Usage with TrustChain:
 *        1. Deploy MockUSDT
 *        2. Call CharityPlatform.setStablecoinAddress(mockUSDT.address)
 *        3. Donors call mockUSDT.faucet(myAddress, 1000e6) to get 1000 mUSDT
 *        4. Donors call mockUSDT.approve(charityPlatform.address, amount)
 *        5. Donors call charityPlatform.donateStablecoin(campaignId, amount)
 */
contract MockUSDT {
    string public name = "Mock Tether USD";
    string public symbol = "mUSDT";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice Mint test tokens to any address (open faucet — testing only)
    /// @param _to     Recipient address
    /// @param _amount Amount in 6-decimal units (e.g. 1000e6 = 1000 USDT)
    function faucet(address _to, uint256 _amount) public {
        require(_to != address(0), "Cannot mint to zero address");
        require(_amount > 0, "Amount must be > 0");
        totalSupply += _amount;
        balanceOf[_to] += _amount;
        emit Transfer(address(0), _to, _amount);
    }

    /// @notice Transfer tokens to another address
    function transfer(address _to, uint256 _amount) public returns (bool) {
        require(_to != address(0), "Cannot transfer to zero address");
        require(balanceOf[msg.sender] >= _amount, "Insufficient balance");
        balanceOf[msg.sender] -= _amount;
        balanceOf[_to] += _amount;
        emit Transfer(msg.sender, _to, _amount);
        return true;
    }

    /// @notice Approve a spender to transfer tokens on your behalf
    function approve(address _spender, uint256 _amount) public returns (bool) {
        require(_spender != address(0), "Cannot approve zero address");
        allowance[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender, _amount);
        return true;
    }

    /// @notice Transfer tokens from one address to another (requires allowance)
    function transferFrom(address _from, address _to, uint256 _amount) public returns (bool) {
        require(_from != address(0), "Cannot transfer from zero address");
        require(_to != address(0), "Cannot transfer to zero address");
        require(balanceOf[_from] >= _amount, "Insufficient balance");
        require(allowance[_from][msg.sender] >= _amount, "Insufficient allowance");
        balanceOf[_from] -= _amount;
        allowance[_from][msg.sender] -= _amount;
        balanceOf[_to] += _amount;
        emit Transfer(_from, _to, _amount);
        return true;
    }
}
