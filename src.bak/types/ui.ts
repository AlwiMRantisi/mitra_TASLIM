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
  | "edit-rak"
  | "edit-kardus"
  | "add-level"
  | "edit-level";
