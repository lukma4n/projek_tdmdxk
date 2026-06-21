import { prisma } from '../config/db.js'

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getEffectiveDays(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  let effectiveDays = 0;
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month - 1, i);
    // Exclude Sundays (0)
    if (date.getDay() !== 0) {
      effectiveDays++;
    }
  }
  return effectiveDays;
}

function getCurrentEffectiveDay(year, month) {
  const now = new Date();
  if (now.getFullYear() < year || (now.getFullYear() === year && now.getMonth() + 1 < month)) {
    return getEffectiveDays(year, month);
  }
  if (now.getFullYear() > year || (now.getFullYear() === year && now.getMonth() + 1 > month)) {
    return getEffectiveDays(year, month);
  }
  
  // Current month
  let effectiveDays = 0;
  const currentDay = now.getDate();
  for (let i = 1; i <= currentDay; i++) {
    const date = new Date(year, month - 1, i);
    if (date.getDay() !== 0) {
      effectiveDays++;
    }
  }
  return effectiveDays;
}

const CATEGORY_MAP = {
  OLI: ['OIL', 'SAOIL'],
  JASA: ['LR', 'CS', 'OR+', 'HR', 'EC', 'CLA'],
}

function classifyCategory(categoryName, type) {
  if (type === 'LCR') return 'LCR';
  if (type === 'KPB' || String(categoryName).startsWith('KPB')) return 'KPB';
  
  if (CATEGORY_MAP.OLI.includes(categoryName)) return 'OLI';
  if (CATEGORY_MAP.JASA.includes(categoryName)) return 'JASA';
  
  // Default to PART
  return 'PART';
}

export async function getDashboardMechanic(req, res, next) {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'Year and month required' });
    
    const y = parseInt(year);
    const m = parseInt(month);
    
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);
    
    // Get Targets
    const targetsRaw = await prisma.workshop_marketing_targets.findMany({
      where: { period_year: y, period_month: m }
    });
    
    const targets = {};
    for (const t of targetsRaw) {
      targets[t.mechanic] = t;
    }
    
    // Get Actuals
    const wos = await prisma.work_orders.findMany({
      where: { state: 'done', date_confirm: { gte: startDate, lte: endDate } }
    });
    
    const mechanicMap = {};
    
    for (const wo of wos) {
      const mech = wo.mechanic || 'Tanpa Mekanik';
      if (!mechanicMap[mech]) {
        mechanicMap[mech] = { 
          name: mech, 
          aktual_unit: 0, 
          aktual_jasa: 0, 
          aktual_part: 0, 
          aktual_oli: 0, 
          aktual_lcr: 0 
        };
      }
      
      const category = classifyCategory(wo.category_name, wo.type);
      
      // Every row is 1 unit entry technically? Wait, 1 WO = 1 Unit Entry. 
      // But we have 1 WO per row. So every row is an item. 
      // To get aktual_unit accurately without duplicate WO, we should track unique wo_number per mechanic.
      // However, we saw earlier COUNT(*) == COUNT(DISTINCT wo_number). So each row IS a distinct WO!
      mechanicMap[mech].aktual_unit += 1;
      
      if (category === 'JASA') mechanicMap[mech].aktual_jasa += wo.total;
      else if (category === 'PART') mechanicMap[mech].aktual_part += wo.total;
      else if (category === 'OLI') mechanicMap[mech].aktual_oli += wo.total;
      
      if (wo.type === 'LCR') mechanicMap[mech].aktual_lcr += 1;
    }
    
    const result = [];
    
    for (const [mech, act] of Object.entries(mechanicMap)) {
      const tgt = targets[mech] || { target_unit: 0, target_jasa: 0, target_part: 0, target_oli: 0, target_lcr: 0 };
      
      result.push({
        mechanic: mech,
        target_unit: tgt.target_unit,
        aktual_unit: act.aktual_unit,
        target_jasa: tgt.target_jasa,
        aktual_jasa: act.aktual_jasa,
        target_part: tgt.target_part,
        aktual_part: act.aktual_part,
        target_oli: tgt.target_oli,
        aktual_oli: act.aktual_oli,
        target_lcr: tgt.target_lcr,
        aktual_lcr: act.aktual_lcr,
      });
    }
    
    // Add targets that don't have actuals
    for (const [mech, tgt] of Object.entries(targets)) {
      if (!mechanicMap[mech] && mech !== 'ALL') {
        result.push({
          mechanic: mech,
          target_unit: tgt.target_unit,
          aktual_unit: 0,
          target_jasa: tgt.target_jasa,
          aktual_jasa: 0,
          target_part: tgt.target_part,
          aktual_part: 0,
          target_oli: tgt.target_oli,
          aktual_oli: 0,
          target_lcr: tgt.target_lcr,
          aktual_lcr: 0,
        });
      }
    }
    
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDashboardKPB(req, res, next) {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'Year and month required' });
    
    const y = parseInt(year);
    const m = parseInt(month);
    
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);
    
    const totalEffective = getEffectiveDays(y, m);
    const currentEffective = getCurrentEffectiveDay(y, m);
    
    const wos = await prisma.work_orders.findMany({
      where: { state: 'done', type: 'KPB', date_confirm: { gte: startDate, lte: endDate } }
    });
    
    const kpbCount = { KPB1: 0, KPB2: 0, KPB3: 0, KPB4: 0 };
    
    for (const wo of wos) {
      if (wo.category_name === 'KPB1') kpbCount.KPB1++;
      if (wo.category_name === 'KPB2') kpbCount.KPB2++;
      if (wo.category_name === 'KPB3') kpbCount.KPB3++;
      if (wo.category_name === 'KPB4') kpbCount.KPB4++;
    }
    
    res.json({
      effective_days: totalEffective,
      current_effective_day: currentEffective,
      kpb_actuals: kpbCount
    });
  } catch(err) {
    next(err);
  }
}

export async function getDashboardBranch(req, res, next) {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'Year and month required' });
    
    const y = parseInt(year);
    const m = parseInt(month);
    
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);
    
    // Also get last month
    let lastM = m - 1;
    let lastY = y;
    if (lastM === 0) {
      lastM = 12;
      lastY = y - 1;
    }
    const lastStartDate = new Date(lastY, lastM - 1, 1);
    const lastEndDate = new Date(lastY, lastM, 0, 23, 59, 59, 999);
    
    const wos = await prisma.work_orders.findMany({
      where: { state: 'done', date_confirm: { gte: startDate, lte: endDate } }
    });
    
    const wosLastMonth = await prisma.work_orders.findMany({
      where: { state: 'done', date_confirm: { gte: lastStartDate, lte: lastEndDate } }
    });
    
    const branchTargetRaw = await prisma.workshop_marketing_targets.findFirst({
      where: { period_year: y, period_month: m, mechanic: 'ALL' }
    });
    
    const branchTarget = branchTargetRaw || { target_unit: 0, target_jasa: 0, target_part: 0, target_oli: 0, target_lcr: 0 };
    
    const calculateStats = (records) => {
      let unit = 0, jasa = 0, part = 0, oli = 0, lcr = 0;
      for (const wo of records) {
        unit++;
        const category = classifyCategory(wo.category_name, wo.type);
        if (category === 'JASA') jasa += wo.total;
        else if (category === 'PART') part += wo.total;
        else if (category === 'OLI') oli += wo.total;
        if (wo.type === 'LCR') lcr++;
      }
      return { unit, jasa, part, oli, lcr };
    };
    
    const currentStats = calculateStats(wos);
    const lastMonthStats = calculateStats(wosLastMonth);
    
    const totalEffective = getEffectiveDays(y, m);
    const currentEffective = getCurrentEffectiveDay(y, m);
    
    res.json({
      effective_days: totalEffective,
      current_effective_day: currentEffective,
      targets: branchTarget,
      current_month: currentStats,
      last_month: lastMonthStats
    });
  } catch(err) {
    next(err);
  }
}
