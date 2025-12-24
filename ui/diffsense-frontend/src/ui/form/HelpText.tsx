import React from "react";

type HelpTextProps = {
  children: React.ReactNode;
  className?: string;
};

const HelpText: React.FC<HelpTextProps> = ({ children, className }) => {
  return (
    <p className={`text-xs text-muted ${className || ""}`}>{children}</p>
  );
};

export default HelpText;

