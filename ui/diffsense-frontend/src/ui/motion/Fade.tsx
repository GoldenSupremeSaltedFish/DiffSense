import React from "react";

type FadeProps = {
  show?: boolean;
  className?: string;
  children: React.ReactNode;
};

const Fade: React.FC<FadeProps> = ({ show = true, className, children }) => {
  const anim = show ? "animate-fade-in" : "animate-fade-out";
  return <div className={`${anim} ${className || ""}`}>{children}</div>;
};

export default Fade;

