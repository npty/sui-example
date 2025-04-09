import { getXrplChainConfig } from "./common/chains";
import { signAndSubmitTx } from "./xrpl/tx";
import { getBalance, hex, parseToken } from "./xrpl/utils";
import { fundWallet, getWallet } from "./xrpl/wallet";
import xrpl from "xrpl";

// rpc url for xrpl testnet
const rpcUrl = "wss://s.altnet.rippletest.net:51233";
const destinationAddress =
  process.argv[2] || "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const transferAmount = process.argv[3] || "0.1";
const privateKey = process.env.XRPL_PRIVATE_KEY || "";

// Input validations
if (!privateKey) {
  throw new Error("XRPL_PRIVATE_KEY is not set");
}
if (!destinationAddress) {
  throw new Error("Invalid destination address");
}
if (!transferAmount) {
  throw new Error("Invalid transfer amount");
}

const wallet = getWallet({
  walletKeyType: xrpl.ECDSA.secp256k1,
  privateKey,
});

console.log("Wallet Address:", wallet.address);

const client = new xrpl.Client(rpcUrl);
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
  console.log("Wallet Balance:", balance);
}

// Get axelar chain config from s3
const xrplChainConfig = await getXrplChainConfig();

const response = await signAndSubmitTx(client, wallet, {
  PaymentType: "Payment",
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
      memoData: hex("ethereum-sepolia"),
    },
    {
      memoType: hex("gas_fee_amount"),
      memoData: hex("3000000"),
    },
    {
      memoType: hex("payload"),
      memoData: hex("0x"),
    },
  ],
});

console.log("Submitted Transaction", response.result.tx_json.hash);

await client.disconnect();
