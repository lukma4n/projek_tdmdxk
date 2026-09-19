import fetchWithAuth, { API_BASE } from './api/fetchWithAuth.js'
import * as auth from './api/auth.js'
import * as dashboard from './api/dashboard.js'
import * as hotline from './api/hotline.js'
import * as users from './api/users.js'
import * as stock from './api/stock.js'
import * as workshop from './api/workshop.js'
import * as customers from './api/customers.js'
import * as phoneValidation from './api/phoneValidation.js'
import * as followup from './api/followup.js'
import * as whatsappTemplates from './api/whatsappTemplates.js'
import * as opname from './api/opname.js'
import * as sync from './api/sync.js'
import * as showroom from './api/showroom.js'
import * as security from './api/security.js'

export const api = {
  ...auth,
  ...dashboard,
  ...hotline,
  ...users,
  ...stock,
  ...workshop,
  ...customers,
  ...phoneValidation,
  ...followup,
  ...whatsappTemplates,
  ...opname,
  ...sync,
  ...showroom,
  ...security,
}

export { API_BASE, fetchWithAuth }
export default api
