export interface Product {
  nome: string;
  altura: number;
  percFardo: number;
  classe: string;
}

export interface ChosenProduct extends Product {
  codOriginal: string;
  idUnico: string;
  qtd: number;
}

export interface PalletItem extends ChosenProduct {
  qtdUsada: number;
  stack: string;
  checked?: boolean;
}

export interface PalletLayer {
  id: string;
  percentual: number;
  itens: PalletItem[];
  altura: number;
  completed: boolean;
}
