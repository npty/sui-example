import type { Environment } from "@axelar-network/axelarjs-sdk";
import { Contract, nativeToScVal } from "@stellar/stellar-sdk";
import { getStellarChainConfig } from "common/chains";
import { parseUnits } from "ethers";
import { getWallet } from "stellar/wallet";
import { addressToScVal, hexToScVal, tokenToScVal } from "stellar/utils";

// --- Constants ---
const DESTINATION_CHAIN: string = process.argv[2] || "sui";
const DESTINATION_ADDRESS =
  process.argv[3] ||
  "0xba353a510d8a1174b37c31e6eab6e2d6d93cdb31cd093efdd30c177853533ab0";
const UNIT_AMOUNT = parseUnits(process.argv[4] || "1", 9);
const ENVIRONMENT = "testnet" as Environment;

console.log("Environment:", ENVIRONMENT);

// SQD token
const TOKEN_SYMBOL = "SQD";
const TOKEN_ADDRESS =
  "CDBBR6BVVZO32NMFCJJWRJFTKV3QQ2ZLITKKGINP2ONUQCTK7PCT4M3W";
const ITS_TOKEN_ID =
  "0x42e69c5a9903ba193f3e9214d41b1ad495faace3ca712fb0c9d0c44cc4d31a0c";

const wallet = getWallet();

console.log("Wallet Address:", wallet.publicKey());

// --- Main Execution ---
(async () => {
  const chainConfig = await getStellarChainConfig();
  const contractId =
    chainConfig.config.contracts.InterchainTokenService.address;
  const contract = new Contract(contractId);
  const caller = addressToScVal(wallet.publicKey());
  const gasTokenAddress =
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  const operation = contract.call(
    "interchain_transfer",
    caller,
    hexToScVal(ITS_TOKEN_ID),
    nativeToScVal(DESTINATION_CHAIN, { type: "string" }),
    hexToScVal(DESTINATION_ADDRESS),
    nativeToScVal(UNIT_AMOUNT, { type: "i128" }),
    nativeToScVal(null, { type: "null" }),
    tokenToScVal(gasTokenAddress, 3e7)
  );
})();
