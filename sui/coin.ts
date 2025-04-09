import type { SuiClient } from "@mysten/sui/client";

export async function getItsCoin(
  suiClient: SuiClient,
  ownerAddress: string,
  tokenType: string,
): Promise<string> {
  const coins = await suiClient.getCoins({
    owner: ownerAddress,
    coinType: tokenType,
  });

  if (coins.data.length === 0) {
    throw new Error(
      `No ITS coins of type ${tokenType} found for address ${ownerAddress}`,
    );
  }

  // TODO: Handle cases where there are multiple coin objects.
  // For now, just return the first one.
  return coins.data[0].coinObjectId;
}
