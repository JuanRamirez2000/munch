interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

// Native range input per the handoff — "wire directly to app state, no custom slider needed."
export function RangeSlider({ value, onChange, min = 0, max = 100 }: RangeSliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
  );
}
