import { useState } from 'react';
import { supabase } from './supabaseClient';

interface Props {
  onLogin: (user: any, role: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#111827',
        border: '1px solid #334155',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '960px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '40px',
        alignItems: 'center',
      }}>

        {/* Columna izquierda: logo */}
        <div style={{
          flex: '1 1 340px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '280px',
        }}>
          <img
            src="/imagenes/LOGO.jpg"
            alt="Constructor — Simulador de gestión de obra civil"
            style={{
              width: '100%',
              maxWidth: '380px',
              height: 'auto',
              borderRadius: '16px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'block',
            }}
          />
        </div>

        {/* Columna derecha: formulario */}
        <div style={{
          flex: '1 1 320px',
          minWidth: '280px',
        }}>
          <h2 style={{
            color: '#f8fafc',
            fontSize: '22px',
            fontWeight: 700,
            margin: '0 0 24px 0',
          }}>
            Acceso por grupo
          </h2>

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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #334155',
                  background: '#0b1220',
                  color: '#f8fafc',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
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
              background: loading || !email || !password ? '#334155' : '#dc2626',
              color: '#fff',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.5px',
              cursor: loading ? 'wait' : (!email || !password ? 'not-allowed' : 'pointer'),
              boxShadow: loading || !email || !password ? 'none' : '0 6px 18px rgba(220,38,38,0.35)',
            }}
          >
            {loading ? 'INGRESANDO...' : 'INGRESAR'}
          </button>
        </div>
      </div>
    </div>
  );
}
