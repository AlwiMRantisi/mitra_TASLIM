import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { detectMitraFromSN } from "../utils/brandDetector";
import { ModelSelectPopover } from "./ModelSelectPopover";
import type { Partner } from "@/types/partner";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InboundFormCardProps {
  user: any;
  asalBarang: string;
  setAsalBarang: (val: string) => void;
  asalBarangManual: boolean;
  setAsalBarangManual: (val: boolean) => void;
  dbPartners: Partner[];
  dbModels: any[];
  kodeBarang: string;
  updateKodeBarang: (val: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  kodeBarangRef: React.MutableRefObject<string>;
  handleSubmit: (kode?: string) => void;
  itemCondition: "baru" | "dismantle" | "rusak";
  setItemCondition: (val: "baru" | "dismantle" | "rusak") => void;
  tipeBarang: string;
  setTipeBarang: (val: string) => void;
  brand: string;
  setBrand: (val: string) => void;
  kategori: string;
  setKategori: (val: string) => void;
  dbBrands: any[];
  dbCategories: any[];
  catatan: string;
  setCatatan: (val: string) => void;
  focusKodeBarangInput: () => void;
}

export function InboundFormCard({
  user,
  asalBarang,
  setAsalBarang,
  asalBarangManual,
  setAsalBarangManual,
  dbPartners,
  dbModels,
  kodeBarang,
  updateKodeBarang,
  inputRef,
  kodeBarangRef,
  handleSubmit,
  itemCondition,
  setItemCondition,
  tipeBarang,
  setTipeBarang,
  brand,
  setBrand,
  kategori,
  setKategori,
  dbBrands,
  dbCategories,
  catatan,
  setCatatan,
  focusKodeBarangInput,
}: InboundFormCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="@container/card flex flex-col w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <div className="px-4 md:px-6 pb-1 flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* <Label htmlFor="kode-barang-manual">Serial Number</Label> */}
              <Input
                ref={inputRef}
                id="kode-barang-manual"
                value={kodeBarang}
                onChange={(event) => updateKodeBarang(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSubmit(kodeBarangRef.current);
                  }
                }}
                placeholder="Scan barcode atau ketik manual di sini..."
              />
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="lg" className="w-9 h-9 p-0 text-muted-foreground cursor-pointer bg-muted">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="sr-only">Toggle</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {user?.role === "mitra" && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs leading-5 text-sky-600 dark:text-sky-400 space-y-1">
              <p className="font-semibold">Ketentuan Penerimaan Barang Mitra</p>
              <p>Barang hanya dapat diterima jika sudah berstatus <span className="font-semibold">Keluar</span> atau <span className="font-semibold">Diluar</span> dari KP. Barang yang masih tersimpan di gudang KP tidak dapat dipindah ke gudang mitra.</p>
            </div>
          )}
        </div>

        <CollapsibleContent className="pt-4">
          <CardContent className="px-4 md:px-6 pb-2 pt-0">
            <div className="border-t border-dashed mb-4"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kolom Kiri */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="asal-barang">Asal Barang</Label>
                  <Select
                    value={asalBarang}
                    onValueChange={(value) => {
                      setAsalBarang(value);
                      setAsalBarangManual(true);
                      focusKodeBarangInput();
                    }}
                  >
                    <SelectTrigger id="asal-barang" className="w-full">
                      <SelectValue placeholder="Pilih asal barang..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SBU Regional Jawa Barat">SBU Regional Jawa Barat</SelectItem>
                      {dbPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.name}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!asalBarangManual && detectMitraFromSN(kodeBarang, dbPartners) && (
                    <p className="text-xs text-sky-600 dark:text-sky-400">
                      Terdeteksi otomatis dari SN
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tipe-barang">Model</Label>
                  <ModelSelectPopover
                    models={dbModels}
                    value={tipeBarang}
                    onChange={setTipeBarang}
                    onCloseFocus={focusKodeBarangInput}
                    placeholder="Pilih Model (wajib jika SN belum terdaftar)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="brand">Brand</Label>
                    <Select value={brand} onValueChange={setBrand}>
                      <SelectTrigger id="brand" className="w-full">
                        <SelectValue placeholder="Otomatis dari SN" />
                      </SelectTrigger>
                      <SelectContent>
                        {dbBrands.map((b, i) => (
                          <SelectItem key={b.id || b.name || i} value={b.name || b.nama}>
                            {b.name || b.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kategori">Kategori</Label>
                    <Select value={kategori} onValueChange={setKategori}>
                      <SelectTrigger id="kategori" className="w-full">
                        <SelectValue placeholder="Otomatis dari SN" />
                      </SelectTrigger>
                      <SelectContent>
                        {dbCategories.map((c, i) => (
                          <SelectItem key={typeof c === 'string' ? c : (c.id || i)} value={typeof c === 'string' ? c : (c.name || c.nama)}>
                            {typeof c === 'string' ? c : (c.name || c.nama)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan */}
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label>Kondisi Material</Label>
                  <RadioGroup
                    value={itemCondition}
                    onValueChange={(val) => {
                      const condition = val as "baru" | "dismantle" | "rusak";
                      setItemCondition(condition);
                      if (condition === "baru") {
                        setCatatan("");
                      }
                      focusKodeBarangInput();
                    }}
                    className="flex gap-4 pt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="baru" id="condition-baru" />
                      <Label htmlFor="condition-baru" className="cursor-pointer font-normal">
                        Baru
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dismantle" id="condition-dismantle" />
                      <Label htmlFor="condition-dismantle" className="cursor-pointer font-normal">
                        Dismantle
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="rusak" id="condition-rusak" />
                      <Label htmlFor="condition-rusak" className="cursor-pointer font-normal">
                        Rusak
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {itemCondition === "rusak" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="dismantle-remark">Kerusakan</Label>
                    <Textarea
                      id="dismantle-remark"
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Masukkan kerusakan..."
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Kategori dan Merek akan terdeteksi otomatis dari SN.
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

