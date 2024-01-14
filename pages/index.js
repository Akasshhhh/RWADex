import { BigNumber, ethers, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import styles from "../styles/Home.module.css";
import { addLiquidity, calculateCD } from "../utils/addLiquidity";
import {
  getCDTokensBalance,
  getEtherBalance,
  getLPTokensBalance,
  getReserveOfCDTokens,
} from "../utils/getAmounts";
import {
  getTokensAfterRemove,
  removeLiquidity,
} from "../utils/removeLiquidity";
import { swapTokens, getAmountOfTokensReceivedFromSwap } from "../utils/swap";
import { WRBNT_ABI, WRBNT_ADDRESS } from "../constants";
import toast from "react-hot-toast";

export default function Home() {

  const [valueOfCoin, setCoin] = useState("RUSD");

  /** General state variables */
  // loading is set to true when the transaction is mining and set to false when
  // the transaction has mined
  const [loading, setLoading] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false)
  const [swapTab, setSwapTab] = useState(true)
  const [signer, setSigner] = useState()
  const [wrapperContract, setWrapperContract] = useState(null)
  const [wrapAmount, setWrapAmount] = useState()
  const [mintValue, setMintValue] = useState("")
  const [burnValue, setBurnValue] = useState("")
  const [wrbntBalance, setWbrntBalance] = useState(0)
  const [RBNTSelected, setRBNTSelected] = useState("RBNT")
  // We have two tabs in this dapp, Liquidity Tab and Swap Tab. This variable
  // keeps track of which Tab the user is on. If it is set to true this means
  // that the user is on `liquidity` tab else he is on `swap` tab
  const [liquidityTab, setLiquidityTab] = useState(true);
  // This variable is the `0` number in form of a BigNumber
  const zero = BigNumber.from(0);
  /** Variables to keep track of amount */
  // `ethBalance` keeps track of the amount of Eth held by the user's account
  const [ethBalance, setEtherBalance] = useState(zero);
  // `reservedCD` keeps track of the rUSDs Reserve balance in the Exchange contract
  const [reservedCD, setReservedCD] = useState(zero);
  // Keeps track of the ether balance in the contract
  const [etherBalanceContract, setEtherBalanceContract] = useState(zero);
  // cdBalance is the amount of `CD` tokens help by the users account
  const [cdBalance, setCDBalance] = useState(zero);
  // `lpBalance` is the amount of LP tokens held by the users account
  const [lpBalance, setLPBalance] = useState(zero);
  /** Variables to keep track of liquidity to be added or removed */
  // addEther is the Amount of RBNT that the user wants to add to the liquidity
  const [addEther, setAddEther] = useState(zero);
  // addCDTokens keeps track of the amount of CD tokens that the user wants to add to the liquidity
  // in case when there is no initial liquidity and after liquidity gets added it keeps track of the
  // CD tokens that the user can add given a certain Amount of RBNT
  const [addCDTokens, setAddCDTokens] = useState(zero);
  // removeEther is the amount of `Ether` that would be sent back to the user based on a certain number of `LP` tokens
  const [removeEther, setRemoveEther] = useState(zero);
  // removeCD is the amount of `rUSD` tokens that would be sent back to the user based on a certain number of `LP` tokens
  // that he wants to withdraw
  const [removeCD, setRemoveCD] = useState(zero);
  // amount of LP tokens that the user wants to remove from liquidity
  const [removeLPTokens, setRemoveLPTokens] = useState("0");
  /** Variables to keep track of swap functionality */
  // Amount that the user wants to swap
  const [swapAmount, setSwapAmount] = useState("");
  // This keeps track of the number of tokens that the user would receive after a swap completes
  const [tokenToBeReceivedAfterSwap, settokenToBeReceivedAfterSwap] = useState(
    zero
  );
  // Keeps track of whether  `Eth` or `rUSD` token is selected. If `Eth` is selected it means that the user
  // wants to swap some `Eth` for some `rUSD` tokens and vice versa if `Eth` is not selected
  const [ethSelected, setEthSelected] = useState(true);
  /** Wallet connection */
  // Create a reference to the Web3 Modal (used for connecting to Metamask) which persists as long as the page is open
  const web3ModalRef = useRef();
  // walletConnected keep track of whether the user's wallet is connected or not
  const [walletConnected, setWalletConnected] = useState(false);


  const getAmounts = async () => {
    try {
      const provider = await getProviderOrSigner(false);
      const signer = await getProviderOrSigner(true);
      setSigner(signer)
      const address = await signer.getAddress();
      console.log(signer);
      console.log(address)
      // get the amount of eth in the user's account
      const _ethBalance = await getEtherBalance(provider, address);
      // get the amount of `rUSD` tokens held by the user
      const _cdBalance = await getCDTokensBalance(provider, address);
      // get the amount of `rUSD` LP tokens held by the user
      const _lpBalance = await getLPTokensBalance(provider, address);
      // gets the amount of `CD` tokens that are present in the reserve of the `Exchange contract`
      const _reservedCD = await getReserveOfCDTokens(provider);
      // Get the ether reserves in the contract
      const _ethBalanceContract = await getEtherBalance(provider, null, true);
      setEtherBalance(_ethBalance);
      setCDBalance(_cdBalance);
      setLPBalance(_lpBalance);
      setReservedCD(_reservedCD);
      setReservedCD(_reservedCD);
      setEtherBalanceContract(_ethBalanceContract);
    } catch (err) {
      console.error(err);
    }
  };


  const _swapTokens = async () => {
    try {
      // Convert the amount entered by the user to a BigNumber using the `parseEther` library from `ethers.js`
      const swapAmountWei = utils.parseEther(swapAmount);
      // Check if the user entered zero
      // We are here using the `eq` method from BigNumber class in `ethers.js`
      if (!swapAmountWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);
        // Call the swapTokens function from the `utils` folder
        await swapTokens(
          signer,
          swapAmountWei,
          tokenToBeReceivedAfterSwap,
          ethSelected
        );
        setLoading(false);
        // Get all the updated amounts after the swap
        await getAmounts();
        setSwapAmount("");
      }
      //Success
      setSwapSuccess(true);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setSwapAmount("");
    }
  };

  const _getAmountOfTokensReceivedFromSwap = async (_swapAmount) => {
    try {
      // Convert the amount entered by the user to a BigNumber using the `parseEther` library from `ethers.js`
      const _swapAmountWEI = utils.parseEther(_swapAmount.toString());
      // Check if the user entered zero
      // We are here using the `eq` method from BigNumber class in `ethers.js`
      if (!_swapAmountWEI.eq(zero)) {
        const provider = await getProviderOrSigner();
        // Get the Amount of RBNT in the contract
        const _ethBalance = await getEtherBalance(provider, null, true);
        // Call the `getAmountOfTokensReceivedFromSwap` from the utils folder
        const amountOfTokens = await getAmountOfTokensReceivedFromSwap(
          _swapAmountWEI,
          provider,
          ethSelected,
          _ethBalance,
          reservedCD
        );
        settokenToBeReceivedAfterSwap(amountOfTokens);
      } else {
        settokenToBeReceivedAfterSwap(zero);
      }
    } catch (err) {
      console.error(err);
    }
  };


  const connectWallet = async () => {
    try {
      // Get the provider from web3Modal, which in our case is MetaMask
      // When used for the first time, it prompts the user to connect their wallet
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (err) {
      console.error(err);
    }
  };

  const getProviderOrSigner = async (needSigner = false) => {
    // Connect to Metamask
    // Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    // If user is not connected to the Rinkeby network, let them know and throw an error
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 152) {
      window.alert("Change the network to RedbellyDevNet");
      throw new Error("Change network to RedbellyDevNet");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      console.log(signer)
      return signer;
    }
    return web3Provider;
  };

  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "goerli",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getAmounts();
    } 
    else {
      getAmounts();
      handleWrapperButton()
      fetchWRBNTBalance()
    }
  }, [walletConnected,mintValue,RBNTSelected]);

  const handleWrapperButton = async () => {
    try {
      const provider = new providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      await fetchWRBNTBalance()
      // Check if any account is connected
      if (accounts.length > 0) {
        // Now you have the connected wallet address (connectedAddress)
        const wrapperContract = new ethers.Contract(WRBNT_ADDRESS, WRBNT_ABI, signer)
        setWrapperContract(wrapperContract)
        console.log(wrapperContract)
      } else {
        console.log("No wallet connected");
        // No wallet is connected
      }
    } catch (error) {
      console.error("Error checking connected wallet:", error);
      // Handle errors
    }
  };

  const fetchWRBNTBalance = async () => {
    try {
      const address = await wrapperContract.signer.getAddress();
      const balance = await wrapperContract.balanceOf(address);
      setWbrntBalance(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const handleMint = async (e) => {

    const amountTomint = ethers.utils.parseEther(mintValue)
    try {
      const tx = await wrapperContract.mint({ value: amountTomint })
      await tx.wait();
      setMintValue("")
      console.log("Mint transaction successful")
      fetchWRBNTBalance()
      toast.success("Mint successful")
    } catch (e) {
      console.log("Execution error")
      console.log(e)
    }
  }

  const handleBurn = async (e) => {
    const amountToRBNT = ethers.utils.parseEther(mintValue)
    try {
      const tx = await wrapperContract.burn(amountToRBNT)
      await tx.wait()
      setMintValue("")
      fetchWRBNTBalance()
      toast.success("Unwrapped Successfully")
    } catch (e) {
      console.log("Burn failed")
      console.log(e)
    }
  }

  const handleInputChange = (e) => {
    setMintValue(e.target.value)
  }

  const handleWrap = async () => {
    if (RBNTSelected === "RBNT") {
      await handleMint()
    }
    if (RBNTSelected === "WRBNT") {
      await handleBurn()
    }

    await fetchWRBNTBalance();
  }


  return (

    <div className="w-[100%] h-[100vh] ">


      <div className="flex-col ">
        <div className=" flex pt-10 mx-20 ">
          <button className="p-1 rounded-xl border-2 border-purple-600">

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-14 h-14 text-purple-600  ">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
            </svg>
          </button>
          {walletConnected ? <p className="p-5   ml-auto text-xl bg-pink-600 text-white font-semibold rounded-3xl border-black border-[1px]">Connected</p> : <button onClick={connectWallet} className="px-5   ml-auto text-xl bg-pink-600 text-white font-semibold rounded-3xl border-black border-[1px]">Connect wallet</button>}

        </div>

        <div className="flex-col [&>*]:flex gap-10 [&>*]:justify-center ">
          <p className="text-4xl font-extrabold text-white">RWADex</p>
          <p className="text-xl font-semibold  text-white">Exchange token in seconds</p>
          <div className="flex items-center justify-center mt-5 gap-10 font-bold text-white text-xl border-2 border-[#581C87] w-64 rounded-lg bg-[#581C87] mx-auto">
            <button onClick={() => setSwapTab(true)}>Swap</button>
            <p className=" h-10 w-1 text-white bg-white"></p>
            <button onClick={() => {
              setSwapTab(false)
              handleWrapperButton()
            }}>Wrap</button>

          </div>
          <div className="  flex justify-center align-middle">
            {!walletConnected &&
              <div className="flex-col border-2 border-purple-900 mt-10 rounded-2xl p-32">
                <button className="p-3 px-10  bg-white rounded-2xl font-bold w-[100%]  text-black  text-2xl">Swap</button>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-40 text-white ml-7 h-40 ">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
                <p className="font-semibold text-2xl text-white" >Connect your wallet.</p>
              </div>
            }

            {walletConnected && swapTab &&
              <div className="flex-col border-2 border-purple-900 p-10 [&>div]:p-5 mt-10 rounded-2xl">
                <div className="flex-col">
                  <div className="flex ">
                    <input onChange={async (e) => {
                      setSwapAmount(e.target.value || "");
                      // Calculate the amount of tokens user would receive after the swap
                      await _getAmountOfTokensReceivedFromSwap(e.target.value || "0");
                    }}
                      className="outline-none  p-5 bg-[rgb(35,33,48)]  text-white px-10 text-2xl rounded-l-lg" type="number" placeholder="0.0" />
                    <select

                      onChange={async (e) => {
                        setEthSelected(!ethSelected);
                        // Initialize the values back to zero
                        await _getAmountOfTokensReceivedFromSwap(0);
                        setSwapAmount("");
                        setCoin(e.target.value)
                      }}
                      className="bg-[rgb(35,33,48)] text-white font-semibold outline-none px-2">
                      <option value={"RUSD"}>RBNT</option>
                      <option value={"RBNT"}>RUSD</option>
                    </select>
                  </div>
                  <p className="text-white font-semibold mx-3 my-2">Balance: {valueOfCoin === "RBNT" ? utils.formatEther(cdBalance) :utils.formatEther(ethBalance)} </p>
                </div>
                <div className="flex-col ">
                  <div className="flex">
                    <input
                      value={utils.formatEther(tokenToBeReceivedAfterSwap)}

                      className="bg-[rgb(35,33,48)] text-white outline-none p-5 px-10 text-2xl rounded-l-lg " placeholder="0.0" />
                    <select className="bg-[rgb(35,33,48)] text-white font-semibold outline-none px-2">
                      <option value={valueOfCoin === "RUSD" ? "RBNT" : "RUSD"}>{valueOfCoin === "RUSD" ? "RUSD" : "RBNT"}</option>
                    </select>
                  </div>
                  <p className="text-white font-semibold mx-3 my-2">Balance: {valueOfCoin === "RBNT" ? utils.formatEther(ethBalance) : utils.formatEther(cdBalance)}</p>
                </div>

                <button onClick={_swapTokens} className="py-2  w-[100%]  bg-white rounded-2xl font-bold   text-black  text-xl">Swap</button>

                {swapSuccess ? <p className="text-white font-semibold text-xl text-center mt-4">Swap executed Successfully!</p> : <></>}
              </div>
            }

            {
              walletConnected && !swapTab &&
              <div className="flex-col border-2 border-purple-900 p-10 [&>div]:p-5 mt-10 rounded-2xl" >
                <div className=" flex flex-col">
                  <div className="flex">
                    <input placeholder="RBNT" className="outline-none min-w-[347px]  p-5 bg-[rgb(35,33,48)]  text-white px-10 text-2xl rounded-l-lg" type='number' value={mintValue} onChange={handleInputChange} />
                    <select onChange={(e) => { setRBNTSelected(e.target.value) }} className="bg-[rgb(35,33,48)] text-white font-semibold outline-none px-2">
                      <option value={"RBNT"}>RBNT</option>
                      <option value={"WRBNT"}>WRBNT</option>
                    </select>
                  </div>
                  <p className="text-white font-semibold mx-3 my-2">Balance: {RBNTSelected === "RBNT" ? utils.formatEther(ethBalance) : utils.formatEther(wrbntBalance)}</p>
                </div>
                <div className=" flex flex-col">
                  <div className="flex">
                    <input placeholder="WRBNT" className="outline-none min-w-[358px] p-5 bg-[rgb(35,33,48)]  text-white px-10 text-2xl rounded-l-lg" type="number" value={mintValue} onChange={handleInputChange} />
                    <p className="bg-[rgb(35,33,48)] text-white font-semibold outline-none px-5 flex items-center">{RBNTSelected === 'RBNT' ? "WRBNT" : "RBNT"}</p>
                  </div>
                  <p className="text-white font-semibold mx-3 my-2">Balance: {RBNTSelected === "RBNT" ? utils.formatEther(wrbntBalance) : utils.formatEther(ethBalance)}</p>
                </div>
                <button onClick={handleWrap} className="py-2 hover:bg-purple-200  w-[100%]  bg-white rounded-2xl font-bold   text-black  text-xl">{RBNTSelected === "RBNT" ? "Wrap" : "Unwrap"}</button>

              </div>
            }

          </div>

        </div>
      </div>

    </div>

  );
}