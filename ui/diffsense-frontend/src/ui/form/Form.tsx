import React from "react";

type FormProps = {
  className?: string;
  children: React.ReactNode;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
};

const Form: React.FC<FormProps> = ({ className, children, onSubmit }) => {
  return (
    <form
      onSubmit={onSubmit}
      className={`space-y-3 text-text ${className || ""}`}
    >
      {children}
    </form>
  );
};

export default Form;

