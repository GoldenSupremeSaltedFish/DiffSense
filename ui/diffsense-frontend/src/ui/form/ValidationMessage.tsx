import React from "react";
import Fade from "../motion/Fade";

type ValidationMessageProps = {
  show?: boolean;
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
};

const colorMap = {
  error: "text-red-600",
  success: "text-green-600",
  info: "text-subtle",
};

const ValidationMessage: React.FC<ValidationMessageProps> = ({
  show = false,
  variant = "info",
  children,
  className,
}) => {
  const color = colorMap[variant] || "text-subtle";
  return (
    <Fade show={show} className={`text-xs ${color} ${className || ""}`}>
      {children}
    </Fade>
  );
};

export default ValidationMessage;

