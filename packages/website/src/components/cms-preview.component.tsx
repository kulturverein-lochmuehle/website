import React from 'react';

export type CmsPreviewProps = {
  uiSrc: string;
  children?: React.ReactNode[];
};

export const CmsPreview: React.FC<CmsPreviewProps> = ({ children, uiSrc }) => {
  React.useLayoutEffect(() => {
    // add ui components to preview iframe
    const preview = document.getElementById('preview-pane') as HTMLIFrameElement | null;
    if (preview === null) return;

    const existing = preview.contentDocument?.getElementById('ui-components');
    if (existing !== null) return;

    const uiComponents = preview.contentDocument?.createElement('script');
    uiComponents?.setAttribute('id', 'ui-components');
    uiComponents?.setAttribute('src', uiSrc);
    uiComponents?.setAttribute('type', 'module');

    preview.contentDocument?.head.appendChild(uiComponents!);
  }, [uiSrc]);

  return <>{children}</>;
};
