import { QueryClient } from '@tanstack/react-query';
import { setupQueryPersistence } from '@/lib/queryPersist';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
			// Datos considerados frescos por 1 min: evita refetches al cambiar de página
			staleTime: 60 * 1000,
			// Conserva en memoria 5 min para volver a una página al instante
			gcTime: 5 * 60 * 1000,
		},
	},
});

// Restaura los últimos datos guardados al abrir la app (modo offline)
setupQueryPersistence(queryClientInstance);