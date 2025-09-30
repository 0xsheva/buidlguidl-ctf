//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IChallenge11 {
    function mintFlag() external;
}

contract C11Caller {
    function run(address challenge11) external {
        IChallenge11(challenge11).mintFlag();
    }
}