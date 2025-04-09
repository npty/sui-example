import { formatUnits } from "ethers";
import { getXrplChainConfig } from "./common/chains";
import { calculateEstimatedFee } from "./common/gasEstimation";
import { signAndSubmitTx } from "./xrpl/tx";
import { getBalance, hex, parseToken } from "./xrpl/utils";
import { fundWallet, getWallet } from "./xrpl/wallet";
import xrpl from "xrpl";

// Parse command line arguments
const destinationAddress =
  process.argv[2] || "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const destinationChain = process.argv[3] || "ethereum-sepolia";
const transferAmount = process.argv[4] || "0.1";
const xrplWalletSeed = process.env.XRPL_SEED || "";

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

const balance = await getBalance(client, wallet.address);

console.log("Wallet Balance:", xrpl.dropsToXrp(balance), "XRP");

// Fund wallet if balance is less than transfer amount
if (parseInt(balance) < parseInt(parseToken("XRP", transferAmount))) {
  console.log("Balance too low, funding wallet with 100 XRP...");

  // Fund wallet with 100 XRP
  await fundWallet(client, wallet);

  // Check the updated balance
  const balance = await getBalance(client, wallet.address);
  console.log("Wallet Balance:", xrpl.dropsToXrp(balance), "XRP");
}

// Get axelar chain config from s3
const xrplChainConfig = await getXrplChainConfig();

// Estimate the fee
const fee = await calculateEstimatedFee(xrplChainConfig.id, destinationChain);
console.log("Estimated Fee:", `${xrpl.dropsToXrp(fee)} XRP`);
console.log("Send Amount:", `${transferAmount} XRP`);

const response = await signAndSubmitTx(client, wallet, {
  TransactionType: "Payment",
  Account: wallet.address,
  Destination: xrplChainConfig.config.contracts.InterchainTokenService.address,
  Amount: parseToken("XRP", transferAmount),
  memos: [
    {
      memoType: hex("type"),
      memoData: hex("interchain_transfer"),
    },
    {
      memoType: hex("destination_address"),
      memoData: hex(destinationAddress.replace("0x", "")),
    },
    {
      memoType: hex("destination_chain"),
      memoData: hex(destinationChain),
    },
    {
      memoType: hex("gas_fee_amount"),
      memoData: hex(fee.toString()),
    },
    {
      memoType: hex("payload"),
      memoData: hex("0x"),
    },
  ],
});

console.log("Submitted Transaction", response.result.tx_json.hash);

// Disconnect from the WSS server
await client.disconnect();
