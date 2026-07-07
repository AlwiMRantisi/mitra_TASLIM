export type PartnerType = "AKTIVASI" | "GANGGUAN";

export type Partner = {
  id: string;
  code?: string;
  name: string;
  partnerType?: PartnerType;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  username?: string | null;
};

export type OwnerIdentitySettings = {
  kpCode: string;
};
