const LABELS = ["$", "$$", "$$$", "$$$$"];

interface PriceControlProps {
  value: number;
  onChange: (value: number) => void;
}

export function PriceControl({ value, onChange }: PriceControlProps) {
  return (
    <div className="flex gap-1.5 rounded-control bg-surface-alt p-1">
      {LABELS.map((label, index) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(index)}
          className={`flex-1 rounded-[9px] py-2.5 text-[14px] font-bold transition-colors ${
            value === index ? "bg-accent text-white" : "text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
