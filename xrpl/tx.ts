import { Client, Wallet, type SubmitResponse } from "xrpl";

export interface SignAndSubmitArgs {
  account?: string;
  fee?: string;
  // Add other potential args if known
}

/**
 * Basic receipt handling. Throws an error on failure.
 * @param receipt The result object from the transaction submission.
 */
function handleReceipt(receipt: any) {
  const result = receipt.engine_result;
  console.log(result);
  if (result !== "tesSUCCESS") {
    console.error(
      "Transaction failed",
      `${receipt.engine_result}: ${receipt.engine_result_message}`,
    );
    throw new Error(
      `Transaction failed: ${result} - ${receipt.engine_result_message}`,
    );
  }
  console.log(`Transaction successful. Hash:`, receipt.tx_json.hash);
}

/**
 * Builds, signs, and submits an XRPL transaction.
 * @param client An initialized and potentially connected xrpl.Client instance.
 * @param signer The xrpl.Wallet instance to sign the transaction.
 * @param txType The type of transaction (e.g., 'Payment', 'TrustSet').
 * @param fields Transaction-specific fields.
 * @param args Optional arguments like 'account' or 'fee'.
 * @returns The result of the transaction submission.
 */
export async function signAndSubmitTx(
  client: Client,
  signer: Wallet,
  txType: string,
  fields: Record<string, any> = {},
  args: SignAndSubmitArgs = {},
): Promise<SubmitResponse> {
  // Ensure client is connected
  if (!client.isConnected()) {
    await client.connect();
  }

  // 1. Determine Fee
  let calculatedFee: string | undefined = args.fee;
  if (!calculatedFee) {
    const feeResponse = await client.request({ command: "fee" });
    const baseFee = feeResponse.result.drops.open_ledger_fee;
    calculatedFee = String(Number(baseFee) * 2); // Adjust multiplier based on actual signer count if needed
  }

  // 2. Build Transaction
  const txJson: any = {
    TransactionType: txType,
    Account: args.account ?? signer.classicAddress,
    ...fields,
  };
  if (calculatedFee) {
    // Only add fee if explicitly provided or calculated for multisig
    txJson.Fee = calculatedFee;
  }

  console.log("txJson", txJson);

  // Autofill transaction details (like sequence number)
  const preparedTx = await client.autofill(txJson);

  // 3. Sign Transaction
  const signedTx = signer.sign(preparedTx);

  // 4. Submit Transaction
  const result = await client.submit(signedTx.tx_blob);

  // 5. Handle Receipt
  handleReceipt(result.result);

  return result;
}
