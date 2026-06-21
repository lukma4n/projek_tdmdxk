import { useState, useEffect } from 'react'
import { Check, Loader2, Save, ShieldAlert } from 'lucide-react'
import { ALL_ROLES } from '../config/roles'
import { useAuthStore } from '../stores/authStore'
import fetchWithAuth from '../services/api/fetchWithAuth'

// Daftar menu statis untuk UI (bisa disesuaikan agar lebih user-friendly)
const MENUS = [
  { key: 'DASHBOARD_BENGKEL', label: 'Dashboard Bengkel' },
  { key: 'HOTLINE', label: 'Part Hotline' },
  { key: 'STOCK', label: 'Stock Sparepart' },
  { key: 'WORKSHOP', label: 'Workshop' },
  { key: 'WORKSHOP_REPORT', label: 'Laporan Bengkel' },
  { key: 'PROGRAM', label: 'Master Program' },
  { key: 'CUSTOMER', label: 'Data Konsumen' },
  { key: 'FOLLOWUP', label: 'Follow-up KPB' },
  { key: 'DOCUMENT_FOLLOWUP', label: 'Follow-up STNK/BPKB' },
  { key: 'DOCUMENT_HANDOVER', label: 'Document Handling' },
  { key: 'OPNAME', label: 'Opname Sparepart' },
  { key: 'SHOWROOM', label: 'Showroom' },
  { key: 'SHOWROOM_SALES_ORDER', label: 'Showroom Sales Order' },
  { key: 'SHOWROOM_OPNAME', label: 'Opname Unit/STNK/BPKB' },
  { key: 'SHOWROOM_DOCUMENT_STOCK', label: 'Stock STNK/BPKB' },
  { key: 'SHOWROOM_LABEL_BUKU_SERVICE', label: 'Label Buku Service' },
  { key: 'SHOWROOM_STNK_BPKB_MONITORING', label: 'Monitoring STNK & BPKB' },
  { key: 'SHOWROOM_STNK_BPKB_GROUP', label: 'Grup Menu STNK & BPKB' },
  { key: 'SHOWROOM_PIC_USERS', label: 'PIC Opname Users' },
  { key: 'ADMIN', label: 'Menu Master Admin' },
  { key: 'MANAGEMENT', label: 'Manajemen User & Akses' },
  { key: 'IMPORT_HOTLINE', label: 'Import Part Hotline' },
  { key: 'IMPORT_STOCK', label: 'Import Stock Sparepart' },
  { key: 'IMPORT_WORKSHOP', label: 'Import Workshop' },
  { key: 'IMPORT_SALES', label: 'Import Report Penjualan' },
  { key: 'IMPORT_SHOWROOM_STOCK_UNIT', label: 'Import Stock Unit' },
  { key: 'IMPORT_SHOWROOM_OTR_PRICE', label: 'Import Harga OTR' },
  { key: 'IMPORT_SHOWROOM_OFF_PURCHASE_PRICE', label: 'Import Harga Off & Beli' },
  { key: 'IMPORT_SHOWROOM_BBN', label: 'Import Master BBN' },
  { key: 'IMPORT_SHOWROOM_PROGRAM', label: 'Import Program MD/AHM' },
  { key: 'IMPORT_SHOWROOM_STNK_BPKB_TRACK', label: 'Import Track STNK & BPKB' },
]

export default function RoleManagement() {
  const { fetchPermissions } = useAuthStore()
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPermissions()
  }, [])

  const loadPermissions = async () => {
    try {
      const data = await fetchWithAuth('/permissions')
      setPermissions(data)
    } catch (err) {
      setError('Gagal memuat hak akses dari server')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (menuKey, role) => {
    setPermissions(prev => {
      const currentRoles = prev[menuKey] || []
      const newRoles = currentRoles.includes(role)
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role]
      
      return { ...prev, [menuKey]: newRoles }
    })
  }

  const handleSave = async (menuKey) => {
    setSavingKey(menuKey)
    try {
      await fetchWithAuth('/permissions', {
        method: 'PUT',
        body: {
          menu_key: menuKey,
          roles: permissions[menuKey] || []
        }
      })
      // Refresh global store so changes take effect immediately
      await fetchPermissions()
    } catch (err) {
      setError('Gagal menyimpan perubahan. Pastikan Anda memiliki akses IT Master.')
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Manajemen Hak Akses</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atur peran mana saja yang dapat melihat dan mengakses modul tertentu di dalam aplikasi.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-800">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-14rem)]">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[250px] bg-slate-50 px-6 py-4 font-semibold shadow-[1px_1px_0_#e2e8f0]">
                  Modul / Menu
                </th>
                {ALL_ROLES.map(role => (
                  <th key={role} className="sticky top-0 z-20 min-w-[120px] bg-slate-50 px-6 py-4 text-center font-semibold whitespace-nowrap shadow-[0_1px_0_#e2e8f0]">
                    {role}
                  </th>
                ))}
                <th className="sticky right-0 top-0 z-30 bg-slate-50 px-6 py-4 text-center font-semibold shadow-[-1px_1px_0_#e2e8f0]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {MENUS.map((menu) => (
                <tr key={menu.key} className="hover:bg-slate-50/50 transition-colors">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-6 py-4 shadow-[1px_0_0_#e2e8f0]">
                    <div className="font-medium text-slate-900">{menu.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{menu.key}</div>
                  </td>
                  {ALL_ROLES.map(role => {
                    const isChecked = (permissions[menu.key] || []).includes(role)
                    return (
                      <td key={role} className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(menu.key, role)}
                          className="flex w-full cursor-pointer items-center justify-center rounded-lg p-2 hover:bg-slate-100 focus:outline-none"
                        >
                          <div className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        </button>
                      </td>
                    )
                  })}
                  <td className="sticky right-0 z-10 bg-white group-hover:bg-slate-50 px-6 py-4 shadow-[-1px_0_0_#e2e8f0] text-center">
                    <button
                      onClick={() => handleSave(menu.key)}
                      disabled={savingKey === menu.key}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                    >
                      {savingKey === menu.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Simpan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
