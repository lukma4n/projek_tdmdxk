import { prisma } from '../config/db.js'

export const getPermissions = async (req, res) => {
  try {
    const permissions = await prisma.role_permissions.findMany()
    // Group by menu_key
    const grouped = permissions.reduce((acc, curr) => {
      if (!acc[curr.menu_key]) acc[curr.menu_key] = []
      acc[curr.menu_key].push(curr.role_name)
      return acc
    }, {})
    res.json(grouped)
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil hak akses' })
  }
}

export const updatePermissions = async (req, res) => {
  const { menu_key, roles } = req.body
  if (!menu_key || !Array.isArray(roles)) {
    return res.status(400).json({ error: 'Data tidak valid' })
  }

  try {
    // Pakai batch transaction (bentuk array), BUKAN interactive transaction
    // (async callback). Di SQLite, interactive transaction membuka sesi yang
    // dibatasi timeout 5 dtk; bila DB sedang di-lock penulis lain (mis. audit
    // log IT Master yang menembak bersamaan), penantian lock ≈ busy_timeout 5 dtk
    // sehingga transaksi keburu abort ("Transaction already closed"). Bentuk
    // array tetap atomik namun tidak terkena batas waktu sesi interaktif itu.
    const ops = [
      prisma.role_permissions.deleteMany({ where: { menu_key } }),
    ]
    if (roles.length > 0) {
      ops.push(
        prisma.role_permissions.createMany({
          data: roles.map((role) => ({ role_name: role, menu_key })),
        }),
      )
    }
    await prisma.$transaction(ops)

    res.json({ message: 'Hak akses berhasil diupdate' })
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengupdate hak akses' })
  }
}
