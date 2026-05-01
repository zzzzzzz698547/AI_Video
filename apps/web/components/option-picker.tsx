"use client";

type OptionItem = {
  value: string;
  label: string;
  description?: string;
};

type OptionPickerProps = {
  label: string;
  value: string;
  options: OptionItem[];
  onChange: (value: string) => void;
  helperText?: string;
  compact?: boolean;
};

export function OptionPicker({ label, value, options, onChange, helperText, compact }: OptionPickerProps) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {helperText ? <span className="helper-text">{helperText}</span> : null}
      <div className={compact ? "choice-grid choice-grid-compact" : "choice-grid"}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`choice-option ${active ? "choice-option-active" : ""}`}
              onClick={() => onChange(option.value)}
            >
              <strong className="choice-title">{option.label}</strong>
              {option.description ? <span className="choice-description">{option.description}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
