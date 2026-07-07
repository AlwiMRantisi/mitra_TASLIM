import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";

type ProtectedRouteProps = {
	children: ReactNode;
	adminOnly?: boolean;
};

export default function ProtectedRoute({
	children,
	adminOnly = false,
}: ProtectedRouteProps) {
	const { user } = useAuth();

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	if (adminOnly && user.role !== "admin") {
		return <Navigate to="/" replace />;
	}

	return <>{children}</>;
}
