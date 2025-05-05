import type {
  StellarChainConfig,
  SuiChainConfig,
  XrplChainConfig,
} from "./types";
import { environment } from "../common/env";

export async function getChainConfig() {
  let s3ConfigUrl;
  if (environment === "devnet-amplifier") {
    s3ConfigUrl = `https://axelar-devnets.s3.us-east-2.amazonaws.com/configs/devnet-amplifier-config-1.0.x.json`;
  } else {
    s3ConfigUrl = `https://axelar-${environment}.s3.us-east-2.amazonaws.com/configs/${environment}-config-1.x.json`;
  }

  return fetch(s3ConfigUrl).then((res) => res.json());
}

export async function getSuiChainConfig(): Promise<SuiChainConfig> {
  const chainConfig = await getChainConfig();

  // Future-proofing for sui chain id change e.g. from sui -> sui-2
  const suiChainId = Object.keys(chainConfig.chains).find((chain) =>
    chain.includes("sui"),
  ) as string;

  return chainConfig.chains[suiChainId];
}

export async function getXrplChainConfig(): Promise<XrplChainConfig> {
  const chainConfig = await getChainConfig();

  const xrplChainId = Object.keys(chainConfig.chains).find(
    (chain) => chainConfig.chains[chain].chainType === "xrpl",
  ) as string;

  return chainConfig.chains[xrplChainId];
}

export async function getStellarChainConfig(): Promise<StellarChainConfig> {
  const chainConfig = await getChainConfig();

  const stellarChainId = Object.keys(chainConfig.chains).find(
    (chain) => chainConfig.chains[chain].chainType === "stellar",
  ) as string;

  return chainConfig.chains[stellarChainId];
}
