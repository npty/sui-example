import { Keypair } from "@stellar/stellar-sdk";

export function getWallet() {
  const privateKey = process.env.STELLAR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("STELLAR_PRIVATE_KEY is not set");
  }

  const keypair = Keypair.fromSecret(privateKey);

  return keypair;
}
