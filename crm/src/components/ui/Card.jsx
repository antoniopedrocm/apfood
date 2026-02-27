import React from 'react';

export const Card = ({ className = '', children, ...props }) => (
  <article className={`card ${className}`} {...props}>
    {children}
  </article>
);
