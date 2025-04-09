import { ethers } from "ethers";
import { getXrplChainConfig } from "./common/chains";
import { signAndSubmitTx } from "./xrpl/tx";
import { getBalance, hex, parseToken } from "./xrpl/utils";
import { fundWallet, getWallet } from "./xrpl/wallet";
import xrpl from "xrpl";

const privateKey = process.env.XRPL_PRIVATE_KEY || "";
if (!privateKey) {
  throw new Error("XRPL_PRIVATE_KEY is not set");
}

const rpcUrl = "wss://s.altnet.rippletest.net:51233";
const transferAmount = "1";
const client = new xrpl.Client(rpcUrl);

const wallet = getWallet({
  walletKeyType: xrpl.ECDSA.secp256k1,
  privateKey,
});

console.log("Wallet Address:", wallet.address);

await client.connect();

const balance = await getBalance(client, wallet.address);

console.log("Wallet Balance:", ethers.formatUnits(balance.balance, 6), "XRP");

if (balance.balance === "0") {
  console.log("Balance too low, funding wallet...");
  await fundWallet(client, wallet);
  const balance = await getBalance(client, wallet.address);
  console.log("Wallet Balance:", balance.balance);
}

const xrplChainConfig = await getXrplChainConfig();

const response = await signAndSubmitTx(client, wallet, "Payment", {
  Destination: xrplChainConfig.config.contracts.InterchainTokenService.address,
  Amount: parseToken("XRP", transferAmount),
  memos: [
    {
      memoType: hex("type"),
      memoData: hex("interchain_transfer"),
    },
    {
      memoType: hex("destination_address"),
      memoData: hex(
        "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2".replace("0x", ""),
      ),
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
