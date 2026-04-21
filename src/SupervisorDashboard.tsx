import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

interface Player {
  id: string;
  email: string;
}

interface Payment {
  id: string;
  user_id: string;
  payment_label: string;
  amount: number;
}

interface Incident {
  id: string;
  user_id: string;
  incident_type: string;
  is_active: boolean;
}

const INCIDENT_TYPES = [
  { key: 'manifestacion_comunidad', label: 'Manifestación de la comunidad' },
  { key: 'demora_materiales', label: 'Demora en los materiales' },
  { key: 'accidente_obra', label: 'Accidente en la obra' },
  { key: 'lluvia_intensa', label: 'Lluvia intensa' },
  { key: 'derrumbe', label: 'Derrumbe' },
];

const SS: React.CSSProperties = {
  background: '#0b1220',
  border: '1px solid #334155',
  borderRadius: '14px',
  padding: '18px',
};

const BS: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
};

interface Props {
  currentUser: any;
  onLogout: () => void;
  onViewGame: (player: { id: string; email: string }) => void;
}

export default function SupervisorDashboard({ currentUser, onLogout, onViewGame }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [newPaymentLabel, setNewPaymentLabel] = useState('');
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [loading, setLoading] = useState(true);

  // Cargar lista de jugadores (todos los game_state excepto supervisor)
  const loadPlayers = useCallback(async () => {
    const { data } = await supabase
      .from('game_state')
      .select('user_id')
      .order('updated_at');

    if (data) {
      // Get emails from auth - we stored them in game_state
      const { data: stateData } = await supabase
        .from('game_state')
        .select('user_id, project_data');

      if (stateData) {
        const playerList: Player[] = stateData
          .filter((s: any) => s.project_data?.email && s.project_data.email !== 'supervisor@constructor.co')
          .map((s: any) => ({
            id: s.user_id,
            email: s.project_data.email,
          }));
        setPlayers(playerList);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlayers();
    const interval = setInterval(loadPlayers, 5000);
    return () => clearInterval(interval);
  }, [loadPlayers]);

  // Cargar pagos e incidencias del jugador seleccionado
  const loadPlayerData = useCallback(async (userId: string) => {
    const { data: payData } = await supabase
      .from('game_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (payData) setPayments(payData);

    const { data: incData } = await supabase
      .from('game_incidents')
      .select('*')
      .eq('user_id', userId);

    if (incData) setIncidents(incData);
  }, []);

  useEffect(() => {
    if (selectedPlayer) {
      loadPlayerData(selectedPlayer.id);
      const interval = setInterval(() => loadPlayerData(selectedPlayer.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedPlayer, loadPlayerData]);

  // Crear pago
  async function createPayment() {
    if (!selectedPlayer || !newPaymentLabel || !newPaymentAmount) return;

    await supabase.from('game_payments').insert({
      user_id: selectedPlayer.id,
      payment_label: newPaymentLabel.toUpperCase(),
      amount: Number(newPaymentAmount) || 0,
      created_by: currentUser.id,
    });

    setNewPaymentLabel('');
    setNewPaymentAmount('');
    loadPlayerData(selectedPlayer.id);
  }

  // Eliminar pago
  async function deletePayment(paymentId: string) {
    await supabase.from('game_payments').delete().eq('id', paymentId);
    loadPlayerData(selectedPlayer!.id);
  }

  // Toggle incidencia
  async function toggleIncident(incidentType: string) {
    if (!selectedPlayer) return;

    const existing = incidents.find(i => i.incident_type === incidentType);

    if (existing) {
      await supabase
        .from('game_incidents')
        .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase.from('game_incidents').insert({
        user_id: selectedPlayer.id,
        incident_type: incidentType,
        is_active: true,
        created_by: currentUser.id,
      });
    }

    loadPlayerData(selectedPlayer.id);
  }

  // Reiniciar juego de un jugador
  async function resetPlayer() {
    if (!selectedPlayer) return;
    if (!confirm(`¿Reiniciar el juego de ${selectedPlayer.email}? Se borrará toda la configuración y avance.`)) return;

    await supabase
      .from('game_state')
      .update({
        project_data: { email: selectedPlayer.email },
        is_reset: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', selectedPlayer.id);

    await supabase.from('game_payments').delete().eq('user_id', selectedPlayer.id);
    await supabase.from('game_incidents').delete().eq('user_id', selectedPlayer.id);

    setPayments([]);
    setIncidents([]);
    alert(`Juego de ${selectedPlayer.email} reiniciado completamente`);
  }

  function isIncidentActive(type: string): boolean {
    const inc = incidents.find(i => i.incident_type === type);
    return inc ? inc.is_active : false;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: '#e5e7eb',
      padding: '32px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Panel del Supervisor</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>{currentUser.email}</p>
          </div>
          <button onClick={onLogout} style={{ ...BS, background: '#dc2626', border: 'none' }}>
            Cerrar sesión
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedPlayer ? '300px 1fr' : '1fr', gap: '20px' }}>

          {/* Lista de grupos */}
          <div style={SS}>
            <h2 style={{ marginTop: 0, fontSize: '16px' }}>Grupos conectados</h2>
            {loading && <p style={{ color: '#94a3b8', fontSize: '13px' }}>Cargando...</p>}
            {!loading && players.length === 0 && (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>
                Ningún grupo ha ingresado todavía. Los grupos aparecerán aquí cuando inicien sesión.
              </p>
            )}
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '10px',
                  border: selectedPlayer?.id === p.id ? '2px solid #2563eb' : '1px solid #334155',
                  background: selectedPlayer?.id === p.id ? '#1e3a5f' : '#111827',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                }}
              >
                {p.email.split('@')[0]}
              </button>
            ))}
          </div>

          {/* Panel del grupo seleccionado */}
          {selectedPlayer && (
            <div>
              <div style={{ ...SS, marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>
                    {selectedPlayer.email.split('@')[0].toUpperCase()}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => onViewGame(selectedPlayer)}
                      style={{ ...BS, background: '#2563eb', border: 'none' }}
                    >
                      Ver partida
                    </button>
                    <button
                      onClick={resetPlayer}
                      style={{ ...BS, background: '#dc2626', border: 'none' }}
                    >
                      Reiniciar juego
                    </button>
                  </div>
                </div>
              </div>

              {/* Crear pagos */}
              <div style={{ ...SS, marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, fontSize: '15px' }}>Crear pagos</h3>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <input
                    value={newPaymentLabel}
                    onChange={e => setNewPaymentLabel(e.target.value)}
                    placeholder="Nombre del pago (ej: PAGO 1)"
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#111827',
                      color: '#f8fafc',
                      fontSize: '13px',
                    }}
                  />
                  <input
                    value={newPaymentAmount}
                    onChange={e => setNewPaymentAmount(e.target.value)}
                    placeholder="Monto (millones)"
                    type="number"
                    style={{
                      width: '150px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#111827',
                      color: '#f8fafc',
                      fontSize: '13px',
                    }}
                  />
                  <button
                    onClick={createPayment}
                    disabled={!newPaymentLabel || !newPaymentAmount}
                    style={{
                      ...BS,
                      background: (!newPaymentLabel || !newPaymentAmount) ? '#334155' : '#2563eb',
                      border: 'none',
                      cursor: (!newPaymentLabel || !newPaymentAmount) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    + Crear pago
                  </button>
                </div>

                {payments.length === 0 && (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>Sin pagos creados</p>
                )}

                {payments.map(pay => (
                  <div
                    key={pay.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      marginBottom: '6px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#111827',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>
                      {pay.payment_label} — <strong style={{ color: '#4ade80' }}>${pay.amount.toLocaleString('es-CO')}M</strong>
                    </span>
                    <button
                      onClick={() => deletePayment(pay.id)}
                      style={{ border: 'none', background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Incidencias */}
              <div style={{ ...SS, marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, fontSize: '15px' }}>Incidencias / Suspensión / Adición</h3>

                {INCIDENT_TYPES.map(inc => (
                  <label
                    key={inc.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      marginBottom: '6px',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      background: isIncidentActive(inc.key) ? '#1e3a5f' : '#111827',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: '#e5e7eb' }}>{inc.label}</span>
                    <input
                      type="checkbox"
                      checked={isIncidentActive(inc.key)}
                      onChange={() => toggleIncident(inc.key)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
