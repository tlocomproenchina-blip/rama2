import React from "react";
import { Button } from "@/components/ui/button";

const options = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

export default function DateRangeSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {options.map((opt) => (
        <Button
          key={opt.key}
          variant={value === opt.key ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(opt.key)}
          className={value === opt.key ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}