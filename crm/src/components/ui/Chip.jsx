import React from 'react';

export const Chip = ({ className = '', children, ...props }) => (
  <button className={`chip ${className}`} type="button" {...props}>
    {children}
  </button>
);
