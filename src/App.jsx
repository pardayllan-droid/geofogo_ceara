/**
 * App
 *
 * Ponto principal de composição da aplicação.
 *
 * O GeoFogo Ceará não utiliza autenticação.
 * Todas as funcionalidades operacionais são
 * disponibilizadas diretamente na rota principal.
 */

import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom';

import {
  QueryClientProvider,
} from '@tanstack/react-query';

import ScrollToTop from '@/components/ScrollToTop';
import { Toaster } from '@/components/ui/toaster';

import PageNotFound from '@/lib/PageNotFound';
import { queryClientInstance } from '@/lib/query-client';

import GeoFogo from '@/pages/GeoFogo';

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={<GeoFogo />}
      />

      <Route
        path="*"
        element={<PageNotFound />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider
      client={queryClientInstance}
    >
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ScrollToTop />

        <AppRoutes />
      </BrowserRouter>

      <Toaster />
    </QueryClientProvider>
  );
}