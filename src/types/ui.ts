export type DeleteDialogState =
  | {
      type: "single";
      ids: string[];
      serialNumber?: string;
      transactionNumber?: string;
    }
  | {
      type: "bulk";
      ids: string[];
    };

export type SheetMode =
  | "closed"
  | "add-rak"
  | "add-kardus"
  | "add-pallet"
  | "add-shuffle"
  | "edit-rak"
  | "edit-kardus"
  | "edit-pallet"
  | "edit-shuffle"
  | "add-level"
  | "edit-level";
