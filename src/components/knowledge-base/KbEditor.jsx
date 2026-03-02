import React from "react";
import ReactQuill from "react-quill";

export default function KbEditor({ value, onChange, className = "" }) {
  return (
    <div className={`min-h-[220px] ${className}`}>
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={onChange}
      />
    </div>
  );
}