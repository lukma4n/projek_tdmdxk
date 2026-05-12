let maintenanceState = {
  active: false,
  reason: null,
  since: null,
}

export function isMaintenanceActive() {
  return maintenanceState.active
}

export function getMaintenanceState() {
  return { ...maintenanceState }
}

export function startMaintenance(reason = 'maintenance') {
  if (maintenanceState.active) {
    return false
  }

  maintenanceState = {
    active: true,
    reason,
    since: new Date().toISOString(),
  }
  return true
}

export function endMaintenance() {
  maintenanceState = {
    active: false,
    reason: null,
    since: null,
  }
}
