/**
 * Bulk upsert untuk import massal.
 *
 * Pola lama menjalankan satu `update` per baris: 78 ribu baris work order
 * memakan ~110 detik, nyaris menyentuh timeout transaksi 120 detik dan pasti
 * terlampaui di disk VPS yang lebih lambat. Satu statement `INSERT ... ON
 * CONFLICT` per batch menyelesaikan beban yang sama dalam ~3 detik.
 *
 * `ON CONFLICT DO UPDATE` mempertahankan baris (dan `id`) yang sudah ada, jadi
 * relasi turunan seperti riwayat follow-up KPB milik konsumen tetap utuh.
 */

const BATCH_SIZE = 150
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/

function assertSafeIdentifiers(identifiers) {
  const unsafe = identifiers.filter((identifier) => !SAFE_IDENTIFIER.test(identifier))
  if (unsafe.length > 0) {
    throw new Error(`Identifier SQL tidak valid: ${unsafe.join(', ')}`)
  }
}

/**
 * @param tx        Prisma transaction client
 * @param table     Nama tabel target
 * @param conflictColumn Kolom unik penentu update vs insert
 * @param records   Baris hasil parser; semua objek harus punya kunci yang sama
 */
export async function bulkUpsert(tx, table, conflictColumn, records) {
  if (records.length === 0) return

  const columns = Object.keys(records[0])
  // Nama tabel/kolom berasal dari object literal parser, bukan input user.
  // Divalidasi tetap karena disisipkan langsung ke SQL (nilainya parameterized).
  assertSafeIdentifiers([table, conflictColumn, ...columns])

  const columnList = columns.map((column) => `"${column}"`).join(', ')
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`
  const updateAssignments = columns
    .filter((column) => column !== conflictColumn)
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
      `INSERT INTO "${table}" (${columnList}) VALUES ${values} ` +
      `ON CONFLICT("${conflictColumn}") DO UPDATE SET ${updateAssignments}`,
      ...params,
    )
  }
}
