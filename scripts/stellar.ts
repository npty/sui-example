import { Asset } from "@stellar/stellar-sdk";
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
import { getAxelarscanLink } from "common/axelarscan";
import { Client } from "@stellar/stellar-sdk/minimal/contract";

// --- Constants ---
const DESTINATION_CHAIN: string = process.argv[2] || "sui";
const DESTINATION_ADDRESS =
  process.argv[3] ||
  "0xba353a510d8a1174b37c31e6eab6e2d6d93cdb31cd093efdd30c177853533ab0";

// number of SQD tokens to send
const UNIT_AMOUNT = parseUnits(process.argv[4] || "1", 9);

console.log("Environment:", environment);
console.log("Destination Chain:", DESTINATION_CHAIN);
console.log("Destination Address:", DESTINATION_ADDRESS);
console.log("Send Amount:", formatUnits(UNIT_AMOUNT, 9));

// SQD token
const TOKEN_ADDRESS =
  "CDBBR6BVVZO32NMFCJJWRJFTKV3QQ2ZLITKKGINP2ONUQCTK7PCT4M3W";
const ITS_TOKEN_ID =
  "0x42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c";

const networkPassphrase =
  environment === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

const stellarChainConfig = await getChainConfig("stellar");
const destinationChainConfig = await getChainConfig(DESTINATION_CHAIN);
const server = new rpc.Server(stellarChainConfig.config.rpc[0]);

const wallet = getWallet();
const walletAddress = wallet.publicKey();
console.log("Sender Wallet Address:", walletAddress);

// TODO: Check for the XLM and SQD balance
const balances = await getBalances(walletAddress);
const xlmBalance = balances.find((balance) => balance.asset_type === "native");
console.log("XLM Balance:", xlmBalance?.balance);
const sqdContract = (await Client.from({
  contractId: TOKEN_ADDRESS,
  networkPassphrase,
  rpcUrl: stellarChainConfig.config.rpc[0],
})) as any;

const { result: balance } = await sqdContract.balance({
  id: walletAddress,
});
console.log("SQD Balance:", formatUnits(balance, 9));

// --- Main Execution ---
const gasFee = await calculateEstimatedFee(
  stellarChainConfig.id,
  destinationChainConfig
);

console.log("Gas Fee:", formatUnits(gasFee, 7), "XLM");

const contractId =
  stellarChainConfig.config.contracts.InterchainTokenService.address;
const contract = new Contract(contractId);
const caller = addressToScVal(wallet.publicKey());
const account = await server.getAccount(walletAddress);

// XLM contract address
// It's the soroban contract here https://stellar.expert/explorer/testnet/asset/XLM
const gasTokenAddress =
  environment === "testnet"
    ? "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    : "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

const operation = contract.call(
  "interchain_transfer",
  caller,
  hexToScVal(ITS_TOKEN_ID),
  nativeToScVal(DESTINATION_CHAIN, { type: "string" }),
  hexToScVal(DESTINATION_ADDRESS),
  nativeToScVal(UNIT_AMOUNT, { type: "i128" }),
  nativeToScVal(null, { type: "null" }),
  tokenToScVal(gasTokenAddress, parseInt(gasFee))
);

const builtTransaction = new TransactionBuilder(account, {
  fee: BASE_FEE,
  networkPassphrase,
})
  .addOperation(operation)
  .setTimeout(30)
  .build();

const prepareTransaction = await server.prepareTransaction(builtTransaction);

prepareTransaction.sign(wallet);

const txReceipt = await server.sendTransaction(prepareTransaction);

const tx = await waitForTransaction(server, txReceipt.hash);

console.log("Transaction Hash:", tx.txHash);

// the transaction index for ITS transfer is 4. this can be verified by checking the index of "contract_called" event from the block explorer.
console.log("Axelarscan Link:", getAxelarscanLink(`0x${tx.txHash}`, 4));
