export type BlockExplorer = {
  name: string;
  url: string;
};

export type BaseContract = {
  address: string;
};

export type SuiContract = BaseContract & {
  objects: Record<string, any>;
};

export type SuiContracts = {
  AxelarGateway: SuiContract;
  GasService: SuiContract;
  InterchainTokenService: SuiContract;
};

export type BaseChainConfig = {
  id: string;
  chainType: string;
  blockExplorers: BlockExplorer[];
  config: {
    rpc: string[];
    contracts: Record<string, BaseContract>;
  };
};

export type SuiChainConfig = BaseChainConfig & {
  chainType: "sui";
  config: {
    rpc: string[];
    contracts: SuiContracts;
  };
};

export type XrplChainConfig = BaseChainConfig & {
  chainType: "xrpl";
};

export type StellarChainConfig = BaseChainConfig & {
  chainType: "stellar";
};
