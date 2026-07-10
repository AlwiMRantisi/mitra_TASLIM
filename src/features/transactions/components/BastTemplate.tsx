import { forwardRef } from "react";

interface BastAllocation {
  materialNumber: string;
  materialName: string;
  serialNumber: string;
  quantity: number;
  unit: string;
}

interface BastTemplateProps {
  documentNumber: string;
  requesterName: string;
  generatedByName: string;
  bastDate: string; // ISO date string
  allocations: BastAllocation[];
}

function formatTanggalBAST(isoDate: string): string {
  const date = new Date(isoDate);
  const hari = date.toLocaleDateString("id-ID", { weekday: "long" });
  const tanggal = date.getDate();
  const bulan = date.toLocaleDateString("id-ID", { month: "long" });
  const tahun = date.getFullYear();
  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}

const PlnIconPlusLogo = () => (
  <svg viewBox="0 0 200 60" className="h-12 w-auto" xmlns="http://www.w3.org/2000/svg">
    {/* Lightning bolt */}
    <polygon points="30,2 18,28 28,28 14,58 40,24 28,24 38,2" fill="#F7B731" stroke="#E6A020" strokeWidth="1" />
    {/* PLN text */}
    <text x="50" y="24" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="18" fill="#005BAC">PLN</text>
    {/* ICON PLUS text */}
    <text x="50" y="44" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill="#00A550">ICON PLUS</text>
  </svg>
);

const BastTemplate = forwardRef<HTMLDivElement, BastTemplateProps>(
  ({ documentNumber: _documentNumber, requesterName, generatedByName, bastDate, allocations }, ref) => {
    const formattedDate = formatTanggalBAST(bastDate);

    return (
      <div
        ref={ref}
        id="bast-printable"
        className="bg-white text-black p-8 print:p-0 text-[13px] print:w-full print:block"
      >
        <style>
          {`
            @media print {
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
            }
          `}
        </style>

        {/* ===== HEADER ===== */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-6">
          <div className="flex-1">
            <p className="font-bold text-[15px] leading-tight">PT.PLN ICON PLUS</p>
            <p className="font-bold text-[13px] leading-tight">SBU REGIONAL JAWA BARAT</p>
            <p className="text-[11px] leading-tight mt-1">Jl. WR.Supratman No.58 Bandung 40121 - Jawa Barat</p>
            <p className="text-[11px] leading-tight">Tel.022-7200262</p>
          </div>
          <div className="flex-shrink-0 ml-4">
            <PlnIconPlusLogo />
          </div>
        </div>

        {/* ===== JUDUL ===== */}
        <h1 className="text-center font-bold text-[16px] underline mb-6">
          BUKTI SERAH TERIMA BARANG
        </h1>

        {/* ===== PARAGRAF PEMBUKA ===== */}
        <p className="mb-4">
          Pada hari ini, <span className="italic">{formattedDate}</span> yang bertanda tangan dibawah ini:
        </p>

        {/* ===== PIHAK ===== */}
        <div className="mb-4 space-y-1">
          <div className="flex">
            <span className="w-32 font-semibold">PIHAK Pertama</span>
            <span className="mr-2">:</span>
            <span>PLN Icon Plus SBU Regional Jawa Barat</span>
          </div>
          <div className="flex">
            <span className="w-32 font-semibold">PIHAK Kedua</span>
            <span className="mr-2">:</span>
            <span>{requesterName}</span>
          </div>
        </div>

        {/* ===== TEKS PENGANTAR ===== */}
        <p className="mb-2">
          Telah diserahterimakan barang-barang dibawah ini, untuk pekerjaan:
        </p>

        <div className="mb-4 flex">
          <span className="font-semibold w-40">Pekerjaan / Proyek</span>
          <span className="mr-2">:</span>
          <span>Gangguan SBU REG JABAR</span>
        </div>

        {/* ===== TABEL BARANG ===== */}
        <table className="w-full border-collapse border border-black mb-6 text-[7px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-1 text-center w-2">No</th>
              <th className="border border-black px-2  text-center">Material Number</th>
              <th className="border border-black px-2  text-center">Nama Barang</th>
              <th className="border border-black  text-center w-10">Jumlah</th>
              <th className="border border-black px-2  text-center w-10">Satuan</th>
              <th className="border border-black px-2  text-center">Serial Number</th>
              <th className="border border-black px-2 text-center">Ket</th>
            </tr>
          </thead>
          <tbody>
            {allocations.length > 0 ? (
              allocations.map((item, index) => (
                <tr key={index}>
                  <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.materialNumber}</td>
                  <td className="border border-black px-2 py-1">{item.materialName}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.unit}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.serialNumber}</td>
                  <td className="border border-black px-2 py-1"></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="border border-black px-2 py-3 text-center text-gray-400 italic">
                  Belum ada barang yang dialokasikan
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ===== DISCLAIMER ===== */}
        <p className="italic mb-8 text-[11px]">
          Barang tersebut telah diterima dalam kondisi baik, segala bentuk kerusakan dan kehilangan menjadi tanggung jawab Pihak Kedua, dan tanda terima ini agar dapat dipergunakan sebagaimana mestinya.
        </p>

        {/* ===== TANDA TANGAN ===== */}
        <div className="flex justify-between mt-10 px-8">
          <div className="text-center">
            <p className="font-semibold mb-20">Pihak Kedua</p>
            <p className="border-t border-black pt-1 px-4 inline-block">{requesterName}</p>
          </div>
          <div className="text-center">
            <p className="font-semibold mb-20">Pihak Pertama</p>
            <p className="border-t border-black pt-1 px-BastTe4 inline-block">{generatedByName}</p>
          </div>
        </div>
      </div>
    );
  }
);

BastTemplate.displayName = "BastTemplate";

export default BastTemplate;
