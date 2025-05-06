import type {
  StellarChainConfig,
  SuiChainConfig,
  XrplChainConfig,
} from "./types";
import { environment } from "../common/env";

export async function getChainConfigs() {
  let s3ConfigUrl;
  if (environment === "devnet-amplifier") {
    s3ConfigUrl = `https://axelar-devnets.s3.us-east-2.amazonaws.com/configs/devnet-amplifier-config-1.0.x.json`;
  } else {
    s3ConfigUrl = `https://axelar-${environment}.s3.us-east-2.amazonaws.com/configs/${environment}-config-1.x.json`;
  }

  return fetch(s3ConfigUrl).then((res) => res.json());
}

// chainName can be partially provided e.g. stellar will match stellar-2025-q1
export async function getChainConfig(chainName: string) {
  const chainConfigs = await getChainConfigs();

  // Future-proofing for sui chain id change e.g. from sui -> sui-2
  const chainId = Object.keys(chainConfigs.chains).find((chain) =>
    chainConfigs.chains[chain].chainType.includes(chainName),
  );

  if (!chainId) {
    throw new Error(`Chain ${chainName} not found`);
  }

  return chainConfigs.chains[chainId];
}
