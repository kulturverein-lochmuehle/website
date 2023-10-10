import { Commands, Context, PreventResult, Route } from '@vaadin/router';

export const ROOT_ROUTES: Route[] = [
  {
    path: '/',
    redirect: '/verein'
  },
  {
    path: '/verein',
    component: 'kvlm-page-demo',
    children: [
      {
        path: '/',
        redirect: '/willkommen'
      },
      {
        path: '/willkommen',
        component: 'kvlm-page-demo',
        action: async (context: Context, commands: Commands) => {
          console.log('ROOT_ROUTES', context);
          // return commands.prevent();
        }
      },
      {
        path: '/neues',
        component: 'kvlm-page-demo',
        action: async (context: Context, commands: Commands) => {
          console.log('ROOT_ROUTES', context);
          // return commands.prevent();
        }
      }
    ]
  },
  {
    path: '(.*)',
    action: async () => {
      const temp = document.createElement('div');
      temp.innerHTML = '<h1>404 Not found</h1>';
      return temp;
    }
  }
];
