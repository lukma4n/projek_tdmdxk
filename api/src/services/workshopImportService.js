/**
 * Bulk upsert work order untuk import workshop.
 *
 * Versi lama menjalankan satu `update` per baris: 78 ribu baris memakan ~110
 * detik, nyaris menyentuh timeout transaksi 120 detik dan pasti terlampaui di
 * disk VPS yang lebih lambat. Satu statement `INSERT ... ON CONFLICT` per batch
 * menyelesaikan beban yang sama dalam ~3 detik.
 */

const BATCH_SIZE = 150
const SAFE_COLUMN = /^[a-z_][a-z0-9_]*$/

export async function bulkUpsertWorkOrders(tx, records) {
  if (records.length === 0) return

  const columns = Object.keys(records[0])
  // Nama kolom berasal dari object literal parser, bukan input user. Divalidasi
  // tetap karena nama ini disisipkan langsung ke SQL (nilai tetap parameterized).
  const unsafe = columns.filter((column) => !SAFE_COLUMN.test(column))
  if (unsafe.length > 0) {
    throw new Error(`Nama kolom work order tidak valid: ${unsafe.join(', ')}`)
  }

  const columnList = columns.map((column) => `"${column}"`).join(', ')
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`
  const updateAssignments = columns
    .filter((column) => column !== 'wo_number')
    .map((column) => `"${column}" = excluded."${column}"`)
    .join(', ')

  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = records.slice(offset, offset + BATCH_SIZE)
    const values = batch.map(() => rowPlaceholder).join(', ')
    const params = []
    for (const record of batch) {
      for (const column of columns) params.push(record[column] ?? null)
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO "work_orders" (${columnList}) VALUES ${values} ` +
      `ON CONFLICT("wo_number") DO UPDATE SET ${updateAssignments}`,
      ...params,
    )
  }
}
