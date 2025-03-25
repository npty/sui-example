import { SuiClient } from "@mysten/sui/client";
import { getSuiChainConfig } from "./utils/chains";
import { Transaction } from "@mysten/sui/transactions";
import { getSuiKeypair } from "./utils/suiWallet";
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";
import { formatUnits, parseUnits } from "ethers";
import { TxBuilder } from "@axelar-network/axelar-cgp-sui";

const chainConfig = await getSuiChainConfig();
const contracts = chainConfig.config.contracts;

const suiClient = new SuiClient({ url: chainConfig.config.rpc[0] });
const suiWallet = getSuiKeypair();
const suiTx = new Transaction();

const destinationChain = "ethereum-sepolia";
const destinationAddress = "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const unitAmount = parseUnits("1", 9);
const walletAddress = suiWallet.toSuiAddress();
console.log("Wallet Address:", walletAddress);

const balance = await suiClient.getBalance({
  owner: walletAddress,
});

console.log("Total Balance:", `${formatUnits(balance.totalBalance, 9)} SUI`);

const objectIds = {
  singleton: contracts.InterchainTokenService.objects.InterchainTokenService, // Assuming this is the singleton object
  its: contracts.InterchainTokenService.objects.InterchainTokenService,
  itsv0: contracts.InterchainTokenService.objects.InterchainTokenServicev0,
  gateway: contracts.AxelarGateway.objects.Gateway,
  gasService: contracts.GasService.objects.GasService,
};

const tokenSymbol = "SQD";
const tokenAddress =
  "0xdec8d72a69438bc872824e70944cd4d89d25c34e3f149993b2d06718d4fd87e2";
const ITS_TOKEN_TYPE = `${tokenAddress}::${tokenSymbol.toLowerCase()}::${tokenSymbol.toUpperCase()}`;
const ITS_TOKEN_ID =
  "0x42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c"; //ItsToken.objects.TokenId
const CLOCK_PACKAGE_ID = "0x6";

const sdk = new AxelarQueryAPI({
  environment: "testnet" as Environment,
});

const ownedObjects = await suiClient.getOwnedObjects({
  owner: walletAddress,
  filter: {
    MoveModule: { module: "channel", package: contracts.AxelarGateway.address },
  },
});

const channelObjects = ownedObjects.data.map((channel) => channel.data);
const lastChannel = channelObjects[channelObjects.length - 1];
let channelId = lastChannel?.objectId;

if (!channelId) {
  const txBuilder = new TxBuilder(suiClient);
  const Channel = await txBuilder.moveCall({
    target: `${contracts.AxelarGateway.address}::channel::new`,
    arguments: [],
  });

  txBuilder.tx.transferObjects([Channel], walletAddress);

  const response = await txBuilder.signAndExecute(suiWallet, {
    showObjectChanges: true,
  });

  const channelObject = response.objectChanges?.find(
    (change) =>
      change.type === "created" &&
      change.objectType ===
        `${contracts.AxelarGateway.address}::channel::Channel`,
  );

  if (channelObject?.type === "created") {
    channelId = channelObject?.objectId;
  }
}

console.log("Channel ID:", channelId);

if (!channelId) {
  throw new Error("Channel ID not found");
}

const hopParams = [
  {
    sourceChain: "sui",
    destinationChain: "axelar",
    gasLimit: "300000",
  },
  {
    sourceChain: "axelar",
    destinationChain: destinationChain,
    gasLimit: "1000000",
  },
];
const fee = (await sdk.estimateMultihopFee(hopParams)) as string;
console.log("Estimated Fee:", `${formatUnits(fee, 9)} SUI`);

const txBuilder = new TxBuilder(suiClient);

// const gas = suiTx.splitCoins(suiTx.gas, [BigInt(fee)]);
const coins = await suiClient.getCoins({
  owner: walletAddress,
  coinType: ITS_TOKEN_TYPE,
});

if (coins.data.length === 0) {
  throw new Error("No ITS coins found");
}

const coin = coins.data[0];

const Gas = txBuilder.tx.splitCoins(txBuilder.tx.gas, [BigInt(fee)]);
const Coin = txBuilder.tx.splitCoins(coin.coinObjectId, [BigInt(unitAmount)]);

const [TokenId] = await txBuilder.moveCall({
  target: `${contracts.InterchainTokenService.address}::token_id::from_u256`,
  arguments: [ITS_TOKEN_ID],
});

const ticket = await txBuilder.moveCall({
  target: `${contracts.InterchainTokenService.address}::interchain_token_service::prepare_interchain_transfer`,
  arguments: [
    TokenId,
    Coin,
    destinationChain,
    destinationAddress,
    "0x", // its token metadata
    channelId,
  ],
  typeArguments: [ITS_TOKEN_TYPE],
});

const messageTicket = await txBuilder.moveCall({
  target: `${contracts.InterchainTokenService.address}::interchain_token_service::send_interchain_transfer`,
  arguments: [objectIds.its, ticket, CLOCK_PACKAGE_ID],
  typeArguments: [ITS_TOKEN_TYPE],
});

await txBuilder.moveCall({
  target: `${contracts.GasService.address}::gas_service::pay_gas`,
  arguments: [objectIds.gasService, messageTicket, Gas, walletAddress, "0x"],
  typeArguments: [`0x2::sui::SUI`],
});

await txBuilder.moveCall({
  target: `${contracts.AxelarGateway.address}::gateway::send_message`,
  arguments: [objectIds.gateway, messageTicket],
});

const response = await txBuilder.signAndExecute(suiWallet, {});
console.log("Transaction Hash:", response.digest);
