export type UserRole = "admin" | "mitra";

export type AuthUser = {
	id: string;
	username: string;
	displayName: string;
	role: UserRole;
	partnerId: string | null;
	identityCode: string;
};
