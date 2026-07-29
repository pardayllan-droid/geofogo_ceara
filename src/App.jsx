import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { Toaster } from '@/components/ui/toaster';
import { queryClientInstance } from '@/lib/query-client';

import ScrollToTop from '@/components/ScrollToTop';
import PageNotFound from '@/lib/PageNotFound';
import GeoFogo from '@/pages/GeoFogo';

/**
 * Componente principal da aplicação.
 *
 * O GeoFogo Ceará não utiliza autenticação.
 * A aplicação deve abrir diretamente na página principal.
 */
function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <BrowserRouter>
        <ScrollToTop />

        <Routes>
          <Route path="/" element={<GeoFogo />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>

        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;