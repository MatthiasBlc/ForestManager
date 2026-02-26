interface ServingsSelectorProps {
  baseServings: number;
  value: number;
  onChange: (n: number) => void;
}

const ServingsSelector = ({ baseServings: _baseServings, value, onChange }: ServingsSelectorProps) => {
  const decrement = () => {
    if (value > 1) onChange(value - 1);
  };

  const increment = () => {
    if (value < 100) onChange(value + 1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 100) {
      onChange(val);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="join">
        <button
          type="button"
          className="btn btn-sm join-item"
          onClick={decrement}
          disabled={value <= 1}
        >
          -
        </button>
        <input
          type="number"
          className="input input-bordered input-sm join-item w-16 text-center"
          value={value}
          onChange={handleChange}
          min={1}
          max={100}
        />
        <button
          type="button"
          className="btn btn-sm join-item"
          onClick={increment}
          disabled={value >= 100}
        >
          +
        </button>
      </div>
      <span className="text-sm text-base-content/70">personnes</span>
    </div>
  );
};

export default ServingsSelector;
