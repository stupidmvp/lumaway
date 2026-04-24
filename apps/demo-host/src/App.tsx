import { useState, useEffect, useMemo, useCallback } from 'react'
import { LumaProvider, useLuma } from '@luma/sdk'
import './App.css'
import { Package, Truck, Settings, Moon, Sun, Bell, Search, Plus, Home } from 'lucide-react'

// =========================================================
// VIEWS
// =========================================================

function Dashboard({ onNavigate }: { onNavigate: (r: string) => void }) {
  return (
    <div className="content-area">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h2>Visión General</h2>
        {/* Este botón es el TARGET del Flujo A (Paso 1) */}
        <button id="btn-create-shipment" className="btn-primary" onClick={() => onNavigate('/shipments/new')}>
          <Plus size={18} />
          Crear Nuevo Envío
        </button>
      </div>

      <div id="stats-section" className="stats-grid">
        <div id="stat-shipments" className="card stat-card">
          <h3>Envíos este mes</h3>
          <p className="value">1,248</p>
        </div>
        <div id="stat-spend" className="card stat-card">
          <h3>Gasto acumulado</h3>
          <p className="value">$4,592</p>
        </div>
        <div id="stat-delivery-rate" className="card stat-card">
          <h3>Tasa de entrega (24h)</h3>
          <p className="value" style={{ color: 'var(--success)' }}>98.4%</p>
        </div>
      </div>

      <div id="chart-performance" className="card" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        [Gráfico de envíos simulado]
      </div>
    </div>
  )
}

function NewShipment({ onNavigate }: { onNavigate: (r: string) => void }) {
  const luma = useLuma();

  const handleConfirm = () => {
    // Notify Luma Engine that a key action within the domain was executed
    luma?.sdk?.trackIntent('quiero mandar un paquete');
    alert('¡Envío creado con éxito!');
    onNavigate('/');
  };

  return (
    <div className="content-area" style={{ maxWidth: 800 }}>
      <h2 style={{ marginBottom: 24 }}>Crear Guía de Envío</h2>

      <div className="card">
        <div className="form-group">
          <label>Código Postal Origen</label>
          <input id="input-origin" type="text" placeholder="Ej. 11001" />
        </div>

        <div className="form-group">
          <label>Dirección de Destino</label>
          <input id="input-destination" type="text" placeholder="Calle, Av, Número..." />
        </div>

        <div className="form-group">
          <label>Paquetería Preferida</label>
          <select id="select-carrier" style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-main)', fontSize: 15 }}>
            <option>FedEx - Express</option>
            <option>DHL - Standard</option>
            <option>Estafeta - Economy</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 32 }}>
          <button className="btn-icon" style={{ borderRadius: 8, width: 'auto', padding: '0 20px' }} onClick={() => onNavigate('/')}>
            Cancelar
          </button>

          {/* Este botón es el TARGET del Flujo A (Paso 2) */}
          <button id="btn-confirm-shipment" className="btn-primary" onClick={handleConfirm}>
            <Truck size={18} />
            Confirmar Envío
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsView() {
  const [activeTab, setActiveTab] = useState<'profile' | 'api' | 'billing'>('profile');
  const [key, setKey] = useState<string | null>(null);

  return (
    <div className="content-area" style={{ maxWidth: 900 }}>
      <h2>Configuración</h2>

      <div className="tabs-nav">
        <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Mi Perfil</button>
        {/* TARGET del Flujo B (Paso 2) */}
        <button id="tab-integrations" className={`tab ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>Integraciones API</button>
        <button className={`tab ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>Facturación</button>
      </div>

      <div className="card">
        {activeTab === 'profile' && (
          <div>
            <h3>Datos de la Cuenta</h3>
            <p style={{ color: 'var(--text-muted)' }}>Configuración general del perfil.</p>
          </div>
        )}

        {activeTab === 'api' && (
          <div>
            <h3>Llaves de API (Webhooks)</h3>
            <p style={{ color: 'var(--text-muted)' }}>Genera credenciales para conectar tu e-commerce Magento, Shopify o WooCommerce.</p>

            <div style={{ marginTop: 24 }}>
              {/* TARGET del Flujo B (Paso 3) */}
              <button id="btn-generate-apikey" className="btn-danger" onClick={() => setKey(`sk_live_${Math.random().toString(36).substr(2, 24)}`)}>
                Generar Llave Maestra
              </button>

              {key && (
                <div className="api-key-box">
                  {key}
                  <div style={{ fontSize: 12, marginTop: 8, color: 'var(--success)' }}>Guarda esta llave, no se mostrará de nuevo.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div>
            <h3>Métodos de Pago</h3>
            <div className="api-key-box" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              Tienes un recibo pendiente por $1,200 USD.
            </div>
            {/* Aquí el Flujo C intervendrá vía chat si el usuario entra en fricción  */}
          </div>
        )}
      </div>
    </div>
  )
}

// =========================================================
// MAIN LAYOUT
// =========================================================

const THEME_STORAGE_KEY = 'demo-host-theme'

function Layout({ children, currentRoute, navigate }: any) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as 'light' | 'dark'
    if (saved) applyTheme(saved)
    else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      applyTheme(isDark ? 'dark' : 'light')
    }
  }, [])

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem(THEME_STORAGE_KEY, t)
  }

  const toggleTheme = () => applyTheme(theme === 'light' ? 'dark' : 'light')

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <Package size={28} />
          LumaLogistics
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${currentRoute === '/' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            <Home size={18} />
            Inicio
          </button>
          <button
            className={`nav-item ${currentRoute.includes('/shipments') ? 'active' : ''}`}
            onClick={() => navigate('/shipments/new')}
          >
            <Truck size={18} />
            Envíos
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <nav className="nav">
          {/* TARGET del Flujo B (Paso 1) */}
          <button
            id="btn-nav-settings"
            className={`nav-item ${currentRoute === '/settings' ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            <Settings size={18} />
            Configuración
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header">
          <div className="header-title">
            {currentRoute === '/' && 'Dashboard'}
            {currentRoute === '/shipments/new' && 'Nuevo Envío'}
            {currentRoute === '/settings' && 'Configuración de Cuenta'}
          </div>

          <div className="header-actions">
            <button className="btn-icon">
              <Search size={18} />
            </button>
            <button className="btn-icon">
              <Bell size={18} />
            </button>
            <button className="btn-icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(45deg, var(--primary), #8b5cf6)', cursor: 'pointer' }} />
          </div>
        </header>

        {children}
      </main>
    </div>
  )
}

function App() {
  const [route, setRoute] = useState('/')

  // Simulating a fast internal router that the Engine can track
  const navigate = useCallback((newRoute: string) => {
    // In a real app we'd push state. For Demo, state is fine.
    // Luma Engine will automatically detect this if we hook the router
    // but the LumaProvider handles history pushState normally.
    window.history.pushState({}, '', newRoute)
    setRoute(newRoute)
  }, [])

  const lumaConfig = useMemo(() => ({
    apiKey: "sk_test_demo",
    apiUrl: "http://localhost:3030",
    onNavigate: navigate,
    debug: true,
    cache: {
      enabled: true,
      projectStaleTimeMs: 60_000,
      walkthroughsStaleTimeMs: 30_000,
      versionsStaleTimeMs: 15_000,
    }
  }), [navigate])

  const lumaUserContext = useMemo(() => ({
    locale: "es-CO"
  }), [])

  // Listen to popstate for back buttons
  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <LumaProvider
      config={lumaConfig}
      userContext={lumaUserContext}
    >
      <Layout currentRoute={route} navigate={navigate}>
        {route === '/' && <Dashboard onNavigate={navigate} />}
        {route === '/shipments/new' && <NewShipment onNavigate={navigate} />}
        {route === '/settings' && <SettingsView />}
      </Layout>
    </LumaProvider>
  )
}

export default App
