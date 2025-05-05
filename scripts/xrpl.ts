import { getChainConfig, getXrplChainConfig } from "common/chains";
import { calculateEstimatedFee } from "common/gasEstimation";
import { signAndSubmitTx } from "xrpl/tx";
import { getBalances, hex, parseToken } from "xrpl/utils";
import { fundWallet, getWallet } from "xrpl/wallet";
import xrpl from "xrpl";
import { environment } from "common/env";
import { AbiCoder, concat, getBytes, hexlify, randomBytes } from "ethers";

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
const chainConfigs = await getChainConfig();

const destinationChainType = chainConfigs.chains[destinationChain].chainType;
let payload;

const isEvmDestination = destinationChainType === "evm";

if (isEvmDestination) {
  const squidPayload = AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes32"],
    [destinationAddress, hexlify(randomBytes(32))]
  );
  const metadataVersionBytes = hexlify("0x");

  payload = concat([getBytes(metadataVersionBytes), getBytes(squidPayload)]);
}

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
  itsContractAddress
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
    itsContractAddress
  );
  console.log("XRP Balance:", xrpl.dropsToXrp(updatedXrpBalance.value), "XRP");
}

const squidEvmContractAddress = "0x9bEb991eDdF92528E6342Ec5f7B0846C24cbaB58";

// Estimate the fee The token to pay for gas fees will be the same as the token to be transferred. This is different from other chains.
// The xrpl team has hardcoded the gas fee token for testnet as follows:
// a384dc638c897bc6a0d43d8461dd21fe3aaab53d75f46a7c90de871f9eed8407: 8.98  # WAVAX
// c8895f8ceb0cae9da15bb9d2bc5859a184ca0f61c88560488355c8a7364deef8: 1.00  # FOO
// 42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c: 1.00  # SQD
// 61d56768967a50c3f05f6ec710f7fb92824d73842796efd55dd157d98d68bf87: 775.0 # WETH
let fee = "1";
if (tokenSymbol === "XRP") {
  fee = await calculateEstimatedFee(xrplChainConfig.id, destinationChain);
  console.log("Estimated Fee:", `${xrpl.dropsToXrp(fee)} XRP`);
}

console.log("Send Amount:", `${transferAmount} ${tokenSymbol}`);

const Memos = [
  {
    Memo: {
      MemoType: hex("type"),
      MemoData: hex("interchain_transfer"),
    },
  },
  {
    Memo: {
      MemoType: hex("destination_address"),
      MemoData: hex(
        (isEvmDestination
          ? squidEvmContractAddress
          : destinationAddress
        ).replace("0x", "")
      ),
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
      MemoData: hex(fee),
    },
  },
];

// Don't need to add payload memo if it's empty.
if (payload) {
  Memos.push({
    Memo: {
      MemoType: hex("payload"),
      MemoData: payload.replace("0x", ""),
    },
  });
}

const response = await signAndSubmitTx(client, wallet, {
  TransactionType: "Payment",
  Account: wallet.address,
  Destination: itsContractAddress,
  Amount: parseToken(normalizedTokenSymbol, transferAmount),
  Memos,
});

console.log("Submitted Transaction", response.result.tx_json.hash);

// Disconnect from the WSS server
await client.disconnect();
