import { h, type FunctionalComponent } from '@stencil/core';
import { Route, type RouteParams } from '@stencil/router';
import type { RoutePath } from '@stencil/router/dist/types.js';
import type { Config } from './config.utils.js';

export type GenericRouteContext = {
  activeRoute: string;
  config: Config;
  routeParams?: RouteParams;
  searchParams?: Record<string, string>;
};

export type GenericPageRouteProps = {
  context: GenericRouteContext;
  path: RoutePath;
  src: string;
};

export const GenericPageRoute: FunctionalComponent<GenericPageRouteProps> = ({ context, path, src }) => (
  <Route
    path={path}
    render={(routeParams: RouteParams) => {
      const url = new URL(context.activeRoute, location.origin);
      const searchParams = Object.fromEntries(url.searchParams);
      return <kvlm-generic-page context={{ ...context, routeParams, searchParams }} src={src} />;
    }}
  />
);
