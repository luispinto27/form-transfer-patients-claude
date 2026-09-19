import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Render in the browser: the form reads ?autorizacion=NUMERO from the
    // URL on load and fires a live query against the backend, so a static
    // prerendered shell would show stale/no data.
    path: 'registro',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
