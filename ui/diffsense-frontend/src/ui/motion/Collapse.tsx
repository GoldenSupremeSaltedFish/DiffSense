import React from "react";

type CollapseProps = {
  open?: boolean;
  className?: string;
  children: React.ReactNode;
};

const Collapse: React.FC<CollapseProps> = ({ open = false, className, children }) => {
  const state = open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0";
  return (
    <div
      className={`overflow-hidden transition-all duration-normal ease-standard ${state} ${className || ""}`}
    >
      {children}
    </div>
  );
};

export default Collapse;

