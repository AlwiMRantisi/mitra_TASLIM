import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";

type ProtectedRouteProps = {
	children: ReactNode;
	adminOnly?: boolean;
	mitraOnly?: boolean;
	// roles ini diizinkan mengakses route ini. Expoherent dengan adminOnly/mitraOnly.
	allowedRoles?: string[];
};

export default function ProtectedRoute({
	children,
	adminOnly = false,
	mitraOnly = false,
	allowedRoles,
}: ProtectedRouteProps) {
	const { user } = useAuth();

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	if (allowedRoles && allowedRoles.length > 0) {
		if (!allowedRoles.includes(user.role)) {
			return <Navigate to="/" replace />;
		}
		return <>{children}</>;
	}

	if (mitraOnly && user.role !== "mitra") {
		return <Navigate to="/" replace />;
	}

	if (adminOnly && user.role !== "admin") {
		return <Navigate to="/" replace />;
	}

	return <>{children}</>;
}
