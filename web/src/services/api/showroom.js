import fetchWithAuth from './fetchWithAuth.js'

// Dashboard
export const getShowroomDashboard = () => fetchWithAuth('/showroom/dashboard')

// Sales Dashboard
export const getSalesDashboard = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/penjualan/dashboard${query ? '?' + query : ''}`)
}
export const exportSalesDashboard = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/penjualan/export${query ? '?' + query : ''}`, { responseType: 'blob' })
}

// Label Buku Service
export const getServiceBookLabels = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/label-buku-service${query ? '?' + query : ''}`)
}

// Tandai / batalkan tanda "sudah dicetak" untuk label buku service
export const setServiceBookLabelPrinted = (soNumbers, printed) =>
  fetchWithAuth('/showroom/label-buku-service/print-status', {
    method: 'PATCH',
    body: { so_numbers: soNumbers, printed },
  })

// Lookup data penjualan untuk Cetak STCK (cari per no mesin, filter hari ini/kemarin/semua)
export const getStckSalesLookup = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/stck/sales-lookup${query ? '?' + query : ''}`)
}

// Sales Order Margins
export const getSalesOrderMargins = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/sales-order-margins${query ? '?' + query : ''}`)
}
export const previewSalesOrderMargin = (data) => fetchWithAuth('/showroom/sales-order-margins/preview', { method: 'POST', body: data })
export const createSalesOrderMargin = (data) => fetchWithAuth('/showroom/sales-order-margins', { method: 'POST', body: data })
export const updateSalesOrderMargin = (id, data) => fetchWithAuth(`/showroom/sales-order-margins/${id}`, { method: 'PATCH', body: data })

// Stock Units
export const getShowroomStockUnits = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/stock-units${query ? '?' + query : ''}`)
}
export const getShowroomStockUnitSummary = () => fetchWithAuth('/showroom/stock-units/summary')
export const getShowroomStockUnitFilters = () => fetchWithAuth('/showroom/stock-units/filters')
export const getShowroomUnitKsu = (engineNumber) => fetchWithAuth(`/showroom/stock-units/${encodeURIComponent(engineNumber)}/ksu`)
export const updateShowroomUnitKsu = (engineNumber, data) => fetchWithAuth(`/showroom/stock-units/${encodeURIComponent(engineNumber)}/ksu`, { method: 'PATCH', body: data })
export const getShowroomKsuStandards = () => fetchWithAuth('/showroom/ksu-standards')
export const updateShowroomKsuStandard = (productType, data) => fetchWithAuth(`/showroom/ksu-standards/${encodeURIComponent(productType)}`, { method: 'PATCH', body: data })
export const cancelShowroomUnitBooking = (engineNumber) => fetchWithAuth(`/showroom/stock-units/${encodeURIComponent(engineNumber)}/booking/cancel`, { method: 'PATCH' })

// Upload imports
export const previewShowroomStockUnit = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/stock-units/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomStockUnit = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/stock-units/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

// STNK
export const getShowroomStnks = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/stnks${query ? '?' + query : ''}`)
}
export const getShowroomStnkSummary = () => fetchWithAuth('/showroom/stnks/summary')
export const getShowroomStnkFilters = () => fetchWithAuth('/showroom/stnks/filters')

// BPKB
export const getShowroomBpkbs = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/bpkbs${query ? '?' + query : ''}`)
}
export const getShowroomBpkbSummary = () => fetchWithAuth('/showroom/bpkbs/summary')
export const getShowroomBpkbFilters = () => fetchWithAuth('/showroom/bpkbs/filters')

// Document Followups
export const getShowroomDocumentFollowups = (type, params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/document-followups/${type}${query ? '?' + query : ''}`)
}
export const createShowroomDocumentFollowup = (type, engineNumber, data) => fetchWithAuth(`/showroom/document-followups/${type}/${encodeURIComponent(engineNumber)}`, { method: 'POST', body: data })
export const updateStnkBpkbTrackMobile = (engineNumber, mobile) => fetchWithAuth(`/showroom/stnk-bpkb-tracks/${encodeURIComponent(engineNumber)}/mobile`, { method: 'PATCH', body: { mobile } })

// OTR Prices
export const getShowroomOtrPrices = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/otr-prices${query ? '?' + query : ''}`)
}
export const getShowroomOtrPriceSummary = () => fetchWithAuth('/showroom/otr-prices/summary')
export const previewShowroomOtrPrice = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/otr-prices/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomOtrPrice = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/otr-prices/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const previewShowroomOffPurchasePrice = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/otr-prices/off-purchase/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomOffPurchasePrice = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/otr-prices/off-purchase/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

// BBN Prices
export const getShowroomBbnPrices = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/bbn-prices${query ? '?' + query : ''}`)
}
export const getShowroomBbnPriceSummary = () => fetchWithAuth('/showroom/bbn-prices/summary')
export const previewShowroomBbnPrice = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/bbn-prices/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomBbnPrice = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/bbn-prices/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const updateShowroomBbnAdjustment = (data) => fetchWithAuth('/showroom/bbn-prices/adjustment', { method: 'PATCH', body: data })
export const createShowroomBbnPrice = (data) => fetchWithAuth('/showroom/bbn-prices', { method: 'POST', body: data })
export const updateShowroomBbnPrice = (id, data) => fetchWithAuth(`/showroom/bbn-prices/${id}`, { method: 'PATCH', body: data })

// Programs
export const getShowroomProgramSummary = () => fetchWithAuth('/showroom/programs/summary')
export const getShowroomLeasingPrograms = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/programs/leasing${query ? '?' + query : ''}`)
}
export const getShowroomMdPrograms = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/programs/md${query ? '?' + query : ''}`)
}
export const previewShowroomPrograms = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/programs/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomPrograms = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/programs/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const getShowroomDiscountTable = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/programs/discount-table${query ? '?' + query : ''}`)
}

// TAC
export const getShowroomTacSummary = () => fetchWithAuth('/showroom/tac/summary')
export const getShowroomTacPrograms = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/tac/programs${query ? '?' + query : ''}`)
}
export const upsertShowroomTacMatrix = (data) => fetchWithAuth('/showroom/tac/programs', { method: 'POST', body: data })
export const getShowroomPromoSchemes = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/tac/promo-schemes${query ? '?' + query : ''}`)
}
export const upsertShowroomPromoScheme = (data) => fetchWithAuth('/showroom/tac/promo-schemes', { method: 'POST', body: data })
export const getShowroomSeriesAliases = () => fetchWithAuth('/showroom/tac/series-aliases')
export const upsertShowroomSeriesAlias = (data) => fetchWithAuth('/showroom/tac/series-aliases', { method: 'POST', body: data })

// Dealer Burdens
export const getShowroomDealerBurdens = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/dealer-burdens${query ? '?' + query : ''}`)
}
export const getShowroomDealerBurdenSummary = () => fetchWithAuth('/showroom/dealer-burdens/summary')
export const upsertShowroomDealerBurden = (data) => fetchWithAuth('/showroom/dealer-burdens', { method: 'POST', body: data })
export const previewShowroomDealerBurden = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/dealer-burdens/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomDealerBurden = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/dealer-burdens/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

// Salespeople
export const getShowroomSalespeople = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/salespeople${query ? '?' + query : ''}`)
}
export const getShowroomSalespersonSummary = () => fetchWithAuth('/showroom/salespeople/summary')
export const upsertShowroomSalesperson = (data) => fetchWithAuth('/showroom/salespeople', { method: 'POST', body: data })
export const deleteShowroomSalesperson = (id) => fetchWithAuth(`/showroom/salespeople/${id}`, { method: 'DELETE' })
export const updateShowroomSalespersonStatus = (id, is_active) =>
  fetchWithAuth(`/showroom/salespeople/${id}/status`, { method: 'PATCH', body: { is_active } })
export const previewShowroomSalespeople = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/salespeople/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomSalespeople = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/salespeople/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

// Team Leaders
export const getShowroomTeamLeaders = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/team-leaders${query ? '?' + query : ''}`)
}
export const getShowroomTeamLeaderSummary = () => fetchWithAuth('/showroom/team-leaders/summary')
export const upsertShowroomTeamLeader = (data) => fetchWithAuth('/showroom/team-leaders', { method: 'POST', body: data })
export const deleteShowroomTeamLeader = (id) => fetchWithAuth(`/showroom/team-leaders/${id}`, { method: 'DELETE' })
export const updateShowroomTeamLeaderStatus = (id, is_active) =>
  fetchWithAuth(`/showroom/team-leaders/${id}/status`, { method: 'PATCH', body: { is_active } })
export const previewShowroomTeamLeaders = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/team-leaders/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomTeamLeaders = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/team-leaders/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

// Opname
export const getShowroomOpnameSessions = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/opname${query ? '?' + query : ''}`)
}
export const createShowroomOpnameSession = (data) => fetchWithAuth('/showroom/opname', { method: 'POST', body: data })
export const getShowroomOpnameItems = (id) => fetchWithAuth(`/showroom/opname/${id}/items`)
export const getShowroomOpnameReport = (id) => fetchWithAuth(`/showroom/opname/${id}/report`)
export const confirmShowroomOpnameSession = (id, data) => fetchWithAuth(`/showroom/opname/${id}/confirm`, { method: 'PATCH', body: data })
export const scanShowroomOpnameItem = (id, data) => fetchWithAuth(`/showroom/opname/${id}/scan`, { method: 'POST', body: data })
export const updateShowroomOpnameItem = (id, itemId, data) => fetchWithAuth(`/showroom/opname/${id}/items/${itemId}`, { method: 'PATCH', body: data })
export const submitShowroomOpnameSession = (id) => fetchWithAuth(`/showroom/opname/${id}/submit`, { method: 'PATCH' })
export const adhDoneShowroomOpnameSession = (id) => fetchWithAuth(`/showroom/opname/${id}/adh-done`, { method: 'PATCH' })
export const sendShowroomOpnameToKacab = (id) => fetchWithAuth(`/showroom/opname/${id}/send-kacab`, { method: 'PATCH' })
export const approveKacabShowroomOpnameSession = (id) => fetchWithAuth(`/showroom/opname/${id}/approve-kacab`, { method: 'PATCH' })
export const rfaShowroomOpnameSession = (id, reason) => fetchWithAuth(`/showroom/opname/${id}/rfa`, { method: 'PATCH', body: { reason } })
export const approveShowroomOpnameSession = (id) => fetchWithAuth(`/showroom/opname/${id}/approve`, { method: 'PATCH' })
export const rejectShowroomOpnameSession = (id, reason) => fetchWithAuth(`/showroom/opname/${id}/reject`, { method: 'PATCH', body: { reason } })
export const markShowroomOpnameBasoPrinted = (id) => fetchWithAuth(`/showroom/opname/${id}/baso-print`, { method: 'PATCH' })
export const uploadShowroomOpnameBaso = (id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth(`/showroom/opname/${id}/baso-upload`, { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const verifyShowroomOpnameBaso = (id) => fetchWithAuth(`/showroom/opname/${id}/baso-verify`, { method: 'PATCH' })
export const completeShowroomOpnameSession = (id) => fetchWithAuth(`/showroom/opname/${id}/complete`, { method: 'PATCH' })
export const deleteShowroomOpnameSession = (id) => fetchWithAuth(`/showroom/opname/${id}`, { method: 'DELETE' })

// Assignment & notifications
export const getShowroomOpnameLocations = (id) => fetchWithAuth(`/showroom/opname/${id}/locations`)
export const assignShowroomOpnameLocations = (id, assignments) => fetchWithAuth(`/showroom/opname/${id}/assignments`, { method: 'POST', body: { assignments } })
export const getShowroomOpnameNotifications = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/opname/notifications${query ? '?' + query : ''}`)
}
export const markShowroomOpnameNotificationRead = (id) => fetchWithAuth(`/showroom/opname/notifications/${id}/read`, { method: 'PATCH' })

// STNK & BPKB Track Monitoring
export const getShowroomStnkBpkbTrackMonitoring = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/stnk-bpkb-tracks/monitoring${query ? '?' + query : ''}`)
}
export const exportShowroomStnkBpkbTrack = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/stnk-bpkb-tracks/export${query ? '?' + query : ''}`, { responseType: 'blob' })
}
export const previewShowroomStnkBpkbTrack = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/stnk-bpkb-tracks/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomStnkBpkbTrack = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return fetchWithAuth('/showroom/stnk-bpkb-tracks/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
// Import gabungan: 2 file (v1 58-kolom + v2 62-kolom), digabung per engine_number di server
export const previewShowroomStnkBpkbTrackCombined = (file1, file2) => {
  const formData = new FormData()
  formData.append('file1', file1)
  formData.append('file2', file2)
  return fetchWithAuth('/showroom/stnk-bpkb-tracks/combined/preview', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}
export const uploadShowroomStnkBpkbTrackCombined = (file1, file2) => {
  const formData = new FormData()
  formData.append('file1', file1)
  formData.append('file2', file2)
  return fetchWithAuth('/showroom/stnk-bpkb-tracks/combined/import', { method: 'POST', body: formData, headers: {}, timeout: 300000 })
}

// Marketing Targets (per Team Leader, bulanan)
export const getShowroomMarketingTargets = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/marketing-targets${query ? '?' + query : ''}`)
}
export const getShowroomMarketingTargetSummary = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/marketing-targets/summary${query ? '?' + query : ''}`)
}
export const upsertShowroomMarketingTarget = (data) => fetchWithAuth('/showroom/marketing-targets', { method: 'POST', body: data })
export const deleteShowroomMarketingTarget = (id) => fetchWithAuth(`/showroom/marketing-targets/${id}`, { method: 'DELETE' })

// Document Handover (Serah Terima Dokumen)
export const getDocumentHandovers = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/document-handovers${query ? '?' + query : ''}`)
}
export const getDocumentHandoverSummary = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/document-handovers/summary${query ? '?' + query : ''}`)
}
export const getHandoverSalespeople = () => fetchWithAuth('/showroom/document-handovers/salespeople')
export const getCourierUsers = () => fetchWithAuth('/showroom/document-handovers/couriers')
export const getAvailableDocuments = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/document-handovers/available${query ? '?' + query : ''}`)
}
export const createDocumentHandover = (data) => fetchWithAuth('/showroom/document-handovers', { method: 'POST', body: data })
export const getHandoverSteps = (id) => fetchWithAuth(`/showroom/document-handovers/${id}/steps`)
export const addHandoverStep = (id, formData) => fetchWithAuth(`/showroom/document-handovers/${id}/steps`, { method: 'POST', body: formData, headers: {} })
export const updateDocumentHandover = (id, data) => fetchWithAuth(`/showroom/document-handovers/${id}`, { method: 'PUT', body: data })
export const deleteDocumentHandover = (id) => fetchWithAuth(`/showroom/document-handovers/${id}`, { method: 'DELETE' })

// FASE 2 Self-Check: manajemen permintaan ambil dokumen (pickup requests)
export const getPickupRequests = (params = {}) => {
  const query = new URLSearchParams(params).toString()
  return fetchWithAuth(`/showroom/pickup-requests${query ? '?' + query : ''}`)
}
export const updatePickupRequest = (id, data) => fetchWithAuth(`/showroom/pickup-requests/${id}`, { method: 'PATCH', body: data })
export const processShipmentFromPickupRequest = (id, data) => fetchWithAuth(`/showroom/pickup-requests/${id}/process-shipment`, { method: 'POST', body: data })
