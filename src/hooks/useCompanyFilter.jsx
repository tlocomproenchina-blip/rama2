import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ALL_COMPANIES, matchesCompanyFilter } from '@/lib/companyScope';

const STORAGE_KEY = 'tlec-company-filter';

// Filtro de empresa compartido por las pantallas administrativas: carga las
// empresas socias activas, recuerda la selección y filtra listas de registros
// que tengan company_code.
export default function useCompanyFilter({ storageKey = STORAGE_KEY } = {}) {
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [companyCode, setCompanyCodeState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || ALL_COMPANIES;
    } catch (_) {
      return ALL_COMPANIES;
    }
  });

  const loadCompanies = useCallback(async () => {
    try {
      const rows = await base44.entities.PartnerCompany.filter({ is_active: true }, 'company_name', 200);
      setCompanies(rows || []);
    } catch (_) {
      setCompanies([]);
    }
    setLoadingCompanies(false);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const setCompanyCode = useCallback((value) => {
    setCompanyCodeState(value);
    try { localStorage.setItem(storageKey, value); } catch (_) {}
  }, [storageKey]);

  const matches = useCallback((record) => matchesCompanyFilter(record, companyCode), [companyCode]);
  const filterRecords = useCallback(
    (records) => (records || []).filter((record) => matchesCompanyFilter(record, companyCode)),
    [companyCode]
  );

  return {
    companies,
    loadingCompanies,
    companyCode,
    setCompanyCode,
    matches,
    filterRecords,
    reloadCompanies: loadCompanies,
    isFiltered: companyCode !== ALL_COMPANIES,
  };
}