import type { SuiChainConfig, XrplChainConfig } from "./types";

export async function getChainConfig() {
  return fetch(
    "https://axelar-testnet.s3.us-east-2.amazonaws.com/configs/testnet-config-1.x.json",
  ).then((res) => res.json());
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
