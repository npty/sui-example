import { xrpToDrops, type Client } from "xrpl";

export type TokenBalance = {
  symbol: string;
  value: string;
};

export function hex(str: string): string {
  return Buffer.from(str).toString("hex");
}

export function parseToken(token: string, amount: string) {
  if (token === "XRP") {
    return xrpToDrops(amount).toString();
  } else {
    const [currency, issuer] = token.split(".");
    return {
      currency,
      issuer,
      value: amount,
    };
  }
}

export async function getBalances(
  client: Client,
  account: string,
): Promise<TokenBalance[]> {
  const { result } = await client.request({
    command: "account_info",
    account,
  });

  const { result: resultAccountLines } = await client.request({
    command: "account_lines",
    account,
    ledger_index: "validated",
    peer: "rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2",
  });

  return [
    {
      symbol: "XRP",
      value: result.account_data.Balance,
    },
    ...resultAccountLines.lines.map((line) => ({
      symbol: line.currency,
      value: line.balance,
    })),
  ];
}
