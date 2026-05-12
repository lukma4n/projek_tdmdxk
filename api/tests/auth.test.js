import test from 'node:test'
import assert from 'node:assert/strict'
import { authorize } from '../src/middleware/auth.js'

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

test('authorize returns 403 when authenticated role is not allowed', () => {
  const req = { user: { role: 'Partman' } }
  const res = mockResponse()
  let calledNext = false

  authorize('Kepala Bengkel')(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, false)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'Akses ditolak')
})

test('authorize calls next when role is allowed', () => {
  const req = { user: { role: 'Kepala Bengkel' } }
  const res = mockResponse()
  let calledNext = false

  authorize('Kepala Bengkel')(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, true)
  assert.equal(res.statusCode, 200)
})

test('backup admin guard allows Kepala Bengkel and Kepala Cabang only', () => {
  for (const role of ['Kepala Bengkel', 'Kepala Cabang']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('Kepala Bengkel', 'Kepala Cabang')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, true)
    assert.equal(res.statusCode, 200)
  }

  for (const role of ['Admin', 'CRM', 'Frondesk', 'Service Advisor', 'Partman']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('Kepala Bengkel', 'Kepala Cabang')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, false)
    assert.equal(res.statusCode, 403)
    assert.equal(res.body.error, 'Akses ditolak')
  }
})

test('dashboard bengkel guard rejects Admin Showroom', () => {
  for (const role of ['Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, true)
    assert.equal(res.statusCode, 200)
  }

  for (const role of ['Admin', 'CRM']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, false)
    assert.equal(res.statusCode, 403)
  }
})

test('follow-up KPB guard allows CRM and Frondesk but still rejects Partman', () => {
  for (const role of ['CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, true)
    assert.equal(res.statusCode, 200)
  }

  const req = { user: { role: 'Partman' } }
  const res = mockResponse()
  let calledNext = false

  authorize('CRM', 'Frondesk', 'Service Advisor', 'Kepala Bengkel')(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, false)
  assert.equal(res.statusCode, 403)
})

test('showroom guard allows Admin and Kepala Cabang only', () => {
  for (const role of ['Admin', 'Kepala Cabang']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('Admin', 'Kepala Cabang')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, true)
    assert.equal(res.statusCode, 200)
  }

  for (const role of ['CRM', 'Kepala Bengkel', 'Frondesk', 'Service Advisor', 'Partman']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('Admin', 'Kepala Cabang')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, false)
    assert.equal(res.statusCode, 403)
  }
})

test('showroom document stock guard allows Admin Showroom only', () => {
  const req = { user: { role: 'Admin' } }
  const res = mockResponse()
  let calledNext = false

  authorize('Admin')(req, res, () => {
    calledNext = true
  })

  assert.equal(calledNext, true)
  assert.equal(res.statusCode, 200)

  for (const role of ['Kepala Cabang', 'CRM', 'Kepala Bengkel', 'Frondesk', 'Service Advisor', 'Partman']) {
    const deniedReq = { user: { role } }
    const deniedRes = mockResponse()
    let deniedNext = false

    authorize('Admin')(deniedReq, deniedRes, () => {
      deniedNext = true
    })

    assert.equal(deniedNext, false)
    assert.equal(deniedRes.statusCode, 403)
  }
})

test('document follow-up guard allows Admin CRM only', () => {
  for (const role of ['CRM']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('CRM')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, true)
    assert.equal(res.statusCode, 200)
  }

  for (const role of ['Admin', 'Kepala Cabang', 'Kepala Bengkel', 'Frondesk', 'Service Advisor', 'Partman']) {
    const req = { user: { role } }
    const res = mockResponse()
    let calledNext = false

    authorize('CRM')(req, res, () => {
      calledNext = true
    })

    assert.equal(calledNext, false)
    assert.equal(res.statusCode, 403)
  }
})
