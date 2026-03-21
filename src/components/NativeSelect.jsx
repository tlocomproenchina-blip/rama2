import React, { useState } from "react";

export default function NativeSelect({
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar...",
  className = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);

  const isNative =
    typeof window !== "undefined" &&
    window.Capacitor?.isNativePlatform?.() === true;

  const selected = options.find((o) => o.value === value);

  if (!isNative) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          textAlign: "left",
          fontSize: "15px",
          color: selected ? "#111827" : "#9ca3af",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <span style={{ fontSize: "12px" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              zIndex: 99998,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "white",
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
              zIndex: 99999,
              maxHeight: "50vh",
              overflowY: "auto",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid #f3f4f6",
                textAlign: "center",
                fontWeight: "600",
                color: "#374151",
              }}
            >
              {placeholder}
            </div>
            {options.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                disabled={opt.disabled}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  border: "none",
                  borderBottom: "1px solid #f3f4f6",
                  backgroundColor: opt.value === value ? "#f0f0ff" : "white",
                  textAlign: "left",
                  fontSize: "15px",
                  color: opt.value === value ? "#6c63ff" : "#374151",
                  fontWeight: opt.value === value ? "600" : "400",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  opacity: opt.disabled ? 0.5 : 1,
                }}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                backgroundColor: "#f9fafb",
                color: "#ef4444",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}