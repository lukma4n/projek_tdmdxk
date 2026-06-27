import { TrendingUp } from 'lucide-react'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { SlaSection } from './SlaPrimitives'

export default function SlaTrendChart({ trend }) {
  if (!trend?.length) {
    return (
      <SlaSection title="Tren Kepatuhan SLA per Bulan" icon={TrendingUp}>
        <p className="text-sm text-faint py-6 text-center">Belum ada data tren.</p>
      </SlaSection>
    )
  }

  return (
    <SlaSection
      title="Tren Kepatuhan SLA per Bulan"
      icon={TrendingUp}
      subtitle="Kohort berdasarkan bulan penjualan (SO). On-Time % dari unit yang sudah selesai di tiap bulan."
    >
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
            <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value, name) => {
                if (value === null) return ['—', name]
                if (name === 'Volume') return [`${value} unit`, name]
                return [`${value}%`, name]
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="vol" dataKey="volume" name="Volume" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line yAxisId="pct" type="monotone" dataKey="stnkOnTimePct" name="STNK On-Time %" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            <Line yAxisId="pct" type="monotone" dataKey="bpkbOnTimePct" name="BPKB On-Time %" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SlaSection>
  )
}
