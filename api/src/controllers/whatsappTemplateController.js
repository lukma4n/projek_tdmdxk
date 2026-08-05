import {
  getAllTemplates, saveTemplate, resetTemplate, getTemplateHistory, previewTemplate,
  getTemplateContent, TemplateError,
} from '../services/templateService.js'
import { createAuditLog } from '../services/auditService.js'

function tangani(error, res, next) {
  if (error instanceof TemplateError) return res.status(error.status).json({ error: error.message })
  return next(error)
}

export async function listWhatsappTemplates(req, res, next) {
  try {
    res.json({ data: await getAllTemplates() })
  } catch (error) {
    tangani(error, res, next)
  }
}

export async function updateWhatsappTemplate(req, res, next) {
  try {
    const key = String(req.params.key || '').toUpperCase()
    const sebelum = await getTemplateContent(key)
    const data = await saveTemplate(key, req.body.content, req.user.userId)

    // Isi pesan mewakili nama dealer ke ribuan konsumen dan siapa pun dengan
    // akses follow-up boleh mengubahnya, jadi perubahannya masuk audit log
    // lengkap dengan isi sebelum dan sesudah.
    await createAuditLog({
      userId: req.user.userId,
      tableName: 'whatsapp_templates',
      recordId: data.id,
      fieldName: `content:${key}`,
      oldValue: sebelum,
      newValue: data.content,
    }).catch(() => {})

    res.json({ message: `Template ${key} disimpan`, data })
  } catch (error) {
    tangani(error, res, next)
  }
}

export async function resetWhatsappTemplate(req, res, next) {
  try {
    const key = String(req.params.key || '').toUpperCase()
    const sebelum = await getTemplateContent(key)
    const content = await resetTemplate(key)
    await createAuditLog({
      userId: req.user.userId,
      tableName: 'whatsapp_templates',
      recordId: key,
      fieldName: `reset:${key}`,
      oldValue: sebelum,
      newValue: content,
    }).catch(() => {})
    res.json({ message: `Template ${key} dikembalikan ke bawaan`, content })
  } catch (error) {
    tangani(error, res, next)
  }
}

export async function getWhatsappTemplateHistory(req, res, next) {
  try {
    const key = String(req.params.key || '').toUpperCase()
    res.json({ data: await getTemplateHistory(key) })
  } catch (error) {
    tangani(error, res, next)
  }
}

/** Pratinjau + validasi tanpa menyimpan, dipakai editor saat mengetik. */
export async function previewWhatsappTemplate(req, res, next) {
  try {
    const key = String(req.params.key || '').toUpperCase()
    res.json(previewTemplate(key, req.body.content))
  } catch (error) {
    tangani(error, res, next)
  }
}
