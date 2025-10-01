//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IChallenge2 {
    function justCallMe() external;
}

contract Challenge2Solution {
    address public challenge2;

    constructor(address _challenge2Address) {
        challenge2 = _challenge2Address;
    }

    function callChallenge() external {
        // Ensure msg.sender != tx.origin
        // Call justCallMe through a contract
        IChallenge2(challenge2).justCallMe();
    }
}
