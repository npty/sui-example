import { AxelarQueryAPI } from "@axelar-network/axelarjs-sdk";
import { environment } from "../common/env";
import type { BaseChainConfig } from "./types";

export type HopParams = {
  sourceChain: string;
  destinationChain: string;
  gasLimit: string;
};

// These values are pulled from the average gas used of interchain transfer for each chain and round up it a bit more
// See https://github.com/axelarnetwork/axelarjs-sdk/pull/358#discussion_r2072342064
export function getGasLimit(chainType: string): string {
  if (environment === "testnet") {
    switch (chainType) {
      case "sui":
        return "2750";
      case "xrpl":
        return "165000";
      case "stellar":
        return "8000000";
      // set average gas used for evm chains to 500k for now. this is not accurate but it's good enough for now as we are focusing on amplifier chains here
      default:
        return "500000";
    }
  } else {
    switch (chainType) {
      case "sui":
        return "70000";
      case "xrpl":
        return "165000";
      case "stellar":
        return "8000000";
      default:
        return "500000";
    }
  }
}

export async function calculateEstimatedFee(
  sourceChain: string,
  destinationChainConfig: BaseChainConfig,
): Promise<string> {
  const sdk = new AxelarQueryAPI({
    environment,
  });

  const destChainGasLimit = getGasLimit(destinationChainConfig.chainType);

  const hopParams: HopParams[] = [
    {
      sourceChain: sourceChain,
      destinationChain: "axelar",
      // this value will be overrided by the axelarscan api
      gasLimit: "1",
    },
    {
      sourceChain: "axelar",
      destinationChain: destinationChainConfig.id,
      gasLimit: destChainGasLimit,
    },
  ];

  return (await sdk.estimateMultihopFee(hopParams)) as string;
}
