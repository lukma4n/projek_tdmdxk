import { Router } from 'express'
import { authenticate, authorize, authorizeMenu } from '../middleware/auth.js'
import { upload, uploadPdf } from '../middleware/upload.js'
import {
  getShowroomDashboard,
} from '../controllers/showroomDashboardController.js'
import {
  getShowroomSalesDashboard, exportShowroomSalesDashboard,
} from '../controllers/showroomSalesDashboardController.js'
import {
  getServiceBookLabels,
  updateLabelPrintStatus,
} from '../controllers/showroomLabelServiceController.js'
import {
  getStckSalesLookup,
} from '../controllers/showroomStckController.js'
import {
  cancelUnitBookingAdmin,
} from '../controllers/unitBookingController.js'
import {
  getStockUnits,
  exportStockUnitsExcel,
  getStockUnitSummary,
  getStockUnitFilters,
  getUnitKsu,
  updateUnitKsu,
  getKsuStandards,
  updateKsuStandard,
  previewStockUnit,
  uploadStockUnit,
} from '../controllers/showroomStockUnitController.js'
import { validate, schemas } from '../middleware/validate.js'
import {
  createSalesOrderMargin, getSalesOrderMargins, getSalesOrderMarginById, previewSalesOrderMargin, updateSalesOrderMargin,
} from '../controllers/salesOrderMarginController.js'
import {
  createBbnPrice, getBbnPrices, getBbnPriceSummary, previewBbnPrices, updateBbnPrice, updateBbnPriceAdjustment, uploadBbnPrices,
} from '../controllers/showroomBbnController.js'
import {
  getLeasingPrograms, getMdPrograms, getProgramSummary, previewPrograms, uploadPrograms, getDiscountTable,
} from '../controllers/showroomProgramController.js'
import {
  getPromoSchemes, getSeriesAliases, getTacPrograms, getTacSummary, upsertPromoScheme, upsertSeriesAlias, upsertTacMatrix,
} from '../controllers/showroomTacController.js'
import {
  getDealerBurdens, getDealerBurdenSummary, upsertDealerBurden, previewDealerBurdenImport, uploadDealerBurdenImport,
} from '../controllers/showroomBurdenController.js'
import {
  listMarketingTargets, getMarketingTargetSummary, upsertMarketingTarget, deleteMarketingTarget,
} from '../controllers/showroomMarketingTargetController.js'
import {
  getSalespeople, upsertSalesperson, getSalespersonSummary, previewSalespeopleImport, uploadSalespeopleImport, deleteSalesperson,
  updateSalespersonStatus,
} from '../controllers/showroomSalespeopleController.js'
import {
  getTeamLeaders, upsertTeamLeader, getTeamLeaderSummary, previewTeamLeadersImport, uploadTeamLeadersImport, deleteTeamLeader,
  updateTeamLeaderStatus,
} from '../controllers/showroomTeamLeaderController.js'
import {
  getStnkBpkbTrackMonitoring, previewStnkBpkbTrack, uploadStnkBpkbTrack, exportStnkBpkbTrackExcel,
  previewStnkBpkbTrackCombined, uploadStnkBpkbTrackCombined,
  updateStnkBpkbTrackMobile, getPickupRequests, updatePickupRequest, getPickupRequestKtp,
} from '../controllers/showroomStnkBpkbTrackController.js'
import {
  getStnks, exportStnksExcel, getStnkSummary, getStnkFilters,
} from '../controllers/showroomStnkController.js'
import {
  getBpkbs, exportBpkbsExcel, getBpkbSummary, getBpkbFilters,
} from '../controllers/showroomBpkbController.js'
import {
  getOtrPrices, getOtrPriceSummary, previewOtrPrices, uploadOtrPrices, previewOffPurchasePrices, uploadOffPurchasePrices,
} from '../controllers/showroomPriceController.js'
import {
  getDocumentFollowups, createDocumentFollowup, exportDocumentFollowupsExcel,
} from '../controllers/showroomFollowupController.js'
import {
  getShowroomOpnameSessions, createShowroomOpnameSession, getShowroomOpnameItems, getShowroomOpnameReport,
  exportShowroomOpnameReport, confirmShowroomOpnameSession, scanShowroomOpnameItem, scanWithPhoto, getOpnamePhoto, updateShowroomOpnameItem,
  submitShowroomOpnameSession, adhDoneShowroomOpnameSession, sendToKacabShowroomOpnameSession,
  rfaShowroomOpnameSession, approveShowroomOpnameSession, approveKacabShowroomOpnameSession,
  rejectShowroomOpnameSession, markBasoPrinted, uploadBasoSigned, viewBasoSigned,
  verifyBasoSigned, completeShowroomOpnameSession, deleteShowroomOpnameSession,
  searchShowroomStockUnits, getSessionLocations, assignSessionLocations, searchAndValidateUnit,
  getNotifications, markNotificationRead,
} from '../controllers/showroomOpnameController.js'

import { uploadImage } from '../middleware/upload.js'

import {
  getDocumentHandovers, getDocumentHandoverSummary, getHandoverSalespeople,
  getAvailableDocuments, createDocumentHandover, updateDocumentHandover, deleteDocumentHandover, addHandoverStep, getHandoverSteps, getHandoverPhoto,
} from '../controllers/documentHandoverController.js'
import { uploadHandoverPhoto } from '../middleware/upload.js'

const router = Router()
const showroomAccess = authorize('Admin', 'Kepala Cabang')
const showroomSalesOrderAccess = authorize('Admin', 'Kepala Cabang')
const documentStockAccess = authorize('Admin')
const documentFollowupAccess = authorize('CRM')
const showroomOpnameReadAccess = authorize('PIC Stock opname', 'ADH', 'Kepala Cabang')
const showroomOpnameWriteAccess = authorize('PIC Stock opname')
const showroomOpnameAdminAccess = authorize('PIC Stock opname', 'ADH', 'Kepala Cabang')
const showroomOpnameAdhAccess = authorize('ADH')
const showroomOpnameKacabAccess = authorize('Kepala Cabang')
const showroomStockUnitFilterAccess = authorize('Admin', 'Kepala Cabang')

router.get('/dashboard', authenticate, showroomAccess, getShowroomDashboard)

router.get('/penjualan/dashboard', authenticate, showroomAccess, getShowroomSalesDashboard)
router.get('/penjualan/export', authenticate, showroomAccess, exportShowroomSalesDashboard)

router.get('/label-buku-service', authenticate, showroomAccess, getServiceBookLabels)
router.patch('/label-buku-service/print-status', authenticate, showroomAccess, updateLabelPrintStatus)

router.get('/stck/sales-lookup', authenticate, showroomAccess, getStckSalesLookup)

router.get('/sales-order-margins', authenticate, showroomSalesOrderAccess, getSalesOrderMargins)
router.post('/sales-order-margins/preview', authenticate, showroomSalesOrderAccess, previewSalesOrderMargin)
router.post('/sales-order-margins', authenticate, showroomSalesOrderAccess, createSalesOrderMargin)
router.get('/sales-order-margins/:id', authenticate, showroomSalesOrderAccess, getSalesOrderMarginById)
router.patch('/sales-order-margins/:id', authenticate, showroomSalesOrderAccess, updateSalesOrderMargin)

router.get('/stock-units', authenticate, showroomAccess, getStockUnits)
router.get('/stock-units/export', authenticate, showroomAccess, exportStockUnitsExcel)
router.get('/stock-units/summary', authenticate, showroomAccess, getStockUnitSummary)
router.get('/stock-units/filters', authenticate, showroomStockUnitFilterAccess, getStockUnitFilters)
router.get('/stock-units/:engineNumber/ksu', authenticate, showroomAccess, getUnitKsu)
router.patch('/stock-units/:engineNumber/ksu', authenticate, showroomAccess, updateUnitKsu)
router.patch('/stock-units/:engineNumber/booking/cancel', authenticate, showroomAccess, cancelUnitBookingAdmin)
router.post('/stock-units/preview', authenticate, authorizeMenu('IMPORT_SHOWROOM_STOCK_UNIT'), upload.single('file'), previewStockUnit)
router.post('/stock-units/import', authenticate, authorizeMenu('IMPORT_SHOWROOM_STOCK_UNIT'), upload.single('file'), uploadStockUnit)

router.get('/stnks', authenticate, documentStockAccess, getStnks)
router.get('/stnks/export', authenticate, documentStockAccess, exportStnksExcel)
router.get('/stnks/summary', authenticate, documentStockAccess, getStnkSummary)
router.get('/stnks/filters', authenticate, documentStockAccess, getStnkFilters)

router.get('/bpkbs', authenticate, documentStockAccess, getBpkbs)
router.get('/bpkbs/export', authenticate, documentStockAccess, exportBpkbsExcel)
router.get('/bpkbs/summary', authenticate, documentStockAccess, getBpkbSummary)
router.get('/bpkbs/filters', authenticate, documentStockAccess, getBpkbFilters)

router.get('/otr-prices', authenticate, showroomAccess, getOtrPrices)
router.get('/otr-prices/summary', authenticate, showroomAccess, getOtrPriceSummary)
router.post('/otr-prices/preview', authenticate, authorizeMenu('IMPORT_SHOWROOM_OTR_PRICE'), upload.single('file'), previewOtrPrices)
router.post('/otr-prices/import', authenticate, authorizeMenu('IMPORT_SHOWROOM_OTR_PRICE'), upload.single('file'), uploadOtrPrices)
router.post('/otr-prices/off-purchase/preview', authenticate, authorizeMenu('IMPORT_SHOWROOM_OFF_PURCHASE_PRICE'), upload.single('file'), previewOffPurchasePrices)
router.post('/otr-prices/off-purchase/import', authenticate, authorizeMenu('IMPORT_SHOWROOM_OFF_PURCHASE_PRICE'), upload.single('file'), uploadOffPurchasePrices)

router.get('/bbn-prices', authenticate, showroomAccess, getBbnPrices)
router.get('/bbn-prices/summary', authenticate, showroomAccess, getBbnPriceSummary)
router.post('/bbn-prices', authenticate, showroomAccess, createBbnPrice)
router.post('/bbn-prices/preview', authenticate, authorizeMenu('IMPORT_SHOWROOM_BBN'), upload.single('file'), previewBbnPrices)
router.post('/bbn-prices/import', authenticate, authorizeMenu('IMPORT_SHOWROOM_BBN'), upload.single('file'), uploadBbnPrices)
router.patch('/bbn-prices/adjustment', authenticate, showroomAccess, updateBbnPriceAdjustment)
router.patch('/bbn-prices/:id', authenticate, showroomAccess, updateBbnPrice)

router.get('/programs/summary', authenticate, showroomAccess, getProgramSummary)
router.get('/programs/leasing', authenticate, showroomAccess, getLeasingPrograms)
router.get('/programs/md', authenticate, showroomAccess, getMdPrograms)
router.get('/programs/discount-table', authenticate, showroomAccess, getDiscountTable)
router.post('/programs/preview', authenticate, authorizeMenu('IMPORT_SHOWROOM_PROGRAM'), upload.single('file'), previewPrograms)
router.post('/programs/import', authenticate, authorizeMenu('IMPORT_SHOWROOM_PROGRAM'), upload.single('file'), uploadPrograms)

router.get('/tac/summary', authenticate, showroomAccess, getTacSummary)
router.get('/tac/programs', authenticate, showroomAccess, getTacPrograms)
router.post('/tac/programs', authenticate, showroomAccess, upsertTacMatrix)
router.get('/tac/promo-schemes', authenticate, showroomAccess, getPromoSchemes)
router.post('/tac/promo-schemes', authenticate, showroomAccess, upsertPromoScheme)
router.get('/tac/series-aliases', authenticate, showroomAccess, getSeriesAliases)
router.post('/tac/series-aliases', authenticate, showroomAccess, upsertSeriesAlias)

router.get('/ksu-standards', authenticate, showroomAccess, getKsuStandards)
router.patch('/ksu-standards/:productType', authenticate, showroomAccess, updateKsuStandard)

router.get('/opname', authenticate, showroomOpnameReadAccess, getShowroomOpnameSessions)
router.post('/opname', authenticate, showroomOpnameWriteAccess, validate(schemas.createOpnameSession), createShowroomOpnameSession)
router.get('/opname/search-unit', authenticate, showroomOpnameWriteAccess, searchAndValidateUnit)
router.get('/opname/notifications', authenticate, showroomOpnameReadAccess, getNotifications)
router.patch('/opname/notifications/:id/read', authenticate, showroomOpnameReadAccess, markNotificationRead)
router.get('/opname/:id/items', authenticate, showroomOpnameReadAccess, getShowroomOpnameItems)
router.get('/opname/:id/report', authenticate, showroomOpnameReadAccess, getShowroomOpnameReport)
router.get('/opname/:id/export', authenticate, showroomOpnameReadAccess, exportShowroomOpnameReport)
router.patch('/opname/:id/confirm', authenticate, showroomOpnameWriteAccess, confirmShowroomOpnameSession)
router.post('/opname/:id/scan', authenticate, showroomOpnameWriteAccess, scanShowroomOpnameItem)
router.post('/opname/:id/scan-with-photo', authenticate, showroomOpnameWriteAccess, uploadImage.single('photo'), scanWithPhoto)
router.patch('/opname/:id/items/:itemId', authenticate, showroomOpnameWriteAccess, updateShowroomOpnameItem)
router.patch('/opname/:id/submit', authenticate, showroomOpnameWriteAccess, submitShowroomOpnameSession)
router.patch('/opname/:id/adh-done', authenticate, showroomOpnameAdhAccess, adhDoneShowroomOpnameSession)
router.patch('/opname/:id/send-kacab', authenticate, showroomOpnameAdhAccess, sendToKacabShowroomOpnameSession)
router.patch('/opname/:id/rfa', authenticate, authorize('ADH', 'Kepala Cabang'), rfaShowroomOpnameSession)
router.patch('/opname/:id/approve', authenticate, showroomOpnameKacabAccess, approveShowroomOpnameSession)
router.patch('/opname/:id/approve-kacab', authenticate, showroomOpnameKacabAccess, approveKacabShowroomOpnameSession)
router.patch('/opname/:id/reject', authenticate, authorize('ADH', 'Kepala Cabang'), rejectShowroomOpnameSession)
router.patch('/opname/:id/baso-print', authenticate, showroomOpnameReadAccess, markBasoPrinted)
router.post('/opname/:id/baso-upload', authenticate, showroomOpnameWriteAccess, uploadPdf.single('file'), uploadBasoSigned)
router.get('/opname/:id/baso-file', authenticate, showroomOpnameReadAccess, viewBasoSigned)
router.patch('/opname/:id/baso-verify', authenticate, showroomOpnameWriteAccess, verifyBasoSigned)
router.patch('/opname/:id/complete', authenticate, showroomOpnameWriteAccess, completeShowroomOpnameSession)
router.delete('/opname/:id', authenticate, showroomOpnameWriteAccess, deleteShowroomOpnameSession)

// Mobile search suggestions
router.get('/stock-units/search', authenticate, showroomStockUnitFilterAccess, searchShowroomStockUnits)

// Session assignment & validation
router.get('/opname/:id/locations', authenticate, showroomOpnameReadAccess, getSessionLocations)
router.post('/opname/:id/assignments', authenticate, showroomOpnameWriteAccess, assignSessionLocations)

router.get('/document-followups/:type', authenticate, documentFollowupAccess, getDocumentFollowups)
router.get('/document-followups/:type/export', authenticate, documentFollowupAccess, exportDocumentFollowupsExcel)
router.post('/document-followups/:type/:engineNumber', authenticate, documentFollowupAccess, createDocumentFollowup)

// Dealer Burdens
router.get('/dealer-burdens', authenticate, showroomAccess, getDealerBurdens)
router.get('/dealer-burdens/summary', authenticate, showroomAccess, getDealerBurdenSummary)
router.post('/dealer-burdens', authenticate, showroomAccess, upsertDealerBurden)
router.post('/dealer-burdens/preview', authenticate, showroomAccess, upload.single('file'), previewDealerBurdenImport)
router.post('/dealer-burdens/import', authenticate, showroomAccess, upload.single('file'), uploadDealerBurdenImport)

// Salespeople
router.get('/salespeople', authenticate, showroomAccess, getSalespeople)
router.get('/salespeople/summary', authenticate, showroomAccess, getSalespersonSummary)
router.post('/salespeople', authenticate, showroomAccess, upsertSalesperson)
router.post('/salespeople/preview', authenticate, showroomAccess, upload.single('file'), previewSalespeopleImport)
router.post('/salespeople/import', authenticate, showroomAccess, upload.single('file'), uploadSalespeopleImport)
router.delete('/salespeople/:id', authenticate, showroomAccess, deleteSalesperson)
router.patch('/salespeople/:id/status', authenticate, showroomAccess, updateSalespersonStatus)

// Team Leaders
router.get('/team-leaders', authenticate, showroomAccess, getTeamLeaders)
router.get('/team-leaders/summary', authenticate, showroomAccess, getTeamLeaderSummary)
router.post('/team-leaders', authenticate, showroomAccess, upsertTeamLeader)
router.post('/team-leaders/preview', authenticate, showroomAccess, upload.single('file'), previewTeamLeadersImport)
router.post('/team-leaders/import', authenticate, showroomAccess, upload.single('file'), uploadTeamLeadersImport)
router.delete('/team-leaders/:id', authenticate, showroomAccess, deleteTeamLeader)
router.patch('/team-leaders/:id/status', authenticate, showroomAccess, updateTeamLeaderStatus)

// STNK & BPKB Track Monitoring
const stnkBpkbTrackAdminAccess = authorize('Admin')
const stnkBpkbTrackReadAccess = authorize('Admin', 'CRM', 'Kepala Cabang')
router.get('/stnk-bpkb-tracks/monitoring', authenticate, stnkBpkbTrackReadAccess, getStnkBpkbTrackMonitoring)
router.get('/stnk-bpkb-tracks/export', authenticate, stnkBpkbTrackReadAccess, exportStnkBpkbTrackExcel)
router.patch('/stnk-bpkb-tracks/:engineNumber/mobile', authenticate, stnkBpkbTrackReadAccess, updateStnkBpkbTrackMobile)
router.post('/stnk-bpkb-tracks/preview', authenticate, authorizeMenu('IMPORT_SHOWROOM_STNK_BPKB_TRACK'), upload.single('file'), previewStnkBpkbTrack)
router.post('/stnk-bpkb-tracks/import', authenticate, authorizeMenu('IMPORT_SHOWROOM_STNK_BPKB_TRACK'), upload.single('file'), uploadStnkBpkbTrack)
// Import gabungan: 2 file (v1 58-kolom + v2 62-kolom) digabung per engine_number
const stnkBpkbCombinedUpload = upload.fields([{ name: 'file1', maxCount: 1 }, { name: 'file2', maxCount: 1 }])
router.post('/stnk-bpkb-tracks/combined/preview', authenticate, authorizeMenu('IMPORT_SHOWROOM_STNK_BPKB_TRACK'), stnkBpkbCombinedUpload, previewStnkBpkbTrackCombined)
router.post('/stnk-bpkb-tracks/combined/import', authenticate, authorizeMenu('IMPORT_SHOWROOM_STNK_BPKB_TRACK'), stnkBpkbCombinedUpload, uploadStnkBpkbTrackCombined)

// FASE 2 Self-Check: manajemen permintaan ambil dokumen (pickup requests)
router.get('/pickup-requests', authenticate, stnkBpkbTrackReadAccess, getPickupRequests)
router.patch('/pickup-requests/:id', authenticate, stnkBpkbTrackReadAccess, updatePickupRequest)
router.get('/pickup-requests/:id/ktp', authenticate, stnkBpkbTrackReadAccess, getPickupRequestKtp)

// Marketing Target (per Team Leader, bulanan)
const marketingTargetReadAccess = authorize('Admin', 'Kepala Cabang')
const marketingTargetWriteAccess = authorize('Kepala Cabang')
router.get('/marketing-targets', authenticate, marketingTargetReadAccess, listMarketingTargets)
router.get('/marketing-targets/summary', authenticate, marketingTargetReadAccess, getMarketingTargetSummary)
router.post('/marketing-targets', authenticate, marketingTargetWriteAccess, upsertMarketingTarget)
router.patch('/marketing-targets/:id', authenticate, marketingTargetWriteAccess, upsertMarketingTarget)
router.delete('/marketing-targets/:id', authenticate, marketingTargetWriteAccess, deleteMarketingTarget)

// Document Handover (Serah Terima Dokumen)
// Read  : semua role yang punya akses halaman (termasuk Kepala untuk monitoring)
// Write : Admin Showroom + Salesman (operator aktif)
// Delete: Admin Showroom + Kepala Cabang (kontrol ketat, tidak bisa dihapus sembarangan)
const handoverReadAccess  = authorize('Admin', 'CRM', 'Service Advisor', 'Kepala Cabang', 'Kepala Bengkel', 'Salesman')
const handoverWriteAccess = authorize('Admin', 'Salesman')
const handoverDeleteAccess = authorize('Admin', 'Kepala Cabang')
router.get('/document-handovers', authenticate, handoverReadAccess, getDocumentHandovers)
router.get('/document-handovers/summary', authenticate, handoverReadAccess, getDocumentHandoverSummary)
router.get('/document-handovers/salespeople', authenticate, handoverWriteAccess, getHandoverSalespeople)
router.get('/document-handovers/available', authenticate, handoverWriteAccess, getAvailableDocuments)
router.post('/document-handovers', authenticate, handoverWriteAccess, createDocumentHandover)
router.get('/document-handovers/:id/steps', authenticate, handoverReadAccess, getHandoverSteps)
router.put('/document-handovers/:id', authenticate, handoverWriteAccess, updateDocumentHandover)
router.delete('/document-handovers/:id', authenticate, handoverDeleteAccess, deleteDocumentHandover)
router.post('/document-handovers/:id/steps', authenticate, handoverWriteAccess, uploadHandoverPhoto.fields([
  { name: 'photo_doc', maxCount: 1 },
  { name: 'photo_handover', maxCount: 1 }
]), addHandoverStep)
router.get('/document-handovers/photo/:stepId', authenticate, handoverReadAccess, getHandoverPhoto)

export default router
