import React from 'react';

export type CmsPreviewProps = {
  children: React.ReactNode[];
};

export const CmsPreview: React.FC<CmsPreviewProps> = ({ children }) => {
  const UI_ROOT = import.meta.env.MODE === 'development' ? 'http://localhost:3500' : '/ui';

  React.useLayoutEffect(() => {
    // add ui components
    const preview = document.getElementById('preview-pane') as HTMLIFrameElement | null;
    const uiComponents = preview?.contentDocument?.createElement('script');
    uiComponents?.setAttribute('id', 'ui-components');
    uiComponents?.setAttribute('src', `${UI_ROOT}/index.js`);
    uiComponents?.setAttribute('type', 'module');

    preview?.contentDocument?.getElementById('ui-components')?.remove();
    preview?.contentDocument?.head.appendChild(uiComponents!);
  }, [UI_ROOT]);

  return <>{children}</>;
};
