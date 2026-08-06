import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, PenTool, Eraser, User, RefreshCw, Send } from "lucide-react";
import { api } from "@/lib/api";
import { getSignatureDataUrl } from "@/lib/trimCanvas";

export default function MobileSignPage() {
	const { sessionId } = useParams<{ sessionId: string }>();
	const sigPad = useRef<SignatureCanvas>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "success" | "error" | "expired">("loading");
	const [errorMsg, setErrorMsg] = useState("");
	const [hasDrawn, setHasDrawn] = useState(false);
	const [isPengambilan, setIsPengambilan] = useState(false);
	const [signerName, setSignerName] = useState("");

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
		setCanvasSize();
		const timer = setTimeout(setCanvasSize, 100);
		return () => clearTimeout(timer);
	}, [status]);

	useEffect(() => {
		const checkSession = async () => {
			try {
				const res = await api.get(`/signature-session/${sessionId}`);
				if (res.data.requestId) {
					setIsPengambilan(true);
				}
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
					setErrorMsg(error.response?.data?.message || "Gagal memuat sesi tanda tangan");
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
		if (isPengambilan && !signerName.trim()) {
			setErrorMsg("Silakan isi nama penerima / PIC terlebih dahulu.");
			return;
		}
		if (!hasDrawn || !sigPad.current || sigPad.current.isEmpty()) {
			setErrorMsg("Silakan gurat tanda tangan Anda terlebih dahulu.");
			return;
		}
		setErrorMsg("");
		const dataUrl = getSignatureDataUrl(sigPad.current!);
		if (!dataUrl) {
			setErrorMsg("Gagal mengekspor tanda tangan. Silakan coba lagi.");
			return;
		}

		try {
			setStatus("submitting");
			const payload: any = { signatureUrl: dataUrl };
			if (isPengambilan) payload.signerName = signerName.trim();
			await api.post(`/signature-session/${sessionId}`, payload);
			setStatus("success");
		} catch (error: any) {
			setStatus("ready");
			setErrorMsg(error.response?.data?.message || "Gagal menyimpan tanda tangan. Periksa koneksi internet Anda.");
		}
	};

	if (status === "loading") {
		return (
			<div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-zinc-950 text-white gap-3">
				<Loader2 className="h-9 w-9 animate-spin text-emerald-500" />
				<p className="text-sm font-medium text-zinc-400">Menyiapkan Kanvas Tanda Tangan...</p>
			</div>
		);
	}

	if (status === "success") {
		return (
			<div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-zinc-950 p-6 text-center text-white gap-6">
				<div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 ring-8 ring-emerald-500/10">
					<CheckCircle2 className="h-14 w-14 text-emerald-500" />
				</div>
				<div className="flex flex-col gap-2 max-w-xs">
					<h1 className="text-2xl font-bold tracking-tight">Tanda Tangan Berhasil!</h1>
					<p className="text-zinc-400 text-sm leading-relaxed">
						Tanda tangan digital telah terverifikasi dan terkirim. Anda dapat menutup halaman ini.
					</p>
				</div>
				<Button
					className="w-full max-w-xs bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 h-12 text-sm font-medium rounded-xl"
					onClick={() => window.close()}>
					Tutup Halaman
				</Button>
			</div>
		);
	}

	if (status === "expired" || status === "error") {
		return (
			<div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-zinc-950 p-6 text-center text-white gap-4">
				<div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/20 ring-8 ring-rose-500/10">
					<RefreshCw className="h-10 w-10 text-rose-500" />
				</div>
				<div className="flex flex-col gap-2 max-w-xs">
					<h1 className="text-xl font-bold">Sesi Kedaluwarsa</h1>
					<p className="text-zinc-400 text-sm leading-relaxed">
						{status === "expired"
							? "Sesi QR Code telah kedaluwarsa. Silakan minta Admin melakukan scan ulang QR Code terbaru."
							: errorMsg}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 flex flex-col bg-zinc-950 text-white h-[100dvh] overflow-hidden select-none">
			{/* Clean Header: Removed Icon & Title, Added Save Button */}
			<div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md px-4 py-3 shadow-md flex-shrink-0 z-20">
				<Button
					variant="outline"
					size="sm"
					onClick={handleClear}
					className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700 text-xs h-9 gap-1.5 rounded-lg px-3">
					<Eraser className="h-3.5 w-3.5" /> Hapus
				</Button>

				<Button
					size="sm"
					onClick={handleSubmit}
					disabled={status === "submitting"}
					className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-4 gap-1.5 font-semibold rounded-lg shadow-sm active:scale-95 transition-all">
					{status === "submitting" ? (
						<>
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							<span>Menyimpan...</span>
						</>
					) : (
						<>
							<Send className="h-3.5 w-3.5" />
							<span>Simpan Tanda Tangan</span>
						</>
					)}
				</Button>
			</div>

			{/* Error Banner Notification below header if any error occurs */}
			{errorMsg && (
				<div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2 text-rose-300 text-xs font-medium text-center flex-shrink-0 z-20">
					{errorMsg}
				</div>
			)}

			{/* Form PIC Name Input - Only rendered for isPengambilan */}
			{isPengambilan && (
				<div className="flex-shrink-0 px-4 py-3 bg-zinc-900/60 border-b border-zinc-800/80">
					<Label htmlFor="signerName" className="text-zinc-300 text-xs mb-1.5 flex items-center gap-1.5 font-medium">
						<User className="h-3.5 w-3.5 text-emerald-400" />
						Nama Penerima / PIC Material <span className="text-rose-500">*</span>
					</Label>
					<Input
						id="signerName"
						value={signerName}
						onChange={(e) => setSignerName(e.target.value)}
						placeholder="Ketik nama lengkap penerima..."
						className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 text-sm h-10 rounded-lg focus-visible:ring-emerald-500"
					/>
				</div>
			)}

			{/* Signature Canvas Container Area */}
			<div ref={containerRef} className="flex-1 bg-white relative overflow-hidden flex flex-col justify-between">
				{/* Floating Clear Button overlay on canvas */}
				<button
					type="button"
					onClick={handleClear}
					className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-zinc-900/85 hover:bg-zinc-900 text-zinc-200 border border-zinc-700/80 px-3 py-1.5 text-xs font-medium backdrop-blur-md shadow-md active:scale-95 transition-all">
					<Eraser className="h-3.5 w-3.5 text-amber-400" />
					<span>Bersihkan</span>
				</button>

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
							top: 0,
							left: 0,
							touchAction: "none",
							cursor: "crosshair",
						},
					}}
				/>

				{/* Baseline Visual Guide Overlay */}
				<div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-12 select-none">
					<div className="w-3/4 border-b-2 border-dashed border-zinc-300/80 pb-2 text-center">
						{!hasDrawn && (
							<p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest opacity-60 flex items-center justify-center gap-1.5">
								<PenTool className="h-3.5 w-3.5" /> Goreskan Tanda Tangan Di Atas Garis Ini
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
