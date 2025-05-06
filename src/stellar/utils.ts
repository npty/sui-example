import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { arrayify } from "@ethersproject/bytes";
import { rpc } from "@stellar/stellar-sdk";

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

export async function waitForTransaction(server: rpc.Server, hash: string) {
  let pendingTx = await server.getTransaction(hash);

  while (pendingTx.status === "NOT_FOUND") {
    pendingTx = await server.getTransaction(hash);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Waiting for transaction to be included in a ledger...");
  }

  return pendingTx;
}
