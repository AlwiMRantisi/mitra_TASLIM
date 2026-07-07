import { invoke, isTauri } from "@tauri-apps/api/core"

type SaveExportFileOptions = {
  fileName: string
  contents: string | number[] | Uint8Array | ArrayBuffer
}

type SaveExportFileResult = {
  saved: boolean
  path?: string
}

const downloadInBrowser = (fileName: string, contents: string | number[] | Uint8Array | ArrayBuffer) => {
  const isXlsx = fileName.endsWith(".xlsx");
  const blobData = Array.isArray(contents) ? new Uint8Array(contents) : contents;
  const blob = new Blob([blobData], {
    type: isXlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv;charset=utf-8",
  })
  const downloadUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement("a")

  downloadLink.href = downloadUrl
  downloadLink.download = fileName
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}

export async function saveExportFile({
  fileName,
  contents,
}: SaveExportFileOptions): Promise<SaveExportFileResult> {
  if (!isTauri()) {
    downloadInBrowser(fileName, contents)
    return { saved: true }
  }

  try {
    let data: number[];
    if (typeof contents === "string") {
      data = Array.from(new TextEncoder().encode(contents));
    } else if (contents instanceof ArrayBuffer) {
      data = Array.from(new Uint8Array(contents));
    } else if (contents instanceof Uint8Array) {
      data = Array.from(contents);
    } else {
      data = contents;
    }

    const path = await invoke<string>("save_arxiva_file", {
      subfolder: "excel",
      filename: fileName,
      data,
    });
    return { saved: true, path };
  } catch (error) {
    console.error("Gagal menyimpan file ekspor ke folder arxiva/excel:", error);
    return { saved: false };
  }
}
