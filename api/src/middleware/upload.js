import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDir = 'uploads/'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'text/csv',
    'text/html',
    'application/pdf',
    'application/octet-stream',
  ]
  
  const allowedExts = ['.xlsx', '.xls', '.csv', '.docx', '.html', '.htm', '.pdf']
  const ext = path.extname(file.originalname || '').toLowerCase()
  
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Hanya file Excel (.xlsx, .xls), CSV, Word (.docx), HTML (.html), atau PDF (.pdf) yang diizinkan'), false)
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
})

const pdfFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (file.mimetype === 'application/pdf' && ext === '.pdf') {
    cb(null, true)
  } else {
    cb(new Error('Hanya file PDF yang diizinkan'), false)
  }
}

const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg']
  const allowedExts = ['.jpg', '.jpeg', '.png']
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Hanya file gambar JPEG atau PNG yang diizinkan'), false)
  }
}

export const uploadPdf = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

export const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
})

// Handover photo upload - dedicated folder
const handoverDir = 'uploads/handovers/'

const handoverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(handoverDir, { recursive: true }, (err) => cb(err, handoverDir))
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const uniqueSuffix = Math.round(Math.random() * 1E6)
    cb(null, `handover-${timestamp}-${uniqueSuffix}${path.extname(file.originalname)}`)
  },
})

export const uploadHandoverPhoto = multer({
  storage: handoverStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

// Pickup request KTP photo - dedicated folder. Diunggah konsumen (publik) saat
// mengajukan ambil dokumen dari /cek. Disajikan ke staf via route auth.
const pickupKtpDir = 'uploads/pickup-ktp/'

const pickupKtpStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(pickupKtpDir, { recursive: true }, (err) => cb(err, pickupKtpDir))
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const uniqueSuffix = Math.round(Math.random() * 1E6)
    cb(null, `ktp-${timestamp}-${uniqueSuffix}${path.extname(file.originalname)}`)
  },
})

export const uploadPickupKtp = multer({
  storage: pickupKtpStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

