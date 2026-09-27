import { useState } from 'react'
import { Sidebar } from './components/buildsure/sidebar'
import { Header } from './components/buildsure/header'
import { UnifiedOverview } from './components/buildsure/views/unified-overview'
import { SiteRisk } from './components/buildsure/views/site-risk'
import { SafetyIntelligence } from './components/buildsure/views/safety-intelligence-real-ppe'
import { ComplianceAgent } from './components/buildsure/views/compliance-agent-real-api'
import { InsuranceIntelligence } from './components/buildsure/views/insurance-intelligence'
import { EnterprisePortfolio } from './components/buildsure/views/enterprise-portfolio'
import { PredictiveIotConsole } from './components/buildsure/views/predictive-iot-console'

const VIEW_META = {
  unified: {
    title: 'Unified Overview',
    subtitle: 'High-level rollup across all intelligence modules',
    Component: UnifiedOverview,
  },
  'site-risk': {
    title: 'Site Risk Assessment',
    subtitle: 'Milestone 1 — Inherent & residual risk modeling',
    Component: SiteRisk,
  },
  safety: {
    title: 'Safety Intelligence',
    subtitle: 'Milestone 2 — AI vision PPE & hazard detection',
    Component: SafetyIntelligence,
  },
  compliance: {
    title: 'Compliance Agent',
    subtitle: 'Milestone 3 — OSHA 1926 & ISO 45001 validation',
    Component: ComplianceAgent,
  },
  insurance: {
    title: 'Insurance Intelligence',
    subtitle: 'Milestone 3 — Underwriting & premium optimization',
    Component: InsuranceIntelligence,
  },
  portfolio: {
    title: 'Enterprise Portfolio',
    subtitle: 'Milestone 4 — Multi-site risk rollup & executive reporting',
    Component: EnterprisePortfolio,
  },
  iot: {
    title: 'Predictive AI & IoT Console',
    subtitle: 'Milestone 4 — Forecasting, telemetry & autonomous mitigation',
    Component: PredictiveIotConsole,
  },
}

export default function App() {
  const [activeView, setActiveView] = useState('unified')
  const meta = VIEW_META[activeView]

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar activeView={activeView} onChange={setActiveView} />
      <div className="flex-1 overflow-y-auto">
        <Header title={meta.title} subtitle={meta.subtitle} />
        <main className="p-8">
          <meta.Component />
        </main>
      </div>
    </div>
  )
}
