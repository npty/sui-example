import { getXrplChainConfig } from "./common/chains";
import { calculateEstimatedFee } from "./common/gasEstimation";
import { signAndSubmitTx } from "./xrpl/tx";
import { getBalances, hex, parseToken } from "./xrpl/utils";
import { fundWallet, getWallet } from "./xrpl/wallet";
import xrpl from "xrpl";
import { environment } from "./common/env";

// Parse command line arguments
const destinationAddress =
  process.argv[2] || "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const destinationChain = process.argv[3] || "ethereum-sepolia";
const tokenSymbol = process.argv[4] || "SQD";
const transferAmount = process.argv[5] || "1";
const xrplWalletSeed = process.env.XRPL_SEED || "";

console.log("Environment:", environment);

// Input validations
if (!xrplWalletSeed) {
  throw new Error("XRPL_SEED is not set");
}
if (!destinationChain) {
  throw new Error("Invalid destination chain");
}
if (!destinationAddress) {
  throw new Error("Invalid destination address");
}
if (!transferAmount) {
  throw new Error("Invalid transfer amount");
}

// Get axelar chain config from s3
const xrplChainConfig = await getXrplChainConfig();

const itsContractAddress =
  xrplChainConfig.config.contracts.InterchainTokenService.address;

const normalizedTokenSymbol =
  tokenSymbol === "XRP" ? "XRP" : `${tokenSymbol}.${itsContractAddress}`;

const wallet = getWallet({
  walletKeyType: xrpl.ECDSA.secp256k1,
  privateKey: xrplWalletSeed,
});

console.log("Wallet Address:", wallet.address);

// RPC url for xrpl testnet
const rpcUrl = "wss://s.altnet.rippletest.net:51233";
const client = new xrpl.Client(rpcUrl);

// Connect to the WSS server
await client.connect();

const balances = await getBalances(
  client,
  wallet.address,
  itsContractAddress,
).catch(() => [
  {
    symbol: "XRP",
    value: "0",
  },
]);

const [xrpBalance, ...otherBalances] = balances;

console.log("XRP Balance:", xrpl.dropsToXrp(xrpBalance.value), "XRP");

// Print other ITS token balances that held by the wallet
for (const balance of otherBalances) {
  console.log(`${balance.symbol} Balance:`, balance.value, balance.symbol);
}

// Fund wallet if balance is less than transfer amount
if (parseInt(xrpBalance.value) < 5) {
  console.log("Balance too low, funding wallet with 100 XRP...");

  // Fund wallet with 100 XRP
  await fundWallet(client, wallet);

  // Check the updated balance
  const [updatedXrpBalance] = await getBalances(
    client,
    wallet.address,
    itsContractAddress,
  );
  console.log("XRP Balance:", xrpl.dropsToXrp(updatedXrpBalance.value), "XRP");
}

// Estimate the fee
const fee = await calculateEstimatedFee(xrplChainConfig.id, destinationChain);
console.log("Estimated Fee:", `${xrpl.dropsToXrp(fee)} XRP`);
console.log("Send Amount:", `${transferAmount} ${tokenSymbol}`);

const response = await signAndSubmitTx(client, wallet, {
  TransactionType: "Payment",
  Account: wallet.address,
  Destination: itsContractAddress,
  Amount: parseToken(normalizedTokenSymbol, transferAmount),
  Memos: [
    {
      Memo: {
        MemoType: hex("type"),
        MemoData: hex("interchain_transfer"),
      },
    },
    {
      Memo: {
        MemoType: hex("destination_address"),
        MemoData: hex(destinationAddress.replace("0x", "")),
      },
    },
    {
      Memo: {
        MemoType: hex("destination_chain"),
        MemoData: hex(destinationChain),
      },
    },
    {
      Memo: {
        MemoType: hex("gas_fee_amount"),
        MemoData: hex("1"), // hardcoded for now
      },
    },
    // {
    //   Memo: {
    //     MemoType: hex("payload"),
    //     MemoData: hex("0x"),
    //   },
    // },
  ],
});

console.log("Submitted Transaction", response.result.tx_json.hash);

// Disconnect from the WSS server
await client.disconnect();
