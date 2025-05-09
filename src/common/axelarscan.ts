import { environment } from "./env";

export function getAxelarscanLink(txHash: string, txIndex?: number) {
  let axelarscanTxLink = "";
  if (environment === "mainnet") {
    axelarscanTxLink = `https://axelarscan.io/tx/${txHash}`;
  }
  axelarscanTxLink = `https://testnet.axelarscan.io/tx/${txHash}`;

  if (txIndex) {
    axelarscanTxLink = `${axelarscanTxLink}-${txIndex}`;
  }

  return axelarscanTxLink;
}
