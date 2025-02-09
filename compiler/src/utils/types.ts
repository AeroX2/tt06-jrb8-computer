export enum HexOrLabelKind {
  HEX,
  LABEL
}

export type HexOrLabel = 
  | { kind: HexOrLabelKind.HEX; hex: number }
  | { kind: HexOrLabelKind.LABEL; label: string }; 