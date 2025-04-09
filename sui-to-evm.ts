import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { getSuiChainConfig } from "./common/chains";
import { getSuiKeypair } from "./sui/suiWallet";
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";
import { formatUnits, parseUnits } from "ethers";
import SuiTypedContracts from "@axelarjs/sui";
import { getItsCoin } from "./sui/coin";

// --- Constants ---
const DESTINATION_CHAIN = "ethereum-sepolia";
const DESTINATION_ADDRESS =
  process.argv[2] || "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const TOKEN_SYMBOL = "SQD";
const UNIT_AMOUNT = parseUnits(process.argv[3] || "1", 9);
const ENVIRONMENT = "testnet" as Environment;
const { InterchainTokenService, AxelarGateway, GasService } =
  SuiTypedContracts[ENVIRONMENT];

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

  // Split Gas for paying axelar fee
  const gas = tx.splitCoins(tx.gas, [BigInt(fee)]);

  // Split Coin for transferring amount through interchain transfer
  const transferCoin = tx.splitCoins(tx.object(itsCoinObjectId), [UNIT_AMOUNT]);

  // Create a new channel
  const channel = AxelarGateway.channel.builder.new$(tx, []);
  const tokenId = InterchainTokenService.token_id.builder.fromU256(tx, [
    BigInt(ITS_TOKEN_ID),
  ]);

  // Prepare interchain transfer
  const ticket =
    InterchainTokenService.interchain_token_service.builder.prepareInterchainTransfer(
      tx,
      [
        tokenId,
        transferCoin,
        DESTINATION_CHAIN,
        tx.object(DESTINATION_ADDRESS),
        tx.object("0x"),
        channel,
      ],
      [ITS_TOKEN_TYPE],
    );

  // Send interchain transfer
  const messageTicket =
    InterchainTokenService.interchain_token_service.builder.sendInterchainTransfer(
      tx,
      [objectIds.its, ticket, CLOCK_PACKAGE_ID],
      [ITS_TOKEN_TYPE],
    );

  // Pay gas for the transfer
  GasService.gas_service.builder.payGas(
    tx,
    [objectIds.gasService, messageTicket, gas, walletAddress, tx.object("0x")],
    ["0x2::sui::SUI"],
  );

  // Send the message
  AxelarGateway.gateway.builder.sendMessage(tx, [
    objectIds.gateway,
    messageTicket,
  ]);

  // Destroy the channel
  AxelarGateway.channel.builder.destroy(tx, [channel]);

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
