# ITS Example

This is an example of how to send ITS token from Sui to EVM chain.

## Preparation

1. Install dependencies:

```bash
bun install
```

2. Setup your `.env` file:

```bash
cp .env.example .env
```

For XRPL, you need to set `XRPL_SEED` in `.env` file. You can generate a wallet seed by running:

```bash
bun xrpl:wallet
```

For Sui, you need to set `SUI_PRIVATE_KEY` in `.env` file.

## Sui ITS Transfer

Send 1 ITS token from Sui to EVM chain:

```bash
bun sui:start <destination-address> <amount>
```

> Note: the destination address and amount are optional.

## XRPL ITS Transfer

Send XRP from XRPL to other chain

```bash
bun xrpl:start <destination-address> <destination-chain> <amount>
```

> Note: the destination chain and amount are optional. destination-address is required.
