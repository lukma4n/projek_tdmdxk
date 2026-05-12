import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMargin } from '../src/controllers/salesOrderMarginController.js'

test('calculateMargin cash MRBC example: Sisa Piutang = OTR - (Setoran + Program + Diskon Manual)', () => {
  const result = calculateMargin({
    sale_type: 'CASH',
    otr_price: 25400000,
    dp_net_customer: 0,
    customer_discount: 1000000,
    program_total_discount: 0,
    dealer_subsidy: 1000000,
  })
  assert.equal(result.totalDisc, 1000000)
  assert.equal(result.sisaPiutang, 24400000)
})

test('calculateMargin credit: Sisa Piutang = OTR - (DP Net + Program + Diskon Manual + TAC)', () => {
  const result = calculateMargin({
    sale_type: 'KREDIT',
    otr_price: 25000000,
    dp_net_customer: 1500000,
    customer_discount: 0,
    program_total_discount: 500000,
    dealer_subsidy: 200000,
    leasing_subsidy: 700000,
  })
  assert.equal(result.totalDisc, 500000 + 700000)
  assert.equal(result.sisaPiutang, 25000000 - 1500000 - (500000 + 700000))
})

test('calculateMargin credit avoids double count for program_dealer_discount in Sisa Piutang', () => {
  const result = calculateMargin({
    sale_type: 'KREDIT',
    otr_price: 25000000,
    dp_net_customer: 1500000,
    program_total_discount: 500000,
    dealer_subsidy: 200000,
    program_dealer_discount: 300000,
    leasing_subsidy: 700000,
  })
  // Total Disc mengikuti komponen Odoo: Potongan + PS + Program MD
  assert.equal(result.totalDisc, 500000 + 700000)
  assert.equal(result.sisaPiutang, 25000000 - 1500000 - (500000 + 700000))
  // totalBebanDealer margin tetap memuat dealer program
  assert.equal(result.totalBebanDealer, 500000)
})

test('calculateMargin hutang komisi affects margin but not Sisa Piutang', () => {
  const base = calculateMargin({
    sale_type: 'KREDIT',
    otr_price: 28470000,
    dp_net_customer: 900000,
    customer_discount: 1100000,
    leasing_subsidy: 800000,
    program_total_discount: 0,
    dealer_subsidy: 0,
    hutang_komisi: 0,
  })
  const withCommission = calculateMargin({
    sale_type: 'KREDIT',
    otr_price: 28470000,
    dp_net_customer: 900000,
    customer_discount: 1100000,
    leasing_subsidy: 800000,
    program_total_discount: 0,
    dealer_subsidy: 0,
    hutang_komisi: 150000,
  })

  assert.equal(base.totalDisc, withCommission.totalDisc)
  assert.equal(base.sisaPiutang, withCommission.sisaPiutang)
  assert.ok(withCommission.totalBebanDealer > base.totalBebanDealer)
  assert.ok(withCommission.marginRemaining < base.marginRemaining)
})
