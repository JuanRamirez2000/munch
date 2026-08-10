import { Chip } from "@/components/ui/Chip";
import { PriceControl } from "@/components/ui/PriceControl";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { sliderToMiles, sliderToMinutes } from "@/lib/session/distance";
import { CUISINE_CYCLE, type FiltersEditorValue } from "@/lib/session/filters-editor";
import { CUISINE_OPTIONS } from "@/lib/session/types";

interface FiltersEditorProps {
  value: FiltersEditorValue;
  onChange: (value: FiltersEditorValue) => void;
}

// Cuisines / price / distance / weights controls, shared by Create Session and the lobby's
// "Edit settings" section so the two never drift out of sync.
export function FiltersEditor({ value, onChange }: FiltersEditorProps) {
  function cycleCuisine(name: string) {
    onChange({ ...value, cuisines: { ...value.cuisines, [name]: CUISINE_CYCLE[value.cuisines[name]] } });
  }

  const miles = sliderToMiles(value.distance);
  const minutes = sliderToMinutes(value.distance);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <div className="text-[13px] font-bold uppercase tracking-[0.04em] text-ink-muted">Cuisines</div>
        <div className="flex flex-wrap gap-2">
          {CUISINE_OPTIONS.map((cuisine) => (
            <Chip key={cuisine} label={cuisine} state={value.cuisines[cuisine]} onClick={() => cycleCuisine(cuisine)} />
          ))}
        </div>
        <div className="text-[11.5px] text-ink-faint">Tap to include, tap again to exclude</div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="text-[13px] font-bold uppercase tracking-[0.04em] text-ink-muted">Price</div>
        <PriceControl value={value.price} onChange={(price) => onChange({ ...value, price })} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-ink-muted">Distance</span>
          <span className="text-[13px] font-semibold text-accent">
            {minutes} min · {miles} mi
          </span>
        </div>
        <RangeSlider value={value.distance} onChange={(distance) => onChange({ ...value, distance })} />
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="text-[13px] leading-snug text-ink-faint">
          Weights nudge places that work well for the whole group toward the top of the deck.
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px] font-semibold text-ink">Distance importance</div>
          <RangeSlider value={value.distImportance} onChange={(distImportance) => onChange({ ...value, distImportance })} />
          <div className="flex justify-between text-[11px] text-ink-faint">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-[14px] font-semibold text-ink">Cuisine-match importance</div>
          <RangeSlider
            value={value.cuisineImportance}
            onChange={(cuisineImportance) => onChange({ ...value, cuisineImportance })}
          />
          <div className="flex justify-between text-[11px] text-ink-faint">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </>
  );
}
