import React from "react";

type FieldProps = {
  className?: string;
  children: React.ReactNode;
};

const Field: React.FC<FieldProps> = ({ className, children }) => {
  return (
    <div className={`space-y-1 ${className || ""}`}>
      {children}
    </div>
  );
};

export default Field;

