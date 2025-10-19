import React from "react";

export type PageAlertType = "info" | "success" | "warning" | "error";

export default function PageAlert({
  type = "info",
  title,
  children,
  className = "",
}: {
  type?: PageAlertType;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles =
    type === "success"
      ? "border-green-200 bg-green-50 text-green-800"
      : type === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded border p-3 ${styles} ${className}`}>
      {title && <div className="font-semibold mb-1">{title}</div>}
      {children}
    </div>
  );
}
