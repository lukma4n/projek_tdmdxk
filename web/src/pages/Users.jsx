import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { Plus, Trash2, KeyRound, Pencil, X, Check, Loader2 } from 'lucide-react'
import {
  ALL_ROLES,
  ROLES as ROLE_VALUES,
  displayRole,
} from '../config/roles'

export default function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const isPicOpname = currentUser?.role === ROLE_VALUES.PIC_STOCK_OPNAME
  const isAdminManager = [ROLE_VALUES.KEPALA_CABANG, ROLE_VALUES.KEPALA_BENGKEL].includes(currentUser?.role)

  // Filter roles: PIC hanya bisa lihat/buat PIC Stock opname
  // Admin manager tidak boleh lihat PIC Stock opname (PIC mengelola sendiri)
  const ROLES = isPicOpname
    ? [ROLE_VALUES.PIC_STOCK_OPNAME]
    : isAdminManager
      ? ALL_ROLES.filter((r) => r !== ROLE_VALUES.PIC_STOCK_OPNAME)
      : ALL_ROLES
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [resetUser, setResetUser] = useState(null)
  const [locationOptions, setLocationOptions] = useState([])

  const [formData, setFormData] = useState(() => ({
    username: '',
    password: '',
    name: '',
    phone: '',
    role: isPicOpname ? 'PIC Stock opname' : (ALL_ROLES[0] || 'PIC Stock opname'),
    locations: [],
  }))

  const [resetPassword, setResetPassword] = useState('')

  const loadUsers = async () => {
    try {
      const data = await api.getUsers()
      setUsers(data.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadLocations = async () => {
    try {
      const res = await api.getShowroomStockUnitFilters()
      setLocationOptions(res.locations || [])
    } catch {
      setLocationOptions([])
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadUsers)
    void Promise.resolve().then(loadLocations)
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.createUser(formData)
      setShowForm(false)
      setFormData({ username: '', password: '', name: '', phone: '', role: ROLES[0] || 'PIC Stock opname', locations: [] })
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    try {
      await api.updateUser(editingUser.id, {
        name: editingUser.name,
        role: editingUser.role,
        phone: editingUser.phone,
        locations: editingUser.locations,
      })
      setEditingUser(null)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin mau hapus user ini?')) return
    try {
      await api.deleteUser(id)
      loadUsers()
    } catch (err) {
      alert('Gagal menghapus: ' + err.message)
    }
  }

  const handleResetPassword = async () => {
    if (!resetUser || !resetPassword) return
    try {
      await api.resetPassword(resetUser.id, resetPassword)
      setResetUser(null)
      setResetPassword('')
      alert('Password berhasil direset')
    } catch (err) {
      alert('Gagal reset password: ' + err.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen User</h1>
          <p className="text-sm text-slate-500">Tambah, edit, hapus, dan reset password user</p>
        </div>
        <button
          onClick={() => {
            setFormData({
              username: '',
              password: '',
              name: '',
              phone: '',
              role: isPicOpname ? 'PIC Stock opname' : (ROLES[0] || 'PIC Stock opname'),
              locations: [],
            })
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all"
        >
          <Plus size={16} />
          Tambah User
        </button>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>
      )}

      {/* Add User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Tambah User Baru</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="roni"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="minimal 8 karakter"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Roni"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">No. HP (Opsional)</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="08123456789"
                />
              </div>
              {isPicOpname ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <div className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 select-none">
                    PIC Stock Opname
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{displayRole(r)}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lokasi Tugas</label>
                <select
                  multiple={true}
                  value={formData.locations}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
                    setFormData((prev) => ({ ...prev, locations: opts }))
                  }}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                >
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Tekan Ctrl (Windows) atau Command (Mac) untuk memilih banyak lokasi</p>
                {formData.locations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.locations.map((loc) => (
                      <span key={loc} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs border border-blue-100">
                        {loc}
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, locations: prev.locations.filter((l) => l !== loc) }))}
                          className="hover:text-blue-900"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all"
              >
                Simpan User
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setResetUser(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Reset Password</h2>
              <button onClick={() => setResetUser(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Reset password untuk <span className="font-semibold">{resetUser.name}</span> ({resetUser.username})
              </p>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password baru minimal 8 karakter"
                minLength={8}
              />
              <button
                onClick={handleResetPassword}
                className="w-full py-2.5 bg-warning-500 hover:bg-warning-600 text-white rounded-lg text-sm font-medium shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <KeyRound size={16} />
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Nama', 'Username', 'No. HP', ...(isPicOpname ? [] : ['Role']), 'Lokasi', 'Dibuat', 'Aksi'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      {editingUser?.id === user.id ? (
                        <input
                          type="text"
                          value={editingUser.name}
                          onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-medium text-slate-800">{user.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{user.username}</td>

                    <td className="px-4 py-3">
                      {editingUser?.id === user.id ? (
                        <input
                          type="text"
                          value={editingUser.phone || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm"
                          placeholder="0812..."
                        />
                      ) : (
                        <span className="text-sm text-slate-600">{user.phone || '-'}</span>
                      )}
                    </td>

                    {!isPicOpname && (
                      <td className="px-4 py-3">
                        {editingUser?.id === user.id ? (
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm"
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{displayRole(r)}</option>)}
                          </select>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            user.role === 'Kepala Bengkel' ? 'bg-blue-100 text-blue-700' :
                            user.role === 'Service Advisor' ? 'bg-warning-100 text-warning-700' :
                            user.role === 'Partman' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {displayRole(user.role)}
                          </span>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-3">
                      {editingUser?.id === user.id ? (
                        <select
                          multiple={true}
                          value={editingUser.locations || []}
                          onChange={(e) => {
                            const opts = Array.from(e.target.selectedOptions).map((o) => o.value)
                            setEditingUser((prev) => ({ ...prev, locations: opts }))
                          }}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm min-h-[80px]"
                        >
                          {locationOptions.map((loc) => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(user.locations || []).map((loc) => (
                            <span key={loc} className="inline-flex px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs border border-blue-100">
                              {loc}
                            </span>
                          ))}
                          {(user.locations || []).length === 0 && (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString('id-ID')}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {editingUser?.id === user.id ? (
                          <>
                            <button
                              onClick={handleUpdate}
                              className="p-1.5 text-success-600 hover:bg-success-50 rounded-lg transition-colors"
                              title="Simpan"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Batal"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingUser({ ...user })}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit nama, role & lokasi"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setResetUser(user)}
                              className="p-1.5 text-slate-400 hover:text-warning-600 hover:bg-warning-50 rounded-lg transition-colors"
                              title="Reset password"
                            >
                              <KeyRound size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                              title="Hapus user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
