# Interchain Transfer Example

This is an example of sending ITS token from Sui and XRPL to other chains.

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

Send SQD token from Sui to other chain:

```bash
bun sui:start <destination-chain> <destination-address> <amount>
```

Example:

```bash
bun sui:start ethereum-sepolia 0x5eaF5407acc1be854644BE2Be20Ac23D07e491D6 1
```

> Note: the destination address and amount are optional.

## XRPL ITS Transfer

Send XRP or SQD from XRPL to other chain

```bash
bun xrpl:start <destination-address> <destination-chain> <token-symbol> <amount>
```

Example:

```bash
bun xrpl:start 0x5eaF5407acc1be854644BE2Be20Ac23D07e491D6 ethereum-sepolia SQD 1
```

> Note: the destination chain and amount are optional. destination-address is required.
