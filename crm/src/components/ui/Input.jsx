import React from 'react';

export const Input = ({ className = '', ...props }) => <input className={`input ${className}`} {...props} />;
