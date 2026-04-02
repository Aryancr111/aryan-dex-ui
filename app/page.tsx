'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const DEX1 = "0xcA03dCFfa1DA5CcE60713a8c410882CCA01d935A";
const DEX2 = "0x6fcE2ade5fFB1CA0B2094e58dED18a6A4Cf95823";
const TOKENA = "0x4e2FC1DAbF303B1051FB45eE676f2854b03E2a1F";
const TOKENB = "0x1faA21bDfA7EcB554438c564eb4a4DD0Bbceb405";

export default function DEXUI() {
  const [account, setAccount] = useState("");
  const [dexAddress, setDexAddress] = useState(DEX1);

  const [reserves, setReserves] = useState({ a: 0n, b: 0n });
  const [spotPrice, setSpotPrice] = useState("0.0000");

  const [liqAmountA, setLiqAmountA] = useState("");
  const [liqAmountB, setLiqAmountB] = useState("");

  const [swapAmountA, setSwapAmountA] = useState("");
  const [expectedOut, setExpectedOut] = useState("0");

  const [removeAmount, setRemoveAmount] = useState("");

  const [loading, setLoading] = useState(false);

  // Connect Wallet
  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    setAccount(await signer.getAddress());
  };

  // Fetch pool data
  const fetchPoolData = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const dex = new ethers.Contract(
        dexAddress,
        [
          "function getReserves() view returns (uint256, uint256)",
          "function getSpotPrice() view returns (uint256)"
        ],
        provider
      );

      const [resA, resB] = await dex.getReserves();
      const price = await dex.getSpotPrice();

      setReserves({ a: resA, b: resB });
      setSpotPrice((Number(price) / 1e18).toFixed(4));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (account) fetchPoolData();
  }, [account, dexAddress]);

  // Ratio logic fix for adding liquidity
  useEffect(() => {
    // First liquidity if testing removal allow manual input
    if (reserves.a === 0n && reserves.b === 0n) {
      return;
    }

    // Normal case to calculate to maintain ratio
    if (!liqAmountA) {
      setLiqAmountB("");
      return;
    }

    try {
      const amtAWei = ethers.parseEther(liqAmountA);
      const amtBWei = (amtAWei * reserves.b) / reserves.a ;
      setLiqAmountB(ethers.formatEther(amtBWei));
    } catch {
      setLiqAmountB("");
    }
  }, [liqAmountA, reserves]);

  // Swap preview
  useEffect(() => {
    if (!swapAmountA || reserves.a === 0n) {
      setExpectedOut("0");
      return;
    }

    try {
      const amtA = ethers.parseEther(swapAmountA);

      const amountInWithFee = amtA * 997n;
      const numerator = amountInWithFee * reserves.b;
      const denominator = (reserves.a * 1000n) + amountInWithFee;

      const out = numerator / denominator;

      setExpectedOut(ethers.formatEther(out));
    } catch {
      setExpectedOut("0");
    }
  }, [swapAmountA, reserves]);

  // Mint tokens
  const mintTokens = async () => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tokenA = new ethers.Contract(TOKENA, ["function mint(address,uint256)"], signer);
      const tokenB = new ethers.Contract(TOKENB, ["function mint(address,uint256)"], signer);

      await (await tokenA.mint(account, ethers.parseEther("10000"))).wait();
      await (await tokenB.mint(account, ethers.parseEther("10000"))).wait();

      alert("✅ Minted tokens");
      fetchPoolData();
    } catch {
      alert("Mint failed");
    }
    setLoading(false);
  };

  // Add liquidity
  const addLiquidity = async () => {
    if (!liqAmountA || !liqAmountB) return alert("Enter amounts");

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tokenA = new ethers.Contract(TOKENA, ["function approve(address,uint256)"], signer);
      const tokenB = new ethers.Contract(TOKENB, ["function approve(address,uint256)"], signer);
      const dex = new ethers.Contract(dexAddress, ["function addLiquidity(uint256,uint256)"], signer);

      const amtA = ethers.parseEther(liqAmountA);
      const amtB = ethers.parseEther(liqAmountB);

      await (await tokenA.approve(dexAddress, amtA)).wait();
      await (await tokenB.approve(dexAddress, amtB)).wait();

      await (await dex.addLiquidity(amtA, amtB)).wait();

      alert("✅ Liquidity added");
      setLiqAmountA("");
      setLiqAmountB("");
      fetchPoolData();
    } catch {
      alert("❌ Ratio mismatch");
    }
    setLoading(false);
  };

  // Swap
  const swapAForB = async () => {
    if (!swapAmountA) return;

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tokenA = new ethers.Contract(TOKENA, ["function approve(address,uint256)"], signer);
      const dex = new ethers.Contract(dexAddress, ["function swapAForB(uint256)"], signer);

      const amt = ethers.parseEther(swapAmountA);

      await (await tokenA.approve(dexAddress, amt)).wait();
      await (await dex.swapAForB(amt)).wait();

      alert("✅ Swap done");
      setSwapAmountA("");
      fetchPoolData();
    } catch {
      alert("Swap failed");
    }
    setLoading(false);
  };

  // Remove liquidity
  const removeLiquidity = async () => {
    if (!removeAmount) return alert("Enter LP amount");

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const dex = new ethers.Contract(
        dexAddress,
        ["function removeLiquidity(uint256)"],
        signer
      );

      const amt = ethers.parseEther(removeAmount);

      await (await dex.removeLiquidity(amt)).wait();

      alert("✅ Liquidity removed!");
      setRemoveAmount("");
      fetchPoolData();
    } catch {
      alert("Remove failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        <h1 className="text-5xl font-bold text-center">DEX UI</h1>

        {!account ? (
          <button onClick={connectWallet} className="bg-blue-600 w-full py-4 rounded-2xl">
            Connect Wallet
          </button>
        ) : (
          <>
            <div className="bg-gray-900 p-4 rounded text-center break-all">{account}</div>

            <select
              value={dexAddress}
              onChange={(e) => setDexAddress(e.target.value)}
              className="w-full p-3 bg-gray-800 rounded"
            >
              <option value={DEX1}>DEX 1</option>
              <option value={DEX2}>DEX 2</option>
            </select>

            <button onClick={mintTokens} className="bg-yellow-600 w-full py-2 rounded">
              Mint Tokens
            </button>

            <div className="bg-gray-900 p-4 rounded">
              <p>Reserve A: {ethers.formatEther(reserves.a)}</p>
              <p>Reserve B: {ethers.formatEther(reserves.b)}</p>
              <p>Price: {spotPrice}</p>
            </div>

            {/* ADD LIQ */}
            <div className="bg-gray-900 p-4 rounded space-y-2">
              {reserves.a === 0n && (
                <p className="text-yellow-400 text-sm">
                  Set initial price (TokenA : TokenB)
                </p>
              )}

              <input
                placeholder="TokenA"
                value={liqAmountA}
                onChange={(e) => setLiqAmountA(e.target.value)}
                className="w-full p-2 bg-gray-800"
              />

              <input
                placeholder={reserves.a === 0n ? "Enter TokenB" : ""}
                value={liqAmountB}
                onChange={(e) => {
                  if (reserves.a === 0n) {
                    setLiqAmountB(e.target.value);
                  }
                }}
                readOnly={reserves.a !== 0n}
                className="w-full p-2 bg-gray-700"
              />

              <button onClick={addLiquidity} className="bg-green-600 w-full py-2">
                Add Liquidity
              </button>
            </div>

            {/* REMOVE LIQ */}
            <div className="bg-gray-900 p-4 rounded space-y-2">
              <input
                placeholder="LP tokens to remove"
                value={removeAmount}
                onChange={(e) => setRemoveAmount(e.target.value)}
                className="w-full p-2 bg-gray-800"
              />
              <button onClick={removeLiquidity} className="bg-red-600 w-full py-2">
                Remove Liquidity
              </button>
            </div>

            {/* SWAP */}
            <div className="bg-gray-900 p-4 rounded space-y-2">
              <input
                placeholder="Swap A"
                value={swapAmountA}
                onChange={(e) => setSwapAmountA(e.target.value)}
                className="w-full p-2 bg-gray-800"
              />
              <p>Expected B: {expectedOut}</p>
              <button onClick={swapAForB} className="bg-purple-600 w-full py-2">
                Swap
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}