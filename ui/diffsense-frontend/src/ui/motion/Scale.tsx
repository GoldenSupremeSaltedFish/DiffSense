import React from "react";

type ScaleProps = {
  in?: boolean;
  className?: string;
  children: React.ReactNode;
};

const Scale: React.FC<ScaleProps> = ({ in: isIn = true, className, children }) => {
  const state = isIn ? "animate-scale-in" : "opacity-0 scale-95";
  return <div className={`${state} ${className || ""}`}>{children}</div>;
};

export default Scale;

