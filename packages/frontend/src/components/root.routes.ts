import { Route } from '@vaadin/router';

export const ROOT_ROUTES: Route[] = [
  {
    path: '/',
    redirect: '/verein/willkommen'
  },
  {
    path: '/verein/:section',
    component: 'kvlm-page-verein'
  },
  {
    path: '(.*)',
    action: async () => {
      const temp = document.createElement('article');
      temp.innerHTML = '<h1>404 Not found</h1>';
      return temp;
    }
  }
];
