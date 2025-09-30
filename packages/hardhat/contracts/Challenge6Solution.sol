//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IChallenge6 {
    function mintFlag(uint256 code) external;
}

contract Challenge6Solution {
    IChallenge6 public challenge6;
    string public name = "BG CTF Challenge 6 Solution"; // Return the correct name
    uint256 public lastGasLeft;  // For debugging: Record the last gasleft() value
    bool public success;         // For debugging: Success flag

    constructor(address _challenge6Address) {
        challenge6 = IChallenge6(_challenge6Address);
    }

    function solve() external {
        // Read the count value from Challenge6
        (bool success1, bytes memory countData) = address(challenge6).staticcall(
            abi.encodeWithSignature("count()")
        );
        require(success1, "Failed to get count");
        uint256 currentCount = abi.decode(countData, (uint256));

        // Calculate the correct code (count << 8)
        uint256 code = currentCount << 8;
        challenge6.mintFlag(code);
    }

    function solveWithGas(uint256 gasLimit) external {
        // Call mintFlag with the specified gas limit
        // Use assembly for precise gas control

        // Read the count value from Challenge6
        (bool success1, bytes memory countData) = address(challenge6).staticcall(
            abi.encodeWithSignature("count()")
        );
        require(success1, "Failed to get count");
        uint256 currentCount = abi.decode(countData, (uint256));

        // Calculate the correct code (count << 8)
        uint256 code = currentCount << 8;

        address target = address(challenge6);
        bytes memory data = abi.encodeWithSignature("mintFlag(uint256)", code);

        assembly {
            // Execute call with the gas specified by gasLimit
            let result := call(gasLimit, target, 0, add(data, 0x20), mload(data), 0, 0)
            // Record success/failure
            sstore(success.slot, result)
        }
    }

    function attack(uint256 code) external {
        challenge6.mintFlag(code);
    }

    // For debugging: Function to measure gasleft() with specific gas limit
    function measureGasWithLimit(uint256 gasLimit) external returns (uint256) {
        // Record gasleft() at the time this function is called
        uint256 gasAtStart = gasleft();

        // Read the count value from Challenge6
        (bool success1, bytes memory countData) = address(challenge6).staticcall(
            abi.encodeWithSignature("count()")
        );
        require(success1, "Failed to get count");
        uint256 currentCount = abi.decode(countData, (uint256));

        // Calculate the correct code (count << 8)
        uint256 code = currentCount << 8;

        // Call mintFlag with the specified gas limit
        address target = address(challenge6);
        bytes memory data = abi.encodeWithSignature("mintFlag(uint256)", code);

        assembly {
            // Execute call with the gas specified by gasLimit
            let result := call(gasLimit, target, 0, add(data, 0x20), mload(data), 0, 0)
            // Record success/failure
            sstore(success.slot, result)

            // Estimate gasleft() inside Challenge6's mintFlag
            // (gasLimit minus consumed gas approximates internal gasleft())
            let gasAfterCall := gas()
            let gasUsedInCall := sub(gasAtStart, gasAfterCall)

            // Estimated gasleft() value inside Challenge6
            let estimatedGasLeft := sub(gasLimit, 5000) // 5000 is estimated call overhead
            sstore(lastGasLeft.slot, estimatedGasLeft)
        }

        return lastGasLeft;
    }

    // For debugging: Function to measure gasleft()
    function measureGas() external returns (uint256) {
        lastGasLeft = gasleft();

        // Read the count value from Challenge6
        (bool success1, bytes memory countData) = address(challenge6).staticcall(
            abi.encodeWithSignature("count()")
        );
        require(success1, "Failed to get count");
        uint256 currentCount = abi.decode(countData, (uint256));

        // Calculate the correct code (count << 8)
        uint256 code = currentCount << 8;

        // Call Challenge6.mintFlag and measure gasleft()
        try challenge6.mintFlag(code) {
            success = true;
        } catch {
            success = false;
        }

        return lastGasLeft;
    }
}