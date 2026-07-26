"use client";

import { useBarangMasukLogic } from "@/features/barang-masuk/hooks/useBarangMasukLogic";
import { InboundFormCard } from "@/features/barang-masuk/components/InboundFormCard";
import { ScannedItemsTable } from "@/features/barang-masuk/components/ScannedItemsTable";

/**
 * Komponen BarangMasukPage
 * 
 * Modul operasional Gudang untuk mencatat penerimaan barang masuk.
 * Menangani pembuatan inventaris baru (untuk Admin/KP) dan 
 * penerimaan distribusi (untuk Mitra) dengan deteksi cerdas merek & lokasi rak.
 */
export default function BarangMasukPage() {
  const logic = useBarangMasukLogic();

  return (
    <div className="flex select-none min-h-[calc(100svh-3rem)] flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col flex-1 h-full gap-4 px-4 lg:px-6">
        <InboundFormCard
          user={logic.user}
          asalBarang={logic.asalBarang}
          setAsalBarang={logic.setAsalBarang}
          asalBarangManual={logic.asalBarangManual}
          setAsalBarangManual={logic.setAsalBarangManual}
          dbPartners={logic.dbPartners}
          dbModels={logic.dbModels}
          kodeBarang={logic.kodeBarang}
          updateKodeBarang={logic.updateKodeBarang}
          inputRef={logic.inputRef}
          kodeBarangRef={logic.kodeBarangRef}
          handleSubmit={logic.handleSubmit}
          itemCondition={logic.itemCondition}
          setItemCondition={logic.setItemCondition}
          tipeBarang={logic.tipeBarang}
          setTipeBarang={logic.setTipeBarang}
          brand={logic.brand}
          setBrand={logic.setBrand}
          kategori={logic.kategori}
          setKategori={logic.setKategori}
          dbBrands={logic.dbBrands}
          dbCategories={logic.dbCategories}
          catatan={logic.catatan}
          setCatatan={logic.setCatatan}
          focusKodeBarangInput={logic.focusKodeBarangInput}
        />

        <ScannedItemsTable
          barangMasuk={logic.session.barangMasuk}
          dbBrands={logic.dbBrands}
          dbCategories={logic.dbCategories}
          dbModels={logic.dbModels}
          dbLocations={logic.dbLocations}
          kuota={logic.session.kuota}
          asalBarang={logic.asalBarang}
          isSaving={logic.isSaving}
          handleUpdateInline={logic.session.updateInline}
          handleUpdateLokasi={logic.session.updateLokasi}
          handleDeleteItem={logic.session.deleteItem}
          handleValidateAll={logic.handleValidateAll}
          focusKodeBarangInput={logic.focusKodeBarangInput}
        />
      </div>
    </div>
  );
}
