import { useState, useMemo } from "react";
import { Search, X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ModelSelectPopoverProps {
  models: any[];
  value: string;
  onChange: (val: string) => void;
  onCloseFocus?: () => void;
  placeholder?: string;
}

export function ModelSelectPopover({
  models,
  value,
  onChange,
  onCloseFocus,
  placeholder = "Pilih Model",
}: ModelSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter((m) => {
      const nama = (m.nama || "").toLowerCase();
      const brand = (m.brand?.nama || m.brand?.name || "").toLowerCase();
      return nama.includes(q) || brand.includes(q);
    });
  }, [models, search]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
    if (onCloseFocus) {
      setTimeout(onCloseFocus, 0);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 px-3 font-normal text-muted-foreground bg-background hover:bg-background"
        >
          <span className="truncate text-foreground font-medium">
            {value
              ? (() => {
                const found = models.find((m) => m.nama === value);
                const brandName = found?.brand?.nama || found?.brand?.name;
                return brandName ? `${value} (${brandName})` : value;
              })()
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-muted/20">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              className="w-full text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Cari nama model / merek..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-xs"
                onClick={() => setSearch("")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto p-2 text-xs">
          {filteredModels.length === 0 ? (
            <div className="p-3 text-center text-muted-foreground">Model tidak ditemukan</div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = value === model.nama;
              return (
                <div
                  key={model.id}
                  className={`flex items-center justify-between px-2.5 py-2 rounded cursor-pointer hover:bg-accent transition-colors ${isSelected ? "bg-accent font-semibold text-primary" : ""
                    }`}
                  onClick={() => handleSelect(model.nama)}
                >
                  <span>{model.nama}</span>
                  {isSelected && <Check className="size-4 text-primary shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
