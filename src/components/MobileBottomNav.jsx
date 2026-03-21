import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { path: "/Dashboard", label: "Inicio", icon: "🏠" },
  { path: "/MyPackages", label: "Paquetes", icon: "📦" },
  { path: "/MyInvoices", label: "Facturas", icon: "🧾" },
  { path: "/Support", label: "Soporte", icon: "💬" },
  { path: "/Profile", label: "Perfil", icon: "👤" },
];

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isNative =
    typeof window !== "undefined" &&
    window.Capacitor?.isNativePlatform?.() === true;

  if (!isNative) return null;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "64px",
        backgroundColor: "#ffffff",
        borderTop: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 9999,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              height: "100%",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: isActive ? "#6c63ff" : "#9ca3af",
              fontSize: "10px",
              fontWeight: isActive ? "600" : "400",
              gap: "2px",
            }}
          >
            <span style={{ fontSize: "22px" }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}