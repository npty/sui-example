import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { arrayify } from "@ethersproject/bytes";

export function hexToScVal(hexString: string) {
  return nativeToScVal(Buffer.from(arrayify(hexString)), { type: "bytes" });
}

export function addressToScVal(addressString: string) {
  return nativeToScVal(Address.fromString(addressString), { type: "address" });
}

export function tokenToScVal(tokenAddress: string, tokenAmount: number) {
  return tokenAmount === 0
    ? nativeToScVal(null, { type: "null" })
    : nativeToScVal(
        {
          address: Address.fromString(tokenAddress),
          amount: tokenAmount,
        },
        {
          type: {
            address: ["symbol", "address"],
            amount: ["symbol", "i128"],
          },
        },
      );
}
