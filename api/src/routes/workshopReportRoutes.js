import express from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import * as workshopReportController from '../controllers/workshopReportController.js'
import * as workshopReportDashboardController from '../controllers/workshopReportDashboardController.js'

const router = express.Router()

// Rute untuk target bengkel (marketing/operasional)
router.get('/targets', authenticate, authorize('Kepala Bengkel', 'Service Advisor', 'Kepala Cabang', 'Admin'), workshopReportController.getTargets)
router.post('/targets', authenticate, authorize('Kepala Bengkel', 'Kepala Cabang'), workshopReportController.createTarget)
router.put('/targets/:id', authenticate, authorize('Kepala Bengkel', 'Kepala Cabang'), workshopReportController.updateTarget)
router.delete('/targets/:id', authenticate, authorize('Kepala Bengkel', 'Kepala Cabang'), workshopReportController.deleteTarget)

// Rute untuk analitik lama
router.get('/analysis', authenticate, authorize('Kepala Bengkel', 'Service Advisor', 'Kepala Cabang', 'Admin'), workshopReportController.getSalesAnalysis)
router.get('/closing-daily', authenticate, authorize('Kepala Bengkel', 'Service Advisor', 'Kepala Cabang', 'Admin'), workshopReportController.getClosingDaily)

// Rute Dashboard Laporan
router.get('/dashboard/mechanic', authenticate, authorize('Kepala Bengkel', 'Service Advisor', 'Kepala Cabang', 'Admin'), workshopReportDashboardController.getDashboardMechanic)
router.get('/dashboard/kpb', authenticate, authorize('Kepala Bengkel', 'Service Advisor', 'Kepala Cabang', 'Admin'), workshopReportDashboardController.getDashboardKPB)
router.get('/dashboard/branch', authenticate, authorize('Kepala Bengkel', 'Service Advisor', 'Kepala Cabang', 'Admin'), workshopReportDashboardController.getDashboardBranch)

export default router
