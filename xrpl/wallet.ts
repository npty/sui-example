import xrpl, { ECDSA, Client, Wallet } from "xrpl";

export type XrplBaseWalletOptions = {
  walletKeyType: ECDSA;
};

export type XrplWalletOptions = XrplBaseWalletOptions & {
  privateKey: string;
};
export function getWallet(options: XrplWalletOptions) {
  return xrpl.Wallet.fromSecret(options.privateKey, {
    algorithm: options.walletKeyType,
  });
}

export function generateWallet(options: XrplBaseWalletOptions) {
  return xrpl.Wallet.generate(options.walletKeyType);
}

export async function fundWallet(client: Client, wallet: Wallet) {
  return client.fundWallet(wallet);
}
