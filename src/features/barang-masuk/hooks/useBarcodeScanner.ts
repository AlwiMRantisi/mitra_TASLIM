import { useEffect, useRef } from "react";

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
};

interface UseBarcodeScannerProps {
  inputRef: React.RefObject<HTMLInputElement>;
  kodeBarangRef: React.MutableRefObject<string>;
  updateKodeBarang: (value: string | ((current: string) => string)) => void;
  onSubmit: (kodeOverride?: string) => Promise<void>;
}

/**
 * Hook untuk menangani barcode scanner secara global.
 * Menggunakan dependency array yang stabil untuk menghindari memory leak / churn event listener.
 */
export const useBarcodeScanner = ({
  inputRef,
  kodeBarangRef,
  updateKodeBarang,
  onSubmit,
}: UseBarcodeScannerProps) => {
  
  // Gunakan refs untuk state dan callback agar event listener tidak perlu di-rebind terus-menerus
  const callbacksRef = useRef({ onSubmit, updateKodeBarang });

  useEffect(() => {
    callbacksRef.current = { onSubmit, updateKodeBarang };
  }, [onSubmit, updateKodeBarang]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      // Abaikan shortcut sistem (Ctrl/Cmd/Alt)
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return;
      }

      // Pastikan hanya tombol karakter tunggal, backspace, atau enter yang ditangkap
      const isSupportedKey = event.key.length === 1 || event.key === "Backspace" || event.key === "Enter";
      if (!isSupportedKey || isTextInputTarget(event.target)) {
        return;
      }

      // Hindari saat select dropdown terbuka
      if (document.querySelector("[data-slot='select-content']")) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();

      if (event.key === "Enter") {
        void callbacksRef.current.onSubmit(kodeBarangRef.current);
        return;
      }

      if (event.key === "Backspace") {
        callbacksRef.current.updateKodeBarang((current) => current.slice(0, -1));
        return;
      }

      callbacksRef.current.updateKodeBarang((current) => `${current}${event.key}`);
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [inputRef, kodeBarangRef]); // Hanya bergantung pada ref yang stabil
};
