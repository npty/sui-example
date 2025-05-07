import {} from "@stellar/stellar-sdk";
import { getChainConfig } from "common/chains";
import { formatUnits, parseUnits } from "ethers";
import { getWallet } from "stellar/wallet";
import {
  TransactionBuilder,
  Contract,
  nativeToScVal,
  rpc,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";
import {
  addressToScVal,
  getBalances,
  hexToScVal,
  tokenToScVal,
  waitForTransaction,
} from "stellar/utils";
import { calculateEstimatedFee } from "common/gasEstimation";
import { environment } from "common/env";

// --- Constants ---
const DESTINATION_CHAIN: string = process.argv[2] || "sui";
const DESTINATION_ADDRESS =
  process.argv[3] ||
  "0xba353a510d8a1174b37c31e6eab6e2d6d93cdb31cd093efdd30c177853533ab0";
const UNIT_AMOUNT = parseUnits(process.argv[4] || "1", 9);

console.log("Environment:", environment);

// SQD token
// const TOKEN_ADDRESS =
// "CDBBR6BVVZO32NMFCJJWRJFTKV3QQ2ZLITKKGINP2ONUQCTK7PCT4M3W";
const ITS_TOKEN_ID =
  "0x42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c";

const wallet = getWallet();
const walletAddress = wallet.publicKey();
console.log("Wallet Address:", walletAddress);

// TODO: Check for the XLM and SQD balance
const balances = await getBalances(walletAddress);
console.log("Balances:", balances);

// --- Main Execution ---
const stellarChainConfig = await getChainConfig("stellar");
const destinationChainConfig = await getChainConfig(DESTINATION_CHAIN);

const gasFee = await calculateEstimatedFee(
  stellarChainConfig.id,
  destinationChainConfig
);

console.log("Gas Fee:", formatUnits(gasFee, 7), "XLM");

const server = new rpc.Server(stellarChainConfig.config.rpc[0]);
const contractId =
  stellarChainConfig.config.contracts.InterchainTokenService.address;
const contract = new Contract(contractId);
const caller = addressToScVal(wallet.publicKey());
const account = await server.getAccount(walletAddress);

// TODO: retrieve the gas token dynamically
const gasTokenAddress =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const operation = contract.call(
  "interchain_transfer",
  caller,
  hexToScVal(ITS_TOKEN_ID),
  nativeToScVal(DESTINATION_CHAIN, { type: "string" }),
  hexToScVal(DESTINATION_ADDRESS),
  nativeToScVal(UNIT_AMOUNT, { type: "i128" }),
  nativeToScVal(null, { type: "null" }),
  tokenToScVal(gasTokenAddress, 1e7)
);

const builtTransaction = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase:
    environment === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
})
  .addOperation(operation)
  .setTimeout(30)
  .build();

const prepareTransaction = await server.prepareTransaction(builtTransaction);

prepareTransaction.sign(wallet);

const txReceipt = await server.sendTransaction(prepareTransaction);

const tx = await waitForTransaction(server, txReceipt.hash);

console.log("Transaction Hash:", tx.txHash);
