import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { getSuiChainConfig } from "./common/chains";
import { getSuiKeypair } from "./sui/suiWallet";
import { Environment } from "@axelar-network/axelarjs-sdk";
import { formatUnits, parseUnits } from "ethers";
import SuiTypedContracts from "@axelarjs/sui";
import { getItsCoin } from "./sui/coin";
import { calculateEstimatedFee } from "./common/gasEstimation";
import { environment } from "./common/env";
import { convertAddress, convertAddressForXrpl } from "./sui/utils";
import { bcs } from "@mysten/sui/bcs";

// --- Constants ---
const DESTINATION_CHAIN: string = process.argv[2] || "ethereum-sepolia";
const DESTINATION_ADDRESS =
  process.argv[3] || "0xA57ADCE1d2fE72949E4308867D894CD7E7DE0ef2";
const UNIT_AMOUNT = parseUnits(process.argv[4] || "1", 9);
const ENVIRONMENT = "testnet" as Environment;
const { InterchainTokenService, AxelarGateway, GasService } =
  SuiTypedContracts[ENVIRONMENT];

console.log("Environment:", environment);

// If the destination chain is XRPL, you'll need to set a trust line with token issuer first (the address of interchain token service contract at xrpl).
let destinationAddress =
  DESTINATION_CHAIN === "xrpl"
    ? convertAddressForXrpl(DESTINATION_ADDRESS).toBytes()
    : convertAddress(DESTINATION_ADDRESS).toBytes();

// SQD token
const TOKEN_SYMBOL = "SQD";
const TOKEN_ADDRESS =
  "0xdec8d72a69438bc872824e70944cd4d89d25c34e3f149993b2d06718d4fd87e2";
const ITS_TOKEN_ID =
  "0x42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c";
const ITS_TOKEN_TYPE = `${TOKEN_ADDRESS}::${TOKEN_SYMBOL.toLowerCase()}::${TOKEN_SYMBOL.toUpperCase()}`;
const CLOCK_PACKAGE_ID = "0x6";

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

  const fee = await calculateEstimatedFee("sui", DESTINATION_CHAIN);
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

  // Serialize empty metadata as a byte vector
  const emptyMetadata = bcs.byteVector().serialize(new Uint8Array()).toBytes();

  // Prepare interchain transfer
  const ticket =
    InterchainTokenService.interchain_token_service.builder.prepareInterchainTransfer(
      tx,
      [
        tokenId,
        transferCoin,
        DESTINATION_CHAIN,
        tx.pure(destinationAddress),
        tx.pure(emptyMetadata),
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
