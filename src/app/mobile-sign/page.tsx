import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, PenTool } from "lucide-react";
import { api } from "@/lib/api";

export default function MobileSignPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const sigPad = useRef<SignatureCanvas>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "success" | "error" | "expired">("loading");
	const [errorMsg, setErrorMsg] = useState("");
	const [hasDrawn, setHasDrawn] = useState(false);

	// Set canvas size ONCE when canvas becomes visible - no ResizeObserver to avoid clearing on scroll/keyboard
	useLayoutEffect(() => {
		if (status !== "ready") return;
		const setCanvasSize = () => {
			const container = containerRef.current;
			if (!container) return;
			const canvas = container.querySelector("canvas");
			if (!canvas) return;
			const { width, height } = container.getBoundingClientRect();
			if (width > 0 && height > 0) {
				canvas.width = width;
				canvas.height = height;
			}
		};
		// Try immediately, then retry after short delay (canvas may not be mounted yet)
		setCanvasSize();
		const timer = setTimeout(setCanvasSize, 100);
		return () => clearTimeout(timer);
	}, [status]);

	useEffect(() => {
		const checkSession = async () => {
			try {
				const res = await api.get(`/signature-session/${sessionId}`);
				if (res.data.status === "COMPLETED") {
					setStatus("success");
				} else {
					setStatus("ready");
				}
			} catch (error: any) {
				if (error.response?.status === 400 && error.response?.data?.message === "Session expired") {
					setStatus("expired");
				} else {
					setStatus("error");
					setErrorMsg(error.response?.data?.message || "Failed to load session");
				}
			}
		};
		if (sessionId) checkSession();
	}, [sessionId]);

	const handleClear = () => {
		sigPad.current?.clear();
		setHasDrawn(false);
		setErrorMsg("");
	};

	const handleSubmit = async () => {
		// Use React state (hasDrawn) to check - more reliable than sigPad.isEmpty() on mobile
		if (!hasDrawn || !sigPad.current || sigPad.current.isEmpty()) {
			setErrorMsg("Silakan buat tanda tangan terlebih dahulu.");
			return;
		}
		setErrorMsg("");
		const dataUrl = sigPad.current.getCanvas().toDataURL("image/png");

		try {
			setStatus("submitting");
			await api.post(`/signature-session/${sessionId}`, { signatureUrl: dataUrl });
			setStatus("success");
		} catch (error: any) {
			setStatus("ready"); // go back to ready so user can retry
			setErrorMsg(error.response?.data?.message || "Gagal menyimpan tanda tangan. Periksa koneksi internet Anda.");
		}
	};

	if (status === "loading") {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white">
				<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
			</div>
		);
	}

	if (status === "success") {
		return (
			<div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 p-8 text-center text-white gap-6">
				<div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20">
					<CheckCircle2 className="h-14 w-14 text-emerald-500" />
				</div>
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-bold">Tanda Tangan Berhasil!</h1>
					<p className="text-zinc-400 text-sm leading-relaxed">
						Tanda tangan telah dikirim ke perangkat utama. Anda sudah bisa menutup halaman ini.
					</p>
				</div>
				<Button
					className="w-full max-w-xs bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 mt-4"
					onClick={() => window.close()}
				>
					Tutup Halaman
				</Button>
			</div>
		);
	}

	if (status === "expired" || status === "error") {
		return (
			<div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 p-6 text-center text-white gap-4">
				<div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
					<span className="text-3xl text-red-500">✕</span>
				</div>
				<div className="flex flex-col gap-2">
					<h1 className="text-xl font-bold">Gagal</h1>
					<p className="text-zinc-400 text-sm">
						{status === "expired"
							? "Sesi QR Code telah kedaluwarsa. Silakan scan ulang QR Code dari perangkat utama."
							: errorMsg}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 flex flex-col bg-zinc-950 text-white">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3 shadow-sm flex-shrink-0">
				<div className="flex items-center gap-2">
					<PenTool className="h-5 w-5 text-emerald-400" />
					<h1 className="text-base font-semibold">Tanda Tangan Digital</h1>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={handleClear}
					className="text-zinc-400 hover:text-white text-sm"
				>
					Hapus
				</Button>
			</div>

			{/* Canvas area - flex-1 fills remaining space */}
			<div ref={containerRef} className="flex-1 bg-white relative overflow-hidden">
				<SignatureCanvas
					ref={sigPad}
					penColor="black"
					onBegin={() => {
						setHasDrawn(true);
						setErrorMsg("");
					}}
					canvasProps={{
						style: {
							position: "absolute",
							top: 0, left: 0,
							touchAction: "none",
							cursor: "crosshair"
						}
					}}
				/>
				{!hasDrawn && (
					<div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
						<p className="text-zinc-300 text-sm font-medium uppercase tracking-widest opacity-60">
							Tanda Tangan Disini
						</p>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="border-t border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3 flex-shrink-0">
				{errorMsg && (
					<p className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg py-2 px-3">{errorMsg}</p>
				)}
				<Button
					className="w-full bg-emerald-600 py-6 text-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
					onClick={handleSubmit}
					disabled={status === "submitting"}
				>
					{status === "submitting" ? (
						<>
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
							Menyimpan...
						</>
					) : "Kirim Tanda Tangan"}
				</Button>
			</div>
		</div>
	);
}
