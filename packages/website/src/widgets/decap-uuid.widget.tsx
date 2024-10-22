import React from 'react';
import type { CmsWidgetControlProps } from 'decap-cms-core';

// https://github.com/decaporg/decap-cms/issues/1975#issuecomment-1221579538
// https://github.com/ai/nanoid
// prettier-ignore
export function nanoid(t = 21) {
  return crypto
    .getRandomValues(new Uint8Array(t))
    .reduce((t, e) => (t += (e &= 63) < 36 ? e.toString(36) : e < 62 ? (e - 26).toString(36).toUpperCase() : e > 62 ? '-' : '_'), '');
}

export const UuidWidget: React.FC<CmsWidgetControlProps<string>> = ({ forID, value, onChange }) => {
  React.useEffect(() => {
    if (!value) onChange(nanoid());
  }, []);
  return (
    <span id={forID} style={{ fontFamily: 'monospace', marginLeft: '1rem' }}>
      {value}
    </span>
  );
};
