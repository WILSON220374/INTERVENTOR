import { useState } from 'react';
import { supabase } from './supabaseClient';

interface Props {
  onLogin: (user: any, role: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError('Email o contraseña incorrectos');
      setLoading(false);
      return;
    }

    // Registrar en game_state si no existe
    const { data: existing } = await supabase
      .from('game_state')
      .select('id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('game_state').insert({
        user_id: data.user.id,
        project_data: { email: data.user.email },
        is_reset: false,
      });
    }

    const role = data.user.email === 'supervisor@constructor.co' ? 'admin' : 'player';
    onLogin(data.user, role);
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#111827',
        border: '1px solid #334155',
        borderRadius: '18px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      }}>
        <h1 style={{
          color: '#f8fafc',
          fontSize: '28px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '8px',
        }}>
          INTERVENTOR
        </h1>
        <p style={{
          color: '#94a3b8',
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          Simulador de gestión de megaproyecto vial
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="grupo1@constructor.co"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#f8fafc',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#f8fafc',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {error && (
          <p style={{
            color: '#ef4444',
            fontSize: '13px',
            textAlign: 'center',
            marginBottom: '16px',
          }}>
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            background: loading ? '#334155' : '#2563eb',
            color: '#fff',
            fontWeight: 700,
            fontSize: '15px',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  );
}
