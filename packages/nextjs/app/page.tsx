"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { FlagTracker } from "~~/components/FlagTracker";
import { Address } from "~~/components/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold">Scaffold-ETH 2</span>
            <span className="block text-xl font-bold">(BuidlGuidl CTF extension)</span>
          </h1>
          <div className="flex justify-center items-center space-x-2 flex-col sm:flex-row">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} />
          </div>

          <div className="mt-8 max-w-2xl mx-auto">
            <p className="text-base-content mb-4">
              This stack contains all the tools you need to play the CTF locally, from contract debugging to scripting
              and transaction tracking.
            </p>
            <p className="text-base-content">
              Once you&apos;re ready to capture real flags, you&apos;ll need to deploy your solutions to Optimism and
              track your progress at{" "}
              <a href="https://ctf.buidlguidl.com" target="_blank" rel="noopener noreferrer" className="link">
                ctf.buidlguidl.com
              </a>
              .
            </p>
            <p className="text-base text-base-content">
              For detailed setup instructions and deployment documentation, check out the{" "}
              <a
                href="https://github.com/BuidlGuidl/ctf.buidlguidl.com/tree/extension"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Readme
              </a>
            </p>
          </div>

          <div className="mt-8 max-w-2xl mx-auto">
            <div className="bg-base-100 p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-2xl font-bold mb-4">How to Play 🎮</h2>
              <div className="space-y-4">
                <p className="text-base">
                  1. You can use the{" "}
                  <Link href="/debug" className="link">
                    Debug Contracts
                  </Link>{" "}
                  tab to interact with the challenge contracts and the solutions you deploy
                </p>
                <p className="text-base">
                  2. Each challenge requires you to find a way to mint a flag NFT by solving smart contract puzzles
                </p>
                <p className="text-base">3. Track your progress below - there are 12 flags to capture!</p>
                <p className="text-base">
                  4. Apply your solutions to the live challenges on Optimism to capture real flags
                </p>
              </div>
            </div>
            <FlagTracker />
          </div>
        </div>

        <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
