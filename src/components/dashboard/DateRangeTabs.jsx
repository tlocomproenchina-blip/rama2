import React from "react";
import { Button } from "@/components/ui/button";

const options = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

export default function DateRangeTabs({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
      {options.map((opt) => (
        <Button
          key={opt.key}
          variant={value === opt.key ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(opt.key)}
          className={`rounded-md ${value === opt.key ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}