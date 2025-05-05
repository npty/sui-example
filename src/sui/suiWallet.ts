import { decodeSuiPrivateKey, Keypair } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export function getSuiKeypair(): Keypair {
  if (!process.env.SUI_PRIVATE_KEY) {
    throw new Error("SUI_PRIVATE_KEY not set");
  }

  const privKey = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
  const keypair = Ed25519Keypair.fromSecretKey(privKey.secretKey);

  return keypair;
}
