import { signAndSubmitTx } from "./xrpl/tx";
import { getXrplChainConfig } from "./common/chains";
import { getWallet } from "./xrpl/wallet";
import xrpl from "xrpl";

const tokenSymbol = process.argv[2] || "SQD";
const amount = process.argv[3] || "10000";
const xrplWalletSeed = process.env.XRPL_SEED || "";

const wallet = getWallet({
  walletKeyType: xrpl.ECDSA.secp256k1,
  privateKey: xrplWalletSeed,
});

const xrplChainConfig = await getXrplChainConfig();
const issuer = xrplChainConfig.config.contracts.InterchainTokenService.address;

const rpcUrl = "wss://s.altnet.rippletest.net:51233";
const client = new xrpl.Client(rpcUrl);

// Connect to the WSS server
await client.connect();

const tx = await signAndSubmitTx(client, wallet, {
  TransactionType: "TrustSet",
  Account: wallet.address,
  LimitAmount: {
    currency: tokenSymbol,
    issuer,
    value: amount,
  },
});

console.log("Submitted Transaction", tx.result.tx_json.hash);

// Disconnect from the WSS server
await client.disconnect();
