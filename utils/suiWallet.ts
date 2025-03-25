import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";

export function getSuiKeypair(): Secp256k1Keypair {
  if (!process.env.SUI_PRIVATE_KEY) {
    throw new Error("SUI_PRIVATE_KEY not set");
  }

  const privKey = Buffer.from(process.env.SUI_PRIVATE_KEY, "hex");
  const keypair = Secp256k1Keypair.fromSecretKey(privKey);

  return keypair;
}
