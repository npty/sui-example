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

export type SuiChainConfig = {
  id: string;
  blockExplorers: BlockExplorer[];
  config: {
    rpc: string[];
    contracts: SuiContracts;
  };
};

export type XrplChainConfig = {
  id: string;
  chainType: string;
  blockExplorers: BlockExplorer[];
  config: {
    rpc: string[];
    contracts: Record<string, BaseContract>;
  };
};
