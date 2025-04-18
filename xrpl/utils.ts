import { xrpToDrops, type Client } from "xrpl";

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

export async function getBalance(client: Client, account: string) {
  const { result } = await client.request({
    command: "account_info",
    account,
  });

  return result.account_data.Balance;
}
