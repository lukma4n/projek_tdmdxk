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
    await prisma.$transaction(async (tx) => {
      // Hapus semua roles untuk menu ini
      await tx.role_permissions.deleteMany({
        where: { menu_key }
      })
      
      // Insert roles yang baru
      if (roles.length > 0) {
        await tx.role_permissions.createMany({
          data: roles.map(role => ({ role_name: role, menu_key }))
        })
      }
    })
    
    res.json({ message: 'Hak akses berhasil diupdate' })
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengupdate hak akses' })
  }
}
