import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/layout";
import DashboardPage from "@/app/dashboard/page";
import BarangMasukPage from "@/app/barang-masuk/page";
import BarangKeluarPage from "@/app/barang-keluar/page";
import DataBarangPage from "@/app/data-barang/page";
import DataTransaksiPage from "@/app/data-transaksi/page";
import LokasiBarangPage from "@/app/lokasi-barang/page";
import KategoriBarangPage from "@/app/kategori-barang/page";
import MerekBarangPage from "@/app/merek-barang/page";
import MitraPage from "@/app/mitra/page";
import LoginPage from "@/app/login/page";
import PengaturanPage from "@/app/pengaturan/page";

export function AppRoutes() {
	return (
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route
				path="/"
				element={
					<ProtectedRoute>
						<Layout />
					</ProtectedRoute>
				}>
				<Route index element={<DashboardPage />} />
				<Route path="barang-masuk" element={<BarangMasukPage />} />
				<Route path="barang-keluar" element={<BarangKeluarPage />} />
				<Route path="riwayat" element={<DataTransaksiPage />} />
				<Route path="data-barang" element={<DataBarangPage />} />
				<Route
					path="lokasi-barang"
					element={
						<ProtectedRoute adminOnly>
							<LokasiBarangPage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="kategori-barang"
					element={
						<ProtectedRoute adminOnly>
							<KategoriBarangPage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="merek-barang"
					element={
						<ProtectedRoute adminOnly>
							<MerekBarangPage />
						</ProtectedRoute>
					}
				/>
				<Route
					path="mitra"
					element={
						<ProtectedRoute adminOnly>
							<MitraPage />
						</ProtectedRoute>
					}
				/>
				<Route path="pengaturan" element={<PengaturanPage />} />
			</Route>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}
