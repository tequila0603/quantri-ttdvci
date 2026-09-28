with open('frontend/src/pages/FinancePage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("useApiData<Summary>(`/reports/summary?year=${timeFilter.year}`, user)",
              "useApiData<Summary>(`/reports/summary?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}${parkFilter ? `&parkCode=${parkFilter}` : ''}`, user)")
c = c.replace("useApiData<Page<LeaseRow>>(`/reports/lease-annual?year=${timeFilter.year}&limit=100${parkFilter ? `&parkCode=${encodeURIComponent(parkFilter)}` : ''}`, user)",
              "useApiData<Page<LeaseRow>>(`/reports/lease-annual?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}&limit=100${parkFilter ? `&parkCode=${encodeURIComponent(parkFilter)}` : ''}`, user)")
c = c.replace("useApiData<Page<ReceivableRow>>(receivablesReady ? '/reports/receivables?limit=100' : null, user)",
              "useApiData<Page<ReceivableRow>>(receivablesReady ? `/reports/receivables?fromDate=${timeFilter.fromDate}&toDate=${timeFilter.toDate}&limit=100${parkFilter ? `&parkCode=${encodeURIComponent(parkFilter)}` : ''}` : null, user)")

with open('frontend/src/pages/FinancePage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Updated API calls in FinancePage.tsx")
