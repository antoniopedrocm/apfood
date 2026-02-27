import React from 'react';

const variantClassMap = {
  primary: 'btn-primary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

export const Button = ({ variant = 'primary', className = '', children, ...props }) => (
  <button className={`btn ${variantClassMap[variant] || variantClassMap.primary} ${className}`} {...props}>
    {children}
  </button>
);
