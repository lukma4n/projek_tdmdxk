import fetchWithAuth, { API_BASE } from './api/fetchWithAuth.js'
import * as auth from './api/auth.js'
import * as dashboard from './api/dashboard.js'
import * as hotline from './api/hotline.js'
import * as users from './api/users.js'
import * as stock from './api/stock.js'
import * as workshop from './api/workshop.js'
import * as customers from './api/customers.js'
import * as opname from './api/opname.js'
import * as sync from './api/sync.js'
import * as showroom from './api/showroom.js'

export const api = {
  ...auth,
  ...dashboard,
  ...hotline,
  ...users,
  ...stock,
  ...workshop,
  ...customers,
  ...opname,
  ...sync,
  ...showroom,
}

export { API_BASE, fetchWithAuth }
export default api
