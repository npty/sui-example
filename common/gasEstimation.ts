import { AxelarQueryAPI } from "@axelar-network/axelarjs-sdk";
import { environment } from "../common/env";

export type HopParams = {
  sourceChain: string;
  destinationChain: string;
  gasLimit: string;
};

export async function calculateEstimatedFee(
  sourceChain: string,
  destinationChain: string,
): Promise<string> {
  const sdk = new AxelarQueryAPI({
    environment,
  });

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
