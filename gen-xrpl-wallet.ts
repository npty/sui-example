import { generateWallet } from "./xrpl/xrplWallet";
import xrpl from "xrpl";

const wallet = generateWallet({ walletKeyType: xrpl.ECDSA.secp256k1 });

console.log("Wallet Address:", wallet.address);
console.log("Wallet Seed:", wallet.seed);
console.log("Private Key:", wallet.privateKey);
