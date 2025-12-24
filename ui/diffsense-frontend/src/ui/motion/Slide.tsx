import React from "react";

type SlideProps = {
  in?: boolean;
  className?: string;
  children: React.ReactNode;
};

const Slide: React.FC<SlideProps> = ({ in: isIn = true, className, children }) => {
  const state = isIn ? "animate-slide-y-in" : "opacity-0 translate-y-2";
  return <div className={`${state} ${className || ""}`}>{children}</div>;
};

export default Slide;

