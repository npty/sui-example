import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/bcs";
import { getSuiChainConfig } from "./utils/chains";
import { getSuiKeypair } from "./utils/suiWallet";
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";
import { formatUnits, parseUnits } from "ethers";
import { getItsCoin } from "./utils/coin";

// --- Constants ---
const DESTINATION_CHAIN = "ethereum-sepolia";
const DESTINATION_ADDRESS =
  process.argv[2] || "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const TOKEN_SYMBOL = "SQD";
const UNIT_AMOUNT = parseUnits(process.argv[3] || "1", 9);
const ENVIRONMENT = "testnet" as Environment;

// SQD token
const TOKEN_ADDRESS =
  "0xdec8d72a69438bc872824e70944cd4d89d25c34e3f149993b2d06718d4fd87e2";
const ITS_TOKEN_ID =
  "0x42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c";
const ITS_TOKEN_TYPE = `${TOKEN_ADDRESS}::${TOKEN_SYMBOL.toLowerCase()}::${TOKEN_SYMBOL.toUpperCase()}`;
const CLOCK_PACKAGE_ID = "0x6";

type HopParams = {
  sourceChain: string;
  destinationChain: string;
  gasLimit: string;
};

// --- Helper Functions ---
async function calculateEstimatedFee(
  sdk: AxelarQueryAPI,
  sourceChain: string,
  destinationChain: string,
): Promise<string> {
  const hopParams: HopParams[] = [
    {
      sourceChain: sourceChain,
      destinationChain: "axelar",
      gasLimit: "400000",
    },
    {
      sourceChain: "axelar",
      destinationChain: destinationChain,
      gasLimit: "1100000",
    },
  ];
  return (await sdk.estimateMultihopFee(hopParams)) as string;
}

// --- Main Execution ---
(async () => {
  const chainConfig = await getSuiChainConfig();
  const contracts = chainConfig.config.contracts;

  const suiClient = new SuiClient({ url: chainConfig.config.rpc[0] });
  const suiWallet = getSuiKeypair();
  const walletAddress = suiWallet.toSuiAddress();

  console.log("Wallet Address:", walletAddress);

  const balance = await suiClient.getBalance({
    owner: walletAddress,
  });

  console.log("Total Balance:", `${formatUnits(balance.totalBalance, 9)} SUI`);

  const objectIds = {
    its: contracts.InterchainTokenService.objects.InterchainTokenService,
    itsv0: contracts.InterchainTokenService.objects.InterchainTokenServicev0,
    gateway: contracts.AxelarGateway.objects.Gateway,
    gasService: contracts.GasService.objects.GasService,
  };

  const sdk = new AxelarQueryAPI({
    environment: ENVIRONMENT,
  });

  const fee = await calculateEstimatedFee(sdk, "sui", DESTINATION_CHAIN);
  console.log("Estimated Fee:", `${formatUnits(fee, 9)} SUI`);

  console.log(
    `Sending ${formatUnits(UNIT_AMOUNT, 9)} ${TOKEN_SYMBOL} to ${DESTINATION_ADDRESS} on ${DESTINATION_CHAIN}`,
  );

  const itsCoinObjectId = await getItsCoin(
    suiClient,
    walletAddress,
    ITS_TOKEN_TYPE,
  );

  // Create a new transaction block
  const tx = new Transaction();

  // Serialize destination chain and address using BCS
  const destChainSerialized = bcs
    .string()
    .serialize(DESTINATION_CHAIN)
    .toBytes();
  const destAddressSerialized = bcs
    .string()
    .serialize(DESTINATION_ADDRESS)
    .toBytes();

  // Serialize empty metadata as a byte vector
  const emptyMetadata = bcs.byteVector().serialize(new Uint8Array()).toBytes();

  // Split Gas for paying axelar fee
  const gas = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(fee))]);

  // Split Coin for transferring amount through interchain transfer
  const transferCoin = tx.splitCoins(tx.object(itsCoinObjectId), [
    tx.pure.u64(BigInt(UNIT_AMOUNT.toString())),
  ]);

  // Create a new channel
  const channel = tx.moveCall({
    target: `${contracts.AxelarGateway.address}::channel::new`,
    arguments: [],
  });

  const tokenId = tx.moveCall({
    target: `${contracts.InterchainTokenService.address}::token_id::from_u256`,
    arguments: [bcs.u256().serialize(ITS_TOKEN_ID)],
  });

  // Prepare interchain transfer
  const ticket = tx.moveCall({
    target: `${contracts.InterchainTokenService.address}::interchain_token_service::prepare_interchain_transfer`,
    arguments: [
      tokenId,
      transferCoin,
      tx.pure(destChainSerialized),
      tx.pure(destAddressSerialized),
      tx.pure(emptyMetadata),
      channel,
    ],
    typeArguments: [ITS_TOKEN_TYPE],
  });

  // Send interchain transfer
  const messageTicket = tx.moveCall({
    target: `${contracts.InterchainTokenService.address}::interchain_token_service::send_interchain_transfer`,
    arguments: [tx.object(objectIds.its), ticket, tx.object(CLOCK_PACKAGE_ID)],
    typeArguments: [ITS_TOKEN_TYPE],
  });

  // Pay gas for the transfer
  tx.moveCall({
    target: `${contracts.GasService.address}::gas_service::pay_gas`,
    arguments: [
      tx.object(objectIds.gasService),
      messageTicket,
      gas,
      tx.pure.address(walletAddress),
      tx.pure(emptyMetadata),
    ],
    typeArguments: ["0x2::sui::SUI"],
  });

  // Send the message
  tx.moveCall({
    target: `${contracts.AxelarGateway.address}::gateway::send_message`,
    arguments: [tx.object(objectIds.gateway), messageTicket],
  });

  // Destroy the channel
  tx.moveCall({
    target: `${contracts.AxelarGateway.address}::channel::destroy`,
    arguments: [channel],
  });

  // Sign and execute the transaction
  const response = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: suiWallet,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  console.log(
    "Transaction Hash:",
    `${chainConfig.blockExplorers[0].url}/tx/${response.digest}`,
  );
})();
