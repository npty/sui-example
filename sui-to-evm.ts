import { SuiClient } from "@mysten/sui/client";
import type { SuiObjectChangeCreated } from "@mysten/sui/client";
import { getSuiChainConfig } from "./utils/chains";
import { getSuiKeypair } from "./utils/suiWallet";
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";
import { formatUnits, parseUnits } from "ethers";
import { TxBuilder } from "@axelar-network/axelar-cgp-sui";
import type { Keypair } from "@mysten/sui/cryptography";
import type { SuiContracts } from "./types";
import type { TransactionResult } from "@mysten/sui/transactions";

// --- Constants ---
const DESTINATION_CHAIN = "ethereum-sepolia";
const DESTINATION_ADDRESS = "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const TOKEN_SYMBOL = "SQD";
const UNIT_AMOUNT = parseUnits("1", 9);
const ENVIRONMENT = "testnet" as Environment;

type HopParams = {
  sourceChain: string;
  destinationChain: string;
  gasLimit: string;
};

// --- Helper Functions ---
async function wrapCallsWithChannel(
  txBuilder: TxBuilder,
  contracts: SuiContracts,
  makeCalls: (Channel: TransactionResult) => Promise<void>,
) {
  const Channel = await txBuilder.moveCall({
    target: `${contracts.AxelarGateway.address}::channel::new`,
    arguments: [],
  });

  await makeCalls(Channel);

  await txBuilder.moveCall({
    target: `${contracts.AxelarGateway.address}::channel::destroy`,
    arguments: [Channel],
  });
}

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

async function prepareAndSendInterchainTransfer(
  txBuilder: TxBuilder,
  contracts: SuiContracts,
  tokenId: TransactionResult,
  coin: TransactionResult,
  destinationChain: string,
  destinationAddress: string,
  Channel: TransactionResult,
  tokenType: string,
  objectIds: any,
  clockPackageId: string,
  gas: TransactionResult,
  walletAddress: string,
) {
  const ticket = await txBuilder.moveCall({
    target: `${contracts.InterchainTokenService.address}::interchain_token_service::prepare_interchain_transfer`,
    arguments: [
      tokenId,
      coin,
      destinationChain,
      destinationAddress,
      "0x", // its token metadata
      Channel,
    ],
    typeArguments: [tokenType],
  });

  const messageTicket = await txBuilder.moveCall({
    target: `${contracts.InterchainTokenService.address}::interchain_token_service::send_interchain_transfer`,
    arguments: [objectIds.its, ticket, clockPackageId],
    typeArguments: [tokenType],
  });

  await txBuilder.moveCall({
    target: `${contracts.GasService.address}::gas_service::pay_gas`,
    arguments: [objectIds.gasService, messageTicket, gas, walletAddress, "0x"],
    typeArguments: [`0x2::sui::SUI`],
  });

  await txBuilder.moveCall({
    target: `${contracts.AxelarGateway.address}::gateway::send_message`,
    arguments: [objectIds.gateway, messageTicket],
  });
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

  const tokenAddress =
    "0xdec8d72a69438bc872824e70944cd4d89d25c34e3f149993b2d06718d4fd87e2";
  const ITS_TOKEN_TYPE = `${tokenAddress}::${TOKEN_SYMBOL.toLowerCase()}::${TOKEN_SYMBOL.toUpperCase()}`;
  const ITS_TOKEN_ID =
    "0x42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c"; //ItsToken.objects.TokenId
  const CLOCK_PACKAGE_ID = "0x6";

  const sdk = new AxelarQueryAPI({
    environment: ENVIRONMENT,
  });

  const fee = await calculateEstimatedFee(sdk, "sui", DESTINATION_CHAIN);
  console.log("Estimated Fee:", `${formatUnits(fee, 9)} SUI`);

  const txBuilder = new TxBuilder(suiClient);

  const coins = await suiClient.getCoins({
    owner: walletAddress,
    coinType: ITS_TOKEN_TYPE,
  });

  if (coins.data.length === 0) {
    throw new Error("No ITS coins found");
  }

  const coin = coins.data[0];

  // Split Gas for paying axelar fee
  const Gas = txBuilder.tx.splitCoins(txBuilder.tx.gas, [BigInt(fee)]);

  // Split Coin for transferring amount through interchain transfer
  const Coin = txBuilder.tx.splitCoins(coin.coinObjectId, [
    BigInt(UNIT_AMOUNT),
  ]);

  // Convert string tokenId to TokenId hot potato object
  const TokenId = await txBuilder.moveCall({
    target: `${contracts.InterchainTokenService.address}::token_id::from_u256`,
    arguments: [ITS_TOKEN_ID],
  });

  await wrapCallsWithChannel(
    txBuilder,
    contracts,
    async (Channel: TransactionResult) => {
      await prepareAndSendInterchainTransfer(
        txBuilder,
        contracts,
        TokenId,
        Coin,
        DESTINATION_CHAIN,
        DESTINATION_ADDRESS,
        Channel,
        ITS_TOKEN_TYPE,
        objectIds,
        CLOCK_PACKAGE_ID,
        Gas,
        walletAddress,
      );
    },
  );

  const response = await txBuilder.signAndExecute(suiWallet, {});
  console.log(
    "Transaction Hash:",
    `${chainConfig.blockExplorers[0].url}/tx/${response.digest}`,
  );
})();
