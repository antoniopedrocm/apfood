import React from 'react';

export const Badge = ({ tone = 'accent', className = '', children }) => (
  <span className={`badge badge-${tone} ${className}`}>{children}</span>
);
