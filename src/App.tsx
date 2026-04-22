import { useEffect, useRef, useState, useCallback } from 'react';
import GameCanvas from './GameCanvas.tsx';
import LoginScreen from './LoginScreen';
import SupervisorDashboard from './SupervisorDashboard';
import { supabase } from './supabaseClient';
import './App.css';

interface Notif { id: number; icon: string; text: string; }

interface PaymentColumn {
  id: string;
  label: string;
}

interface GlobalPaymentRow {
  [key: string]: number | string;
}

interface ActivityRow {
  id: number;
  nombre: string;
  valor: string;
  duracion: string;
  asignado: number;
  activa: boolean;
  avance: number;
  invertido: number;
  baseWorkDay: number;
  baseInvertido: number;
  pagos: Record<string, number>;
}

interface ProjectFormState {
  proyectoNombre: string;
  contratistaNombre: string;
  contratoValor: string;
  contratoDuracion: string;
  interventoriaNombre: string;
  interventoriaValor: string;
  pagosCols: PaymentColumn[];
  pagosGlobales: Record<string, number>;
  actividades: ActivityRow[];
}

const INITIAL_PAYMENT_COLS: PaymentColumn[] = [
  { id: 'anticipo', label: 'ANTICIPO' },
];

const INITIAL_FORM: ProjectFormState = {
  proyectoNombre: '',
  contratistaNombre: '',
  contratoValor: '',
  contratoDuracion: '',
  interventoriaNombre: '',
  interventoriaValor: '',
  pagosCols: INITIAL_PAYMENT_COLS,
  pagosGlobales: { anticipo: 0 },
  actividades: [{
    id: 1,
    nombre: '',
    valor: '',
    duracion: '',
    asignado: 0,
    activa: true,
    avance: 0,
    invertido: 0,
    baseWorkDay: 0,
    baseInvertido: 0,
    pagos: { anticipo: 0 },
  }],
};

const IS: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #334155',
  background: '#111827',
  color: '#f8fafc',
  fontSize: '14px',
  boxSizing: 'border-box',
};

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

export default function App() {
  const [view, setView] = useState<'login'|'setup'|'game'|'supervisor'>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentRole, setCurrentRole] = useState<string>('player');
  const isSupervisor = currentUser?.email === 'supervisor@constructor.co';
  const [viewingAsPlayer, setViewingAsPlayer] = useState<{id: string; email: string} | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(INITIAL_FORM);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [gameHourDisplay, setGameHourDisplay] = useState('Día 1 - 07:00');
  const [isNight, setIsNight] = useState(false);
  const [nightOpacity, setNightOpacity] = useState(0);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [workDays, setWorkDays] = useState(0);
  const [workTimeDisplay, setWorkTimeDisplay] = useState('Día 1 - 07:00');
  const [startTile, setStartTile] = useState<{r:number;c:number}|null>(null);
  const [roadProgress, setRoadProgress] = useState(0);
  const [projectProgress, setProjectProgress] = useState(0);
  const [liveActs, setLiveActs] = useState<ActivityRow[]>([]);
  const [suspended, setSuspended] = useState(false);
  const [obraFinished, setObraFinished] = useState(false);
  const [recursosAgotados, setRecursosAgotados] = useState(false);
  const [isDaytime, setIsDaytime] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [score, setScore] = useState(50);
  const [manifestacionComunidadActiva, setManifestacionComunidadActiva] = useState(false);
  const [manifestacionComunidadPendiente, setManifestacionComunidadPendiente] = useState(false);
  const [manifestacionComunidadResuelta, setManifestacionComunidadResuelta] = useState(false);
  const [demoraMaterialesActiva, setDemoraMaterialesActiva] = useState(false);
  const [demoraMaterialesPendiente, setDemoraMaterialesPendiente] = useState(false);
  const [demoraMaterialesResuelta, setDemoraMaterialesResuelta] = useState(false);
  const [accidenteObraActiva, setAccidenteObraActiva] = useState(false);
  const [accidenteObraPendiente, setAccidenteObraPendiente] = useState(false);
  const [accidenteObraResuelta, setAccidenteObraResuelta] = useState(false);
  const [lluviaIntensaActiva, setLluviaIntensaActiva] = useState(false);
  const [derrumbeActivo, setDerrumbeActivo] = useState(false);
  const [derrumbePendiente, setDerrumbePendiente] = useState(false);
  const [derrumbeResuelto, setDerrumbeResuelto] = useState(false);
  const startRef = useRef(Date.now());
  const gameStartedAtRef = useRef(0);
  const nidRef = useRef(0);
  const suspendedTimeRef = useRef(0);
  const suspendStartRef = useRef(0);
  const accumulatedGameMsRef = useRef(0);
  const lastRealTickRef = useRef(Date.now());
  const initialContratoValorRef = useRef<string | null>(null);
  const initialContratoDuracionRef = useRef<string | null>(null);
  const cambiosContratoValorRef = useRef(0);
  const cambiosContratoDuracionRef = useRef(0);
  const fondoAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambienteAudioRef = useRef<HTMLAudioElement | null>(null);
  const enObraAudioRef = useRef<HTMLAudioElement | null>(null);
  const nocheAudioRef = useRef<HTMLAudioElement | null>(null);
  const lluviaAudioRef = useRef<HTMLAudioElement | null>(null);
  const loadedRef = useRef(false);

  // Cargar pagos e incidencias de Supabase para el jugador
  useEffect(() => {
    if (!currentUser) return;
    // Supervisor no necesita polling — ve los datos desde su panel
    if (isSupervisor) return;

    const targetUserId = currentUser.id;

    async function loadFromSupabase() {
      // Cargar pagos
      const { data: payments } = await supabase
        .from('game_payments')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at');

      if (payments && payments.length > 0) {
        const cols = payments.map((p: any) => ({ id: p.id, label: p.payment_label }));
        const globales: Record<string, number> = {};
        for (const p of payments) {
          globales[p.id] = p.amount;
        }
        setProjectForm(prev => ({
          ...prev,
          pagosCols: cols,
          pagosGlobales: globales,
          actividades: prev.actividades.map(a => ({
            ...a,
            pagos: {
              ...Object.fromEntries(cols.map((c: any) => [c.id, a.pagos?.[c.id] || 0])),
            },
            asignado: cols.reduce((sum: number, c: any) => sum + (Number(a.pagos?.[c.id]) || 0), 0),
          })),
        }));
      }

      // Cargar incidencias
      const { data: incidents } = await supabase
        .from('game_incidents')
        .select('*')
        .eq('user_id', targetUserId);

      if (incidents) {
        for (const inc of incidents) {
          if (inc.incident_type === 'manifestacion_comunidad') {
            setManifestacionComunidadActiva(inc.is_active);
            if (inc.is_active) setManifestacionComunidadPendiente(true);
          }
          if (inc.incident_type === 'demora_materiales') {
            setDemoraMaterialesActiva(inc.is_active);
            if (inc.is_active) setDemoraMaterialesPendiente(true);
          }
          if (inc.incident_type === 'accidente_obra') {
            setAccidenteObraActiva(inc.is_active);
            if (inc.is_active) setAccidenteObraPendiente(true);
          }
          if (inc.incident_type === 'lluvia_intensa') {
            setLluviaIntensaActiva(inc.is_active);
          }
          if (inc.incident_type === 'derrumbe') {
            setDerrumbeActivo(inc.is_active);
            if (inc.is_active) setDerrumbePendiente(true);
          }
        }
      }
    }

    loadFromSupabase();
    const interval = setInterval(loadFromSupabase, 5000);
    return () => clearInterval(interval);
  }, [currentUser, isSupervisor]);

  function pushNotif(icon: string, text: string) {
    const id = ++nidRef.current;
    setNotifs(p => [...p, { id, icon, text }]);
    setTimeout(() => setNotifs(p => p.filter(n => n.id !== id)), 8000);
  }

  function totalPagosGlobales() {
    return projectForm.pagosCols.reduce((sum, col) => sum + (Number(projectForm.pagosGlobales[col.id]) || 0), 0);
  }

  function totalAsignadoActividad(act: ActivityRow) {
    return projectForm.pagosCols.reduce((sum, col) => sum + (Number(act.pagos?.[col.id]) || 0), 0);
  }

  function totalAsignadoGeneral() {
    return projectForm.actividades.reduce((sum, act) => sum + totalAsignadoActividad(act), 0);
  }

  function totalActs() {
    return projectForm.actividades.reduce((sum, act) => sum + (Number(act.valor) || 0), 0);
  }

  function totalAsignadoPorColumna(colId: string) {
    return projectForm.actividades.reduce((sum, act) => sum + (Number(act.pagos?.[colId]) || 0), 0);
  }

  function syncLiveActsWithForm() {
  setLiveActs(prev =>
    projectForm.actividades.map(act => {
      const asignado = totalAsignadoActividad(act);
      const old = prev.find(p => p.id === act.id);
      return {
        ...act,
        asignado,
        avance: old?.avance ?? 0,
        invertido: old?.invertido ?? 0,
        activa: old?.activa ?? act.activa,
        baseWorkDay: old?.baseWorkDay ?? 0,
        baseInvertido: old?.baseInvertido ?? 0,
      };
    })
  );
}

  function resetGameState(showNotif = false) {
    startRef.current = Date.now();
    gameStartedAtRef.current = 0;
    suspendedTimeRef.current = 0;
    suspendStartRef.current = 0;
    accumulatedGameMsRef.current = 0;
    lastRealTickRef.current = Date.now();
    startRef.current = Date.now();
    initialContratoValorRef.current = null;
    initialContratoDuracionRef.current = null;
    cambiosContratoValorRef.current = 0;
    cambiosContratoDuracionRef.current = 0;

    setElapsed('00:00:00');
    setGameHourDisplay('Día 1 - 07:00');
    setWorkDays(0);
    setWorkTimeDisplay('Día 1 - 07:00');
    setStartTile(null);
    setRoadProgress(0);
    setProjectProgress(0);
    setScore(50);
    setLiveActs(
      projectForm.actividades.map(a => ({
        ...a,
        asignado: totalAsignadoActividad(a),
        avance: 0,
        invertido: 0,
      }))
    );
    setSuspended(false);
    setObraFinished(false);
    setRecursosAgotados(false);
    setGameStarted(false);
    setTimeScale(1);
    setManifestacionComunidadPendiente(false);
    setManifestacionComunidadResuelta(false);
    setDemoraMaterialesPendiente(false);
    setDemoraMaterialesResuelta(false);
    setAccidenteObraPendiente(false);
    setAccidenteObraResuelta(false);
    setDerrumbePendiente(false);
    setDerrumbeResuelto(false);
    if (showNotif) pushNotif('🔄', 'Proyecto reiniciado');
  }

  // ============ PERSISTENCIA EN SUPABASE ============

  async function saveGameState() {
    if (!currentUser || isSupervisor) return;

    // Calcular el tiempo de juego TOTAL incluyendo la sesión actual
    const currentGameMs = accumulatedGameMsRef.current + (Date.now() - lastRealTickRef.current) * 12 * timeScale;
    // Actualizar refs para que el juego siga correctamente
    accumulatedGameMsRef.current = currentGameMs;
    lastRealTickRef.current = Date.now();

    const state = {
      email: currentUser.email,
      projectForm,
      gameStarted,
      startTile,
      accumulatedGameMs: currentGameMs,
      roadProgress,
      projectProgress,
      workDays,
      score,
      suspended,
      obraFinished,
      recursosAgotados,
      timeScale,
      liveActs,
      suspendedTime: suspendedTimeRef.current,
      cambiosContratoValor: cambiosContratoValorRef.current,
      cambiosContratoDuracion: cambiosContratoDuracionRef.current,
      gameStartedAt: gameStartedAtRef.current,
      lastSavedAt: Date.now(),
    };
    await supabase
      .from('game_state')
      .update({ project_data: state, updated_at: new Date().toISOString() })
      .eq('user_id', currentUser.id);
  }

  function loadGameState(data: any) {
    if (!data) return;
    loadedRef.current = true;
    if (data.projectForm) setProjectForm(data.projectForm);
    if (data.gameStarted !== undefined) setGameStarted(data.gameStarted);
    if (data.startTile !== undefined) setStartTile(data.startTile);
    if (data.roadProgress !== undefined) setRoadProgress(data.roadProgress);
    if (data.projectProgress !== undefined) setProjectProgress(data.projectProgress);
    if (data.workDays !== undefined) setWorkDays(data.workDays);
    if (data.score !== undefined) setScore(data.score);
    if (data.suspended !== undefined) setSuspended(data.suspended);
    if (data.obraFinished !== undefined) setObraFinished(data.obraFinished);
    if (data.recursosAgotados !== undefined) setRecursosAgotados(data.recursosAgotados);
    if (data.timeScale !== undefined) setTimeScale(data.timeScale);
    if (data.liveActs) setLiveActs(data.liveActs);
    if (data.suspendedTime !== undefined) suspendedTimeRef.current = data.suspendedTime;
    if (data.cambiosContratoValor !== undefined) cambiosContratoValorRef.current = data.cambiosContratoValor;
    if (data.cambiosContratoDuracion !== undefined) cambiosContratoDuracionRef.current = data.cambiosContratoDuracion;
    if (data.gameStartedAt) gameStartedAtRef.current = data.gameStartedAt;

    // Calcular tiempo offline y avanzar el juego
    const savedMs = data.accumulatedGameMs || 0;
    if (data.lastSavedAt && data.gameStarted && !data.obraFinished) {
      const offlineRealMs = Date.now() - data.lastSavedAt;
      if (data.suspended || data.recursosAgotados) {
        // Juego estaba detenido: el tiempo offline se suma como tiempo suspendido
        suspendedTimeRef.current = (data.suspendedTime || 0) + offlineRealMs;
        accumulatedGameMsRef.current = savedMs + (offlineRealMs * 12);
      } else {
        // Juego estaba corriendo: avanzar normalmente (velocidad x1)
        accumulatedGameMsRef.current = savedMs + (offlineRealMs * 12);
      }
    } else {
      accumulatedGameMsRef.current = savedMs;
    }

    lastRealTickRef.current = Date.now();
    startRef.current = Date.now();
  }

  // Auto-guardar cada 10 segundos
  useEffect(() => {
    if (!currentUser || isSupervisor || !gameStarted) return;
    const interval = setInterval(saveGameState, 10000);
    return () => clearInterval(interval);
  }, [currentUser, isSupervisor, gameStarted, projectForm, roadProgress, score, workDays, liveActs, obraFinished, suspended]);

  // ============ FIN PERSISTENCIA ============

  function toggleSuspend() {
  if (!gameStarted || obraFinished) return;

  if (suspended) {
    suspendedTimeRef.current += Date.now() - suspendStartRef.current;
    setSuspended(false);
    pushNotif('▶️', 'Trabajos reanudados');
  } else {
    suspendStartRef.current = Date.now();
    setSuspended(true);
    pushNotif('⏸️', 'Trabajos suspendidos');
  }
}

function changeTimeScale(newScale: number) {
  const now = Date.now();
  const realDelta = now - lastRealTickRef.current;

  accumulatedGameMsRef.current += realDelta * 12 * timeScale;
  lastRealTickRef.current = now;

  setTimeScale(newScale);
}

function resolverManifestacionComunidad() {
  if (!manifestacionComunidadPendiente) return;

  if (suspended) {
    suspendedTimeRef.current += Date.now() - suspendStartRef.current;
  }

  setManifestacionComunidadPendiente(false);
  setManifestacionComunidadResuelta(true);
  setManifestacionComunidadActiva(false);
  setSuspended(false);
  pushNotif('🤝', 'Manifestación de la comunidad solucionada.');

  if (currentUser) {
    supabase.from('game_incidents')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', currentUser.id)
      .eq('incident_type', 'manifestacion_comunidad')
      .then();
  }
}
  function resolverDemoraMateriales() {
    if (!demoraMaterialesPendiente) return;

    if (suspended) {
      suspendedTimeRef.current += Date.now() - suspendStartRef.current;
    }

    setDemoraMaterialesPendiente(false);
    setDemoraMaterialesResuelta(true);
    setDemoraMaterialesActiva(false);
    setSuspended(false);
    pushNotif('📦', 'Demora en los materiales solucionada.');

    if (currentUser) {
      supabase.from('game_incidents')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .eq('incident_type', 'demora_materiales')
        .then();
    }
  }

  function resolverAccidenteObra() {
    if (!accidenteObraPendiente) return;

    if (suspended) {
      suspendedTimeRef.current += Date.now() - suspendStartRef.current;
    }

    setAccidenteObraPendiente(false);
    setAccidenteObraResuelta(true);
    setAccidenteObraActiva(false);
    setSuspended(false);
    pushNotif('🚑', 'Accidente en la obra solucionado.');

    if (currentUser) {
      supabase.from('game_incidents')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id)
        .eq('incident_type', 'accidente_obra')
        .then();
    }
  }

  function resolverDerrumbe() {
    return;
  }

  useEffect(() => {
    if (gameStarted) {
      // Solo actualizar asignado, NUNCA tocar avance/invertido
      setLiveActs(prev =>
        prev.map(act => {
          const formAct = projectForm.actividades.find(a => a.id === act.id);
          if (!formAct) return act;
          const asignado = projectForm.pagosCols.reduce((sum, col) => sum + (Number(formAct.pagos?.[col.id]) || 0), 0);
          return { ...act, asignado };
        })
      );
      return;
    }
    syncLiveActsWithForm();
  }, [projectForm.actividades, projectForm.pagosCols, projectForm.pagosGlobales]);
  
  useEffect(() => {
    fondoAudioRef.current = new Audio('/sonidos/fondo.mp3');
    fondoAudioRef.current.loop = true;
    fondoAudioRef.current.volume = 0.3;

    ambienteAudioRef.current = new Audio('/sonidos/ambiente_.mp3');
    ambienteAudioRef.current.loop = true;
    ambienteAudioRef.current.volume = 0.35;

    enObraAudioRef.current = new Audio('/sonidos/en obra.mp3');
    enObraAudioRef.current.loop = true;
    enObraAudioRef.current.volume = 0.35;

    nocheAudioRef.current = new Audio('/sonidos/noche.mp3');
    nocheAudioRef.current.loop = true;
    nocheAudioRef.current.volume = 0.35;

    lluviaAudioRef.current = new Audio('/sonidos/lluvia.mp3');
    lluviaAudioRef.current.loop = true;
    lluviaAudioRef.current.volume = 0.35;

    return () => {
      fondoAudioRef.current?.pause();
      fondoAudioRef.current = null;
      ambienteAudioRef.current?.pause();
      ambienteAudioRef.current = null;
      enObraAudioRef.current?.pause();
      enObraAudioRef.current = null;
      nocheAudioRef.current?.pause();
      nocheAudioRef.current = null;
      lluviaAudioRef.current?.pause();
      lluviaAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!fondoAudioRef.current) return;

    if (view === 'setup') {
      fondoAudioRef.current.currentTime = 0;
      fondoAudioRef.current.play().catch(() => {});
    } else {
      fondoAudioRef.current.pause();
      fondoAudioRef.current.currentTime = 0;
    }
  }, [view]);

  useEffect(() => {
    if (!ambienteAudioRef.current) return;

    if (
      view === 'game' &&
      isDaytime &&
      !obraFinished &&
      !lluviaIntensaActiva &&
      (!startTile || suspended || derrumbePendiente)
    ) {
      ambienteAudioRef.current.play().catch(() => {});
    } else {
      ambienteAudioRef.current.pause();
      ambienteAudioRef.current.currentTime = 0;
    }
  }, [view, isDaytime, obraFinished, lluviaIntensaActiva, startTile, suspended, derrumbePendiente]);

  useEffect(() => {
    if (!enObraAudioRef.current) return;

    if (
      view === 'game' &&
      isDaytime &&
      !!startTile &&
      !suspended &&
      !obraFinished &&
      !recursosAgotados &&
      !lluviaIntensaActiva
    ) {
      enObraAudioRef.current.play().catch(() => {});
    } else {
      enObraAudioRef.current.pause();
      enObraAudioRef.current.currentTime = 0;
    }
  }, [view, isDaytime, startTile, suspended, obraFinished, recursosAgotados, lluviaIntensaActiva]);
  
  useEffect(() => {
    if (!nocheAudioRef.current) return;

    if (
      view === 'game' &&
      !isDaytime &&
      !obraFinished &&
      !lluviaIntensaActiva
    ) {
      nocheAudioRef.current.play().catch(() => {});
    } else {
      nocheAudioRef.current.pause();
      nocheAudioRef.current.currentTime = 0;
    }
  }, [view, isDaytime, obraFinished, lluviaIntensaActiva]);
  
  useEffect(() => {
    if (!lluviaAudioRef.current) return;

    if (
      view === 'game' &&
      lluviaIntensaActiva &&
      suspended &&
      !obraFinished
    ) {
      lluviaAudioRef.current.play().catch(() => {});
    } else {
      lluviaAudioRef.current.pause();
      lluviaAudioRef.current.currentTime = 0;
    }
  }, [view, lluviaIntensaActiva, suspended, obraFinished]);
  
  useEffect(() => {
    if (view !== 'game') return;
    if (!manifestacionComunidadPendiente || manifestacionComunidadResuelta) return;
    if (suspended) return;

    suspendStartRef.current = Date.now();
    setSuspended(true);
    pushNotif('🚧', 'La obra fue suspendida por manifestación de la comunidad.');
  }, [view, manifestacionComunidadPendiente, manifestacionComunidadResuelta, suspended]);

  useEffect(() => {
    if (view !== 'game') return;
    if (!demoraMaterialesPendiente || demoraMaterialesResuelta) return;
    if (suspended) return;

    suspendStartRef.current = Date.now();
    setSuspended(true);
    pushNotif('📦', 'La obra fue suspendida por demora en los materiales.');
  }, [view, demoraMaterialesPendiente, demoraMaterialesResuelta, suspended]);

  useEffect(() => {
    if (view !== 'game') return;
    if (!accidenteObraPendiente || accidenteObraResuelta) return;
    if (suspended) return;

    suspendStartRef.current = Date.now();
    setSuspended(true);
    pushNotif('🚑', 'La obra fue suspendida por accidente en la obra.');
  }, [view, accidenteObraPendiente, accidenteObraResuelta, suspended]);

  useEffect(() => {
    if (view !== 'game') return;
    if (!derrumbePendiente) return;
    if (suspended) return;

    suspendStartRef.current = Date.now();
    setSuspended(true);
    pushNotif('⛰️', 'Hay un derrumbre que impide la ejecucion de los tabajos hable con el supervisor');
  }, [view, derrumbePendiente, suspended]);
  useEffect(() => {
    if (view !== 'game') return;
    if (!lluviaIntensaActiva) return;
    if (suspended) return;

    suspendStartRef.current = Date.now();
    setSuspended(true);
    pushNotif('🌧️', 'La intensidad del invierno impide continuar con los trabajos.');
  }, [view, lluviaIntensaActiva, suspended]);

  useEffect(() => {
    if (view !== 'game') return;
    if (!suspended) return;
    if (lluviaIntensaActiva) return;
    if (manifestacionComunidadPendiente || demoraMaterialesPendiente || accidenteObraPendiente || derrumbePendiente) return;

    if (suspendStartRef.current) {
      suspendedTimeRef.current += Date.now() - suspendStartRef.current;
      suspendStartRef.current = 0;
    }

    setSuspended(false);
    pushNotif('▶️', 'Obra reanudada.');
  }, [view, suspended, lluviaIntensaActiva, manifestacionComunidadPendiente, demoraMaterialesPendiente, accidenteObraPendiente, derrumbePendiente]);
  
  useEffect(() => {
    if (!manifestacionComunidadResuelta) return;

    const timeout = setTimeout(() => {
      setManifestacionComunidadResuelta(false);
    }, 30000);

    return () => clearTimeout(timeout);
  }, [manifestacionComunidadResuelta]);

  useEffect(() => {
    if (!demoraMaterialesResuelta) return;

    const timeout = setTimeout(() => {
      setDemoraMaterialesResuelta(false);
    }, 30000);

    return () => clearTimeout(timeout);
  }, [demoraMaterialesResuelta]);

  useEffect(() => {
    if (!accidenteObraResuelta) return;

    const timeout = setTimeout(() => {
      setAccidenteObraResuelta(false);
    }, 30000);

    return () => clearTimeout(timeout);
  }, [accidenteObraResuelta]);

  useEffect(() => {
    if (!derrumbeResuelto) return;

    const timeout = setTimeout(() => {
      setDerrumbeResuelto(false);
    }, 30000);

    return () => clearTimeout(timeout);
  }, [derrumbeResuelto]);

  useEffect(() => {
    if (gameStarted || obraFinished) return;
    syncLiveActsWithForm();
  }, [projectForm.actividades, projectForm.pagosCols, projectForm.pagosGlobales, gameStarted, obraFinished]);
  useEffect(() => {
    if (gameStarted && recursosAgotados) {
      const nuevoTotalPagos = totalPagosGlobales();
      const nuevoTotalAsignado = totalAsignadoGeneral();
      const maxDisponible = Math.min(nuevoTotalPagos, nuevoTotalAsignado);
      const totalInvertidoActual = liveActs.reduce((sum, act) => sum + act.invertido, 0);

      if (maxDisponible > totalInvertidoActual) {
        if (suspendStartRef.current) {
          suspendedTimeRef.current += Date.now() - suspendStartRef.current;
          suspendStartRef.current = 0;
        }

        setLiveActs(prev =>
          prev.map(act => {
            const formAct = projectForm.actividades.find(a => a.id === act.id);
            const nuevoAsignado = formAct
              ? projectForm.pagosCols.reduce((sum, col) => sum + (Number(formAct.pagos?.[col.id]) || 0), 0)
              : act.asignado;
            return {
              ...act,
              asignado: nuevoAsignado,
              baseWorkDay: Number(act.invertido) < nuevoAsignado ? workDays : act.baseWorkDay,
              baseInvertido: Number(act.invertido) < nuevoAsignado ? act.invertido : act.baseInvertido,
            };
          })
        );

        setRecursosAgotados(false);
        pushNotif('💵', 'Ingresaron nuevos recursos. La obra continúa.');
      }
    }
  }, [projectForm.pagosGlobales, projectForm.actividades]);
  
  useEffect(() => {
    if (view !== 'game') return;

    const iv = setInterval(() => {
      if (!gameStarted || !startTile || obraFinished) return;

      const realEl = gameStartedAtRef.current > 0 ? Date.now() - gameStartedAtRef.current : 0;
      const eh = Math.floor(realEl / 3600000);
      const em = Math.floor((realEl % 3600000) / 60000);
      const es = Math.floor((realEl % 60000) / 1000);
      setElapsed(`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:${String(es).padStart(2,'0')}`);

      const realDelta = Date.now() - lastRealTickRef.current;
      const gameMs = accumulatedGameMsRef.current + realDelta * 12 * timeScale;
      const gameTotalHours = gameMs / 3600000 + 7;
      const gDay = Math.floor(gameTotalHours / 24) + 1;
      const gHour = Math.floor(gameTotalHours % 24);
      const gMin = Math.floor(((gameTotalHours % 1) * 60) % 60);
      setGameHourDisplay(`Día ${gDay} - ${String(gHour).padStart(2,'0')}:${String(gMin).padStart(2,'0')}`);

      const daytime = gHour >= 7 && gHour < 18;
      setIsDaytime(daytime);
      setIsNight(!daytime);

      let op = 0;
      if (gHour >= 17 && gHour < 18) op = ((gHour - 17) + gMin / 60) * 0.55;
      else if (gHour >= 18 || gHour < 6) op = 0.55;
      else if (gHour >= 6 && gHour < 7) op = (1 - (gHour - 6 + gMin / 60)) * 0.55;
      setNightOpacity(op);

      const obraDetenida = suspended || recursosAgotados || obraFinished;

      const suspTime = obraDetenida
        ? (Date.now() - suspendStartRef.current + suspendedTimeRef.current)
        : suspendedTimeRef.current;

      const totalGameDays = gameMs / 3600000 / 24;
      const suspGameDays = (suspTime * 12 * timeScale) / 3600000 / 24;
      const effWorkDays = Math.max(0, totalGameDays - suspGameDays);

      const workTotalHours = effWorkDays * 24 + 7;
      const workDay = Math.floor(workTotalHours / 24) + 1;
      const workHour = Math.floor(workTotalHours % 24);
      const workMin = Math.floor(((workTotalHours % 1) * 60) % 60);
      setWorkDays(effWorkDays);
      setWorkTimeDisplay(`Día ${workDay} - ${String(workHour).padStart(2,'0')}:${String(workMin).padStart(2,'0')}`);

      const diferenciaTiempoPct = gameTotalHours > 0
        ? (Math.abs(gameTotalHours - workTotalHours) / gameTotalHours) * 100
        : 0;

      const descuentoTiempo = Math.max(0, Math.floor(diferenciaTiempoPct) - 60);
      const descuentoCambiosValor = Math.max(0, cambiosContratoValorRef.current - 1) * 5;
      const descuentoCambiosDuracion = Math.max(0, cambiosContratoDuracionRef.current - 1) * 5;
      const nuevoPuntaje = Math.max(35, 50 - descuentoTiempo - descuentoCambiosValor - descuentoCambiosDuracion);

      setScore(nuevoPuntaje);

      const totalPagos = totalPagosGlobales();
      const totalAsignado = totalAsignadoGeneral();
      const topeGlobalDisponible = Math.min(totalPagos, totalAsignado);
      const contratoTotal = Number(projectForm.contratoValor) || 0;

      setLiveActs(prev => {
        let totalSpent = 0;

        const updated = prev.map(act => {
          const dur = Number(act.duracion) || 0;
          const valorAct = Number(act.valor) || 0;
          const asignado = Number(act.asignado) || 0;

          if (!act.nombre || dur <= 0 || valorAct <= 0 || asignado <= 0 || !act.activa) {
            totalSpent += Number(act.invertido) || 0;
            return {
              ...act,
              avance: act.avance,
              invertido: act.invertido,
            };
          }

          const valorDiaActividad = valorAct / dur;
          const diasNuevos = Math.max(0, effWorkDays - (act.baseWorkDay || 0));
          const invertidoBase = Number(act.baseInvertido) || 0;

          let newInvertido = Math.min(
            asignado,
            invertidoBase + (valorDiaActividad * diasNuevos)
          );
          let newAvance = Math.min(100, (newInvertido / valorAct) * 100);

          totalSpent += newInvertido;

          return {
            ...act,
            avance: Number(newAvance.toFixed(1)),
            invertido: Math.round(newInvertido),
          };
        });

        if (totalSpent > topeGlobalDisponible) {
          const exceso = totalSpent - topeGlobalDisponible;
          let faltante = exceso;

          for (let i = updated.length - 1; i >= 0; i--) {
            if (faltante <= 0) break;
            const actual = updated[i];
            if (actual.invertido <= 0) continue;

            const descuento = Math.min(actual.invertido, faltante);
            const invertidoAjustado = actual.invertido - descuento;
            const valorAct = Number(actual.valor) || 0;
            const avanceAjustado = valorAct > 0 ? Math.min(100, (invertidoAjustado / valorAct) * 100) : 0;

            updated[i] = {
              ...actual,
              invertido: Math.round(invertidoAjustado),
              avance: Number(avanceAjustado.toFixed(1)),
            };

            faltante -= descuento;
          }

          totalSpent = topeGlobalDisponible;
        }

        const avanceGeneral = contratoTotal > 0 ? Math.min(100, (totalSpent / contratoTotal) * 100) : 0;

        const actividadesDelProyecto = updated.filter(a => a.nombre && Number(a.valor) > 0);
        const obraTerminadaAhora =
          actividadesDelProyecto.length > 0 &&
          actividadesDelProyecto.every(a => a.avance >= 100);

        if (obraTerminadaAhora) {
          setProjectProgress(100);
          setRoadProgress(100);
          setRecursosAgotados(false);

          if (!obraFinished) {
            accumulatedGameMsRef.current = gameMs;
            lastRealTickRef.current = Date.now();
            if (suspendStartRef.current) {
              suspendedTimeRef.current += Date.now() - suspendStartRef.current;
              suspendStartRef.current = 0;
            }
            setSuspended(true);
            setObraFinished(true);
            pushNotif('🎉', '¡Obra terminada!');
          }
        } else {
          setProjectProgress(avanceGeneral);
          setRoadProgress(avanceGeneral);

          if (topeGlobalDisponible > 0 && totalSpent >= topeGlobalDisponible && !recursosAgotados) {
            suspendStartRef.current = Date.now();
            setRecursosAgotados(true);
            pushNotif('💰', 'Recursos agotados. La obra se detiene.');
          }
        }
        return updated;
      });
    }, 500);

    return () => clearInterval(iv);
  }, [
    view,
    suspended,
    obraFinished,
    recursosAgotados,
    gameStarted,
    startTile,
    projectForm.contratoValor,
    projectForm.actividades,
    projectForm.pagosCols,
    projectForm.pagosGlobales,
    timeScale,
  ]);

  useEffect(() => {
    if (view !== 'game') return;

    const t1 = setTimeout(() => pushNotif('🏗️', `Bienvenido a ${projectForm.proyectoNombre || 'Proyecto'}`), 1500);
    const t2 = setTimeout(() => {
      if (!gameStarted) pushNotif('📍', 'Haz clic en cualquier cuadro gris de la vía para iniciar');
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [view, gameStarted, projectForm.proyectoNombre]);

  const handleTileClick = useCallback((r: number, c: number) => {
    if (!startTile && !obraFinished) {
      setStartTile({ r, c });
      setGameStarted(true);
      pushNotif('🚧', 'Punto de inicio seleccionado. ¡Obra en marcha!');
    }
  }, [startTile, obraFinished]);

  function toggleAct(id: number) {
    if (obraFinished) return;
    setLiveActs(p => p.map(a => a.id === id ? { ...a, activa: !a.activa } : a));
  }

   function updateField(f: string, v: string) {
    setProjectForm(p => ({ ...p, [f]: v }));
  }

  function updateAct(id: number, f: string, v: string) {
    setProjectForm(p => ({
      ...p,
      actividades: p.actividades.map(a => {
        if (a.id !== id) return a;
        const updated = { ...a, [f]: v };
        return {
          ...updated,
          asignado: p.pagosCols.reduce((sum, col) => sum + (Number(updated.pagos?.[col.id]) || 0), 0),
        };
      })
    }));
  }

  function updatePagoGlobal(pagoId: string, v: string) {
    const nuevoValor = Number(v) || 0;

    setProjectForm(p => {
      const contratoValor = Number(p.contratoValor) || 0;

      const totalOtrosPagos = p.pagosCols.reduce((sum, col) => {
        if (col.id === pagoId) return sum;
        return sum + (Number(p.pagosGlobales[col.id]) || 0);
      }, 0);

      const maxDisponible = Math.max(0, contratoValor - totalOtrosPagos);
      const valorFinal = Math.min(nuevoValor, maxDisponible);

      return {
        ...p,
        pagosGlobales: {
          ...p.pagosGlobales,
          [pagoId]: valorFinal,
        }
      };
    });
  }

  function updatePagoActividad(id: number, pagoId: string, v: string) {
    const nuevoValor = Number(v) || 0;

    setProjectForm(p => {
      const actividadActual = p.actividades.find(a => a.id === id);
      if (!actividadActual) return p;

      const valorActividad = Number(actividadActual.valor) || 0;

      const totalOtrasActividades = p.actividades.reduce((sum, act) => {
        if (act.id === id) return sum;
        return sum + (Number(act.pagos?.[pagoId]) || 0);
      }, 0);

      const totalOtrasColumnasMismaActividad = p.pagosCols.reduce((sum, col) => {
        if (col.id === pagoId) return sum;
        return sum + (Number(actividadActual.pagos?.[col.id]) || 0);
      }, 0);

      const disponibleColumna = Math.max(0, (Number(p.pagosGlobales[pagoId]) || 0) - totalOtrasActividades);
      const disponibleActividad = Math.max(0, valorActividad - totalOtrasColumnasMismaActividad);
      const valorFinal = Math.min(nuevoValor, disponibleColumna, disponibleActividad);

      return {
        ...p,
        actividades: p.actividades.map(a => {
          if (a.id !== id) return a;
          const pagos = { ...a.pagos, [pagoId]: valorFinal };
          const asignado = p.pagosCols.reduce((sum, col) => sum + (Number(pagos[col.id]) || 0), 0);
          return { ...a, pagos, asignado };
        })
      };
    });
  }

  function addAct() {
    setProjectForm(p => ({
      ...p,
      actividades: [
        ...p.actividades,
        {
          id: Date.now(),
          nombre: '',
          valor: '',
          duracion: '',
          asignado: 0,
          activa: true,
          avance: 0,
          invertido: 0,
          pagos: Object.fromEntries(p.pagosCols.map(col => [col.id, 0])),
        }
      ]
    }));
  }

   function addPago() {
    setProjectForm(p => {
      const pagosExistentes = p.pagosCols.filter(col => col.id !== 'anticipo').length;
      const nuevoId = `pago_${Date.now()}`;
      const nuevaCol: PaymentColumn = { id: nuevoId, label: `PAGO ${pagosExistentes + 1}` };

      return {
        ...p,
        pagosCols: [...p.pagosCols, nuevaCol],
        pagosGlobales: { ...p.pagosGlobales, [nuevoId]: 0 },
        actividades: p.actividades.map(a => ({
          ...a,
          pagos: { ...a.pagos, [nuevoId]: 0 },
        })),
      };
    });
  }

  function removePago(pagoId: string) {
    if (pagoId === 'anticipo') return;

    setProjectForm(p => ({
      ...p,
      pagosCols: p.pagosCols.filter(col => col.id !== pagoId),
      pagosGlobales: Object.fromEntries(
        Object.entries(p.pagosGlobales).filter(([key]) => key !== pagoId)
      ),
      actividades: p.actividades.map(a => ({
        ...a,
        pagos: Object.fromEntries(
          Object.entries(a.pagos || {}).filter(([key]) => key !== pagoId)
        ),
      })),
    }));
  }

  function removeAct(id: number) {
    setProjectForm(p => ({
      ...p,
      actividades: p.actividades.length === 1 ? p.actividades : p.actividades.filter(a => a.id !== id)
    }));
  }

  const contratoVal = Number(projectForm.contratoValor) || 0;
  const totalActVal = totalActs();
  const actividadesOk = contratoVal > 0 && totalActVal === contratoVal;
  const totalPagos = totalPagosGlobales();
  const asigTotal = totalAsignadoGeneral();
  const hayActividadesConRecursos = projectForm.actividades.some(a => Number(a.asignado) > 0);
  const canStart = actividadesOk && !!projectForm.proyectoNombre && !!projectForm.contratistaNombre && totalPagos > 0 && hayActividadesConRecursos;

  if (view === 'login') {
    return (
      <LoginScreen onLogin={async (user, role) => {
        setCurrentUser(user);
        setCurrentRole(role);
        if (user.email === 'supervisor@constructor.co') {
          setView('supervisor');
        } else {
          // Cargar estado guardado
          const { data: stateRow } = await supabase
            .from('game_state')
            .select('project_data, is_reset')
            .eq('user_id', user.id)
            .maybeSingle();

          if (stateRow?.is_reset) {
            // El supervisor reinició este grupo — empezar de cero
            resetGameState(false);
            setProjectForm(INITIAL_FORM);
            await supabase
              .from('game_state')
              .update({ is_reset: false, updated_at: new Date().toISOString() })
              .eq('user_id', user.id);
          } else if (stateRow?.project_data && stateRow.project_data.gameStarted !== undefined) {
            loadGameState(stateRow.project_data);
          }
          setView('setup');
        }
      }} />
    );
  }

  if (view === 'supervisor') {
    return (
      <SupervisorDashboard
        currentUser={currentUser}
        onLogout={async () => {
          await supabase.auth.signOut();
          setCurrentUser(null);
          setCurrentRole('player');
          setView('login');
        }}
        onViewGame={async (player) => {
          setViewingAsPlayer(player);
          // Limpiar estado anterior
          resetGameState(false);
          setProjectForm(INITIAL_FORM);
          // Cargar el estado del juego de este grupo
          const { data: stateRow } = await supabase
            .from('game_state')
            .select('project_data')
            .eq('user_id', player.id)
            .maybeSingle();
          if (stateRow?.project_data && stateRow.project_data.gameStarted !== undefined) {
            loadGameState(stateRow.project_data);
            setView('game');
          } else if (stateRow?.project_data?.projectForm) {
            loadGameState(stateRow.project_data);
            setView('setup');
          } else {
            setView('setup');
          }
        }}
      />
    );
  }

  if (view === 'setup') {
    return (
      <div
        onMouseDown={() => {
          if (view === 'setup' && fondoAudioRef.current) {
            fondoAudioRef.current.play().catch(() => {});
          }
        }}
        style={{ minHeight:'100vh', maxHeight:'100vh', overflowY:'auto', background:'#0f172a', color:'#e5e7eb', padding:'32px', fontFamily:'Inter,system-ui,sans-serif', boxSizing:'border-box' }}
      >
        <div style={{ maxWidth:'1250px', margin:'0 auto', background:'#111827', border:'1px solid #334155', borderRadius:'18px', padding:'28px', boxShadow:'0 10px 30px rgba(0,0,0,0.25)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:'20px', alignItems:'center', marginBottom:'24px', flexWrap:'wrap' }}>
            <div>
              <h1 style={{ margin:0, fontSize:'28px' }}>Configuración inicial del proyecto</h1>
              <p style={{ margin:'8px 0 0 0', color:'#94a3b8' }}>Registra la información base antes de entrar al juego.</p>
              {isSupervisor && viewingAsPlayer && (
                <p style={{ margin:'4px 0 0 0', color:'#facc15', fontSize:'13px', fontWeight:700 }}>
                  Viendo partida de: {viewingAsPlayer.email.split('@')[0].toUpperCase()}
                </p>
              )}
            </div>

            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'flex-end', alignItems:'flex-end', flexDirection:'column' }}>
              {isSupervisor && viewingAsPlayer && (
                <button
                  onClick={() => { setViewingAsPlayer(null); setView('supervisor'); }}
                  style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'15px' }}
                >
                  ← Volver al panel
                </button>
              )}
              <button
                onClick={() => {
                  if (canStart && !gameStarted) {
                    setSuspended(false);
                    setObraFinished(false);
                    setRecursosAgotados(false);
                    setStartTile(null);
                    setRoadProgress(0);
                    setProjectProgress(0);
                    suspendedTimeRef.current = 0;
                    suspendStartRef.current = 0;
                    accumulatedGameMsRef.current = 0;
                    lastRealTickRef.current = Date.now();
                    startRef.current = Date.now();
                    gameStartedAtRef.current = Date.now();
                    setElapsed('00:00:00');
                    setGameHourDisplay('Día 1 - 07:00');
                    setWorkDays(0);
                    setWorkTimeDisplay('Día 1 - 07:00');

                    setLiveActs(projectForm.actividades.map(a => ({
                      ...a,
                      asignado: totalAsignadoActividad(a),
                      avance: 0,
                      invertido: 0,
                    })));

                    setManifestacionComunidadPendiente(manifestacionComunidadActiva);
                    setManifestacionComunidadResuelta(false);
                    setDemoraMaterialesPendiente(demoraMaterialesActiva);
                    setDemoraMaterialesResuelta(false);
                    setAccidenteObraPendiente(accidenteObraActiva);
                    setAccidenteObraResuelta(false);
                    setDerrumbePendiente(derrumbeActivo);
                    setDerrumbeResuelto(false);
                    initialContratoValorRef.current = projectForm.contratoValor;
                    initialContratoDuracionRef.current = projectForm.contratoDuracion;
                    setView('game');
                  }
                }}
                disabled={!canStart || gameStarted}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:(canStart && !gameStarted)?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:(canStart && !gameStarted)?'pointer':'not-allowed', fontSize:'15px', opacity:(canStart && !gameStarted)?1:0.5 }}
              >
                Iniciar proyecto
              </button>

              {!gameStarted && !hayActividadesConRecursos && (
                <div style={{ fontSize:'11px', color:'#fca5a5', maxWidth:'280px', textAlign:'right' }}>
                  Debes asignar recursos a por lo menos una actividad antes de iniciar la obra.
                </div>
              )}

              <button
                onClick={() => {
                  if (!gameStarted) return;

                  if (
                    initialContratoValorRef.current !== null &&
                    projectForm.contratoValor !== initialContratoValorRef.current
                  ) {
                    cambiosContratoValorRef.current += 1;
                    initialContratoValorRef.current = projectForm.contratoValor;
                  }

                  if (
                    initialContratoDuracionRef.current !== null &&
                    projectForm.contratoDuracion !== initialContratoDuracionRef.current
                  ) {
                    cambiosContratoDuracionRef.current += 1;
                    initialContratoDuracionRef.current = projectForm.contratoDuracion;
                  }

                  setView('game');
                }}
                disabled={!gameStarted}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:gameStarted?'#0f766e':'#334155', color:'#fff', fontWeight:700, cursor:gameStarted?'pointer':'not-allowed', fontSize:'15px', opacity:gameStarted?1:0.5 }}
              >
                Regresar a la obra
              </button>

              {isSupervisor && (
              <button
                onClick={toggleSuspend}
                disabled={!gameStarted || obraFinished}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:(!gameStarted || obraFinished)?'#334155':(suspended?'#16a34a':'#dc2626'), color:'#fff', fontWeight:700, cursor:(!gameStarted || obraFinished)?'not-allowed':'pointer', fontSize:'15px', opacity:(!gameStarted || obraFinished)?0.5:1 }}
              >
                {suspended ? 'Reanudar' : 'Suspender'}
              </button>
              )}

              {isSupervisor && (
              <button
                onClick={() => resetGameState(true)}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:'#475569', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'15px' }}
              >
                Reiniciar
              </button>
              )}

              <button
                onClick={async () => { await saveGameState(); await supabase.auth.signOut(); setCurrentUser(null); setCurrentRole('player'); setView('login'); }}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:'#dc2626', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'15px' }}
              >
                Guardar y salir
              </button>
            </div>
          </div>

          {!actividadesOk && contratoVal > 0 && (
            <div style={{ marginBottom:'16px', fontSize:'11px', color:'#ef4444', textAlign:'right' }}>
              {totalActVal > contratoVal
                ? `Excede por $${(totalActVal - contratoVal).toLocaleString('es-CO')}`
                : `Faltan $${(contratoVal - totalActVal).toLocaleString('es-CO')}`}
            </div>
          )}

          <div style={{ ...SS, marginBottom:'20px' }}>
            <h2 style={{ marginTop:0 }}>Nombre del proyecto</h2>
            <input value={projectForm.proyectoNombre} onChange={e => updateField('proyectoNombre', e.target.value)} placeholder="Ej: Corredor Andino Norte - 42 km" style={IS} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
            <div style={SS}>
              <h2 style={{ marginTop:0 }}>Contratista</h2>
              <label style={{ display:'block', marginBottom:'8px', color:'#94a3b8' }}>Nombre</label>
              <input value={projectForm.contratistaNombre} onChange={e => updateField('contratistaNombre', e.target.value)} style={IS} />
              <label style={{ display:'block', marginBottom:'8px', marginTop:'12px', color:'#94a3b8' }}>Valor del contrato</label>
              <input value={projectForm.contratoValor} onChange={e => updateField('contratoValor', e.target.value)} style={IS} />
              <label style={{ display:'block', marginBottom:'8px', marginTop:'12px', color:'#94a3b8' }}>Duración (días)</label>
              <input value={projectForm.contratoDuracion} onChange={e => updateField('contratoDuracion', e.target.value)} style={IS} />
            </div>

            <div style={SS}>
              <h2 style={{ marginTop:0 }}>Interventoría</h2>
              <label style={{ display:'block', marginBottom:'8px', color:'#94a3b8' }}>Nombre</label>
              <input value={projectForm.interventoriaNombre} onChange={e => updateField('interventoriaNombre', e.target.value)} style={IS} />
              <label style={{ display:'block', marginBottom:'8px', marginTop:'12px', color:'#94a3b8' }}>Valor</label>
              <input value={projectForm.interventoriaValor} onChange={e => updateField('interventoriaValor', e.target.value)} style={IS} />
            </div>
          </div>

          <div style={{ ...SS, marginTop:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'12px' }}>
              <h2 style={{ margin:0 }}>Actividades</h2>
              <button onClick={addAct} style={BS}>+ Agregar</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 50px', gap:'10px', marginBottom:'10px', color:'#94a3b8', fontWeight:700, fontSize:'13px' }}>
              <div>Actividad</div><div>Valor</div><div>Duración (días)</div><div></div>
            </div>

            {projectForm.actividades.map(act => (
              <div key={act.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 50px', gap:'10px', marginBottom:'8px' }}>
                <input value={act.nombre} onChange={e => updateAct(act.id, 'nombre', e.target.value)} placeholder="Nombre" style={IS} />
                <input value={act.valor} onChange={e => updateAct(act.id, 'valor', e.target.value)} placeholder="0" style={IS} />
                <input value={act.duracion} onChange={e => updateAct(act.id, 'duracion', e.target.value)} placeholder="0" style={IS} />
                <button onClick={() => removeAct(act.id)} disabled={projectForm.actividades.length === 1} style={{ ...BS, border:'1px solid #7f1d1d', background:projectForm.actividades.length === 1 ? '#3f3f46' : '#3f1111', opacity:projectForm.actividades.length === 1 ? 0.5 : 1, padding:'8px' }}>✕</button>
              </div>
            ))}

            <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid #334155', display:'flex', justifyContent:'space-between', fontWeight:700 }}>
              <span>Total actividades</span>
              <span style={{ color:actividadesOk?'#4ade80':totalActVal>contratoVal?'#ef4444':'#facc15' }}>
                ${totalActVal.toLocaleString('es-CO')} {contratoVal>0 && <span style={{ fontWeight:400, color:'#64748b' }}>/ ${contratoVal.toLocaleString('es-CO')}</span>}
              </span>
            </div>

            {contratoVal > 0 && !actividadesOk && (
              <div style={{ marginTop:'8px', padding:'8px 12px', borderRadius:'8px', background:totalActVal>contratoVal?'#3f1111':'#1e3a5f', fontSize:'12px', color:totalActVal>contratoVal?'#fca5a5':'#93c5fd' }}>
                {totalActVal > contratoVal
                  ? `⚠ Excede el contrato por $${(totalActVal - contratoVal).toLocaleString('es-CO')}`
                  : `ℹ Falta $${(contratoVal - totalActVal).toLocaleString('es-CO')} para completar el contrato`}
              </div>
            )}

            {actividadesOk && <div style={{ marginTop:'8px', padding:'8px 12px', borderRadius:'8px', background:'#0a2e1a', fontSize:'12px', color:'#4ade80' }}>✓ Actividades = valor del contrato</div>}
          </div>

          {isSupervisor && (<>
          <div style={{ ...SS, marginTop:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'12px' }}>
              <h2 style={{ marginTop:0, marginBottom:0 }}>CREAR PAGOS</h2>
              <button onClick={addPago} style={BS}>+ Crear pago</button>
            </div>
            <div style={{ overflowX:'auto', marginBottom:'18px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'760px' }}>
                <thead>
                  <tr style={{ color:'#e5e7eb', fontWeight:700, fontSize:'13px' }}>
                    <th style={{ textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #334155' }}></th>
                    {projectForm.pagosCols.map(col => (
                      <th key={col.id} style={{ textAlign:'center', padding:'8px 10px', borderBottom:'1px solid #334155' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                          <span>{col.label}</span>
                          {col.id !== 'anticipo' && (
                            <button
                              onClick={() => removePago(col.id)}
                              style={{ border:'none', background:'transparent', color:'#fca5a5', cursor:'pointer', fontWeight:700, fontSize:'12px', padding:0 }}
                              title="Eliminar pago"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th style={{ textAlign:'center', padding:'8px 10px', borderBottom:'1px solid #334155' }}>TOTAL PAGOS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #1e293b', color:'#e5e7eb', fontWeight:700 }}>
                      PAGOS
                    </td>

                    {projectForm.pagosCols.map(col => (
                      <td key={col.id} style={{ padding:'8px 10px', borderBottom:'1px solid #1e293b' }}>
                        <input
                          value={projectForm.pagosGlobales[col.id] || ''}
                          onChange={e => updatePagoGlobal(col.id, e.target.value)}
                          placeholder="0"
                          style={{ ...IS, textAlign:'right', padding:'8px 10px' }}
                        />
                      </td>
                    ))}

                    <td style={{ textAlign:'right', padding:'8px 10px', borderBottom:'1px solid #1e293b', color:'#f8fafc', fontWeight:700 }}>
                      {totalPagos.toLocaleString('es-CO')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </>)}

          <div style={{ ...SS, marginTop:'20px' }}>
            <h2 style={{ marginTop:0, marginBottom:0 }}>DISTRIBUCIÓN DE RECURSOS</h2>
            <p style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'14px' }}>
              {isSupervisor ? 'Asigna recursos a cada actividad' : projectForm.pagosCols.length <= 1 && !projectForm.pagosGlobales[projectForm.pagosCols[0]?.id] ? 'Esperando pagos del supervisor...' : 'Distribuye los recursos recibidos entre las actividades'}
            </p>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'760px' }}>
                <thead>
                  <tr style={{ color:'#e5e7eb', fontWeight:700, fontSize:'13px' }}>
                    <th style={{ textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #334155' }}></th>
                    {projectForm.pagosCols.map(col => (
                      <th key={col.id} style={{ textAlign:'center', padding:'8px 10px', borderBottom:'1px solid #334155' }}>{col.label}</th>
                    ))}
                    <th style={{ textAlign:'center', padding:'8px 10px', borderBottom:'1px solid #334155' }}>TOTAL ASIGNADO</th>
                  </tr>
                </thead>
                <tbody>
                  {projectForm.actividades.filter(a => a.nombre).map(act => (
                    <tr key={act.id}>
                      <td style={{ textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #1e293b', color:'#e5e7eb', fontWeight:700 }}>
                        {act.nombre}
                      </td>

                      {projectForm.pagosCols.map(col => {
                        const totalOtrasActividades = projectForm.actividades.reduce((sum, item) => {
                          if (item.id === act.id) return sum;
                          return sum + (Number(item.pagos?.[col.id]) || 0);
                        }, 0);

                        const maxDisponibleColumna = Math.max(0, (Number(projectForm.pagosGlobales[col.id]) || 0) - totalOtrasActividades);

                        return (
                          <td key={col.id} style={{ padding:'8px 10px', borderBottom:'1px solid #1e293b' }}>
                            <input
                              value={act.pagos?.[col.id] || ''}
                              onChange={e => updatePagoActividad(act.id, col.id, e.target.value)}
                              placeholder="0"
                              style={{ ...IS, textAlign:'right', padding:'8px 10px' }}
                            />
                            <div style={{ fontSize:'10px', color:'#64748b', textAlign:'right', marginTop:'4px' }}>
                              Disp: {maxDisponibleColumna.toLocaleString('es-CO')}
                            </div>
                          </td>
                        );
                      })}

                      <td style={{ textAlign:'right', padding:'8px 10px', borderBottom:'1px solid #1e293b', color:'#f8fafc', fontWeight:700 }}>
                        {totalAsignadoActividad(act).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

            <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid #334155', display:'flex', justifyContent:'space-between', fontWeight:700 }}>
              <span>Total recursos asignados</span>
              <span style={{ color:asigTotal > totalPagos ? '#ef4444' : '#4ade80' }}>
                ${asigTotal.toLocaleString('es-CO')}M / ${totalPagos.toLocaleString('es-CO')}M
              </span>
            </div>
          </div>

          {isSupervisor && (<>
          <div style={{ ...SS, marginTop:'20px' }}>
            <h2 style={{ marginTop:0, marginBottom:'14px' }}>Incidencias de obra</h2>

            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'10px' }}>
              <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'10px 12px', border:'1px solid #334155', borderRadius:'10px', background:'#111827' }}>
                <span style={{ color:'#e5e7eb', fontSize:'14px' }}>Manifestación de la comunidad</span>
                <input
                  type="checkbox"
                  checked={manifestacionComunidadActiva}
                  onChange={e => {
                    const activa = e.target.checked;
                    setManifestacionComunidadActiva(activa);
                    setManifestacionComunidadPendiente(activa);
                    setManifestacionComunidadResuelta(false);
                  }}
                  style={{ width:'18px', height:'18px', cursor:'pointer' }}
                />
              </label>

              <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'10px 12px', border:'1px solid #334155', borderRadius:'10px', background:'#111827' }}>
                <span style={{ color:'#e5e7eb', fontSize:'14px' }}>Demora en los materiales</span>
                <input
                  type="checkbox"
                  checked={demoraMaterialesActiva}
                  onChange={e => {
                    const activa = e.target.checked;
                    setDemoraMaterialesActiva(activa);
                    setDemoraMaterialesPendiente(activa);
                    setDemoraMaterialesResuelta(false);
                  }}
                  style={{ width:'18px', height:'18px', cursor:'pointer' }}
                />
              </label>

              <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'10px 12px', border:'1px solid #334155', borderRadius:'10px', background:'#111827' }}>
                <span style={{ color:'#e5e7eb', fontSize:'14px' }}>Accidente en la obra</span>
                <input
                  type="checkbox"
                  checked={accidenteObraActiva}
                  onChange={e => {
                    const activa = e.target.checked;
                    setAccidenteObraActiva(activa);
                    setAccidenteObraPendiente(activa);
                    setAccidenteObraResuelta(false);
                  }}
                  style={{ width:'18px', height:'18px', cursor:'pointer' }}
                />
              </label>
            </div>
          </div>

          <div style={{ ...SS, marginTop:'20px' }}>
            <h2 style={{ marginTop:0, marginBottom:'14px' }}>Suspensión</h2>

            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'10px' }}>
              <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'10px 12px', border:'1px solid #334155', borderRadius:'10px', background:'#111827' }}>
                <span style={{ color:'#e5e7eb', fontSize:'14px' }}>Lluvia intensa</span>
                <input
                  type="checkbox"
                  checked={lluviaIntensaActiva}
                  onChange={e => {
                    setLluviaIntensaActiva(e.target.checked);
                  }}
                  style={{ width:'18px', height:'18px', cursor:'pointer' }}
                />
              </label>
            </div>
          </div>

          <div style={{ ...SS, marginTop:'20px' }}>
            <h2 style={{ marginTop:0, marginBottom:'14px' }}>Adición</h2>

            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'10px' }}>
              <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'10px 12px', border:'1px solid #334155', borderRadius:'10px', background:'#111827' }}>
                <span style={{ color:'#e5e7eb', fontSize:'14px' }}>Derrumbe</span>
                <input
                  type="checkbox"
                  checked={derrumbeActivo}
                  onChange={e => {
                    const activo = e.target.checked;
                    setDerrumbeActivo(activo);
                    setDerrumbePendiente(activo);
                    setDerrumbeResuelto(false);
                  }}
                  style={{ width:'18px', height:'18px', cursor:'pointer' }}
                />
              </label>
            </div>
          </div>
          </>)}
        </div>
      </div>
    );
  }

  const totalInv = liveActs.reduce((s, a) => s + a.invertido, 0);
  const workingNow = isDaytime && !suspended && !obraFinished && !recursosAgotados && !!startTile;

  return (
    <div className="game-root">
      <GameCanvas
        isNight={isNight}
        nightOpacity={nightOpacity}
        startTile={startTile}
        roadProgress={roadProgress}
        onGrayTileClick={handleTileClick}
        workingNow={workingNow}
        lluviaIntensaActiva={lluviaIntensaActiva}
        derrumbeActivo={derrumbeActivo}
      />
      <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:`rgba(8,12,35,${nightOpacity})`, pointerEvents:'none', zIndex:1, transition:'background 2s ease' }} />

      <div style={{ position:'fixed', top:20, right:20, zIndex:1200, display:'flex', gap:'8px' }}>
        <button onClick={() => setView('setup')} style={{ padding:'10px 14px', borderRadius:'10px', border:'none', background:'#0f172a', color:'#fff', fontWeight:700, cursor:'pointer', boxShadow:'0 6px 16px rgba(0,0,0,0.3)', fontSize:'12px' }}>
          ← Configuración
        </button>
        {isSupervisor && (
        <>
        <button onClick={() => changeTimeScale(1)} style={{ padding:'10px 12px', borderRadius:'10px', border:'none', background:timeScale===1?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          x1
        </button>
        <button onClick={() => changeTimeScale(100)} style={{ padding:'10px 12px', borderRadius:'10px', border:'none', background:timeScale===100?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          x100
        </button>
        <button onClick={() => changeTimeScale(500)} style={{ padding:'10px 12px', borderRadius:'10px', border:'none', background:timeScale===500?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          x500
        </button>
        </>
        )}
        {isSupervisor && viewingAsPlayer && (
        <button onClick={() => { setViewingAsPlayer(null); setView('supervisor'); }} style={{ padding:'10px 14px', borderRadius:'10px', border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          ← Volver al panel
        </button>
        )}
        <button onClick={async () => { await saveGameState(); await supabase.auth.signOut(); setCurrentUser(null); setCurrentRole('player'); setViewingAsPlayer(null); setView('login'); }} style={{ padding:'10px 14px', borderRadius:'10px', border:'none', background:'#dc2626', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          Guardar y salir
        </button>
      </div>

      <div style={{ position:'absolute', top:16, left:'50%', transform:'translateX(-50%)', background:'rgba(12,20,32,0.93)', color:'#fff', padding:'12px 24px', borderRadius:'10px', zIndex:3, textAlign:'center', minWidth:'380px', fontSize:'13px' }}>
        <div style={{ fontSize:'17px', fontWeight:700, marginBottom:'4px', color:'#facc15' }}>{projectForm.proyectoNombre || 'Sin nombre'}</div>
        {isSupervisor && viewingAsPlayer && (
          <div style={{ fontSize:'11px', color:'#7c3aed', fontWeight:700, marginBottom:'4px' }}>
            Viendo: {viewingAsPlayer.email.split('@')[0].toUpperCase()}
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'center', gap:'20px', color:'#94a3b8', fontSize:'12px' }}>
          <span>Contratista: <b style={{ color:'#e5e7eb' }}>{projectForm.contratistaNombre || '—'}</b></span>
          <span>Interventor: <b style={{ color:'#e5e7eb' }}>{projectForm.interventoriaNombre || '—'}</b></span>
        </div>
      </div>

      {manifestacionComunidadPendiente && (
        <button
          onClick={resolverManifestacionComunidad}
          style={{
            position:'absolute',
            top:'92px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #f59e0b',
            background:'rgba(120, 53, 15, 0.95)',
            color:'#fff7ed',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            cursor:'pointer',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          La comunidad esta preocupada por que van a cerrar la unica via de accesso y cree que se impedira al acceso al transporte escolar y la salida de los habitantes haz click para reunirte con ellos ya atender su solicitud.
        </button>
      )}

      {manifestacionComunidadResuelta && (
        <div
          style={{
            position:'absolute',
            top:'92px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #16a34a',
            background:'rgba(20, 83, 45, 0.95)',
            color:'#dcfce7',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          incidencia solucionada no olvides dejar regitro en la botacora de obra
        </div>
      )}

      {demoraMaterialesPendiente && (
        <button
          onClick={resolverDemoraMateriales}
          style={{
            position:'absolute',
            top:'158px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #f59e0b',
            background:'rgba(120, 53, 15, 0.95)',
            color:'#fff7ed',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            cursor:'pointer',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          El proveerdo ha indicado que no tiene suficientes materiales para suministrarte en la obra has click para contactar un nuevo proveedor
        </button>
      )}

      {demoraMaterialesResuelta && (
        <div
          style={{
            position:'absolute',
            top:'158px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #16a34a',
            background:'rgba(20, 83, 45, 0.95)',
            color:'#dcfce7',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          incidencia solucionada no olvides dejar regitro en la botacora de obra
        </div>
      )}

      {accidenteObraPendiente && (
        <button
          onClick={resolverAccidenteObra}
          style={{
            position:'absolute',
            top:'224px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #f59e0b',
            background:'rgba(120, 53, 15, 0.95)',
            color:'#fff7ed',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            cursor:'pointer',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          Uno de lo trabajadores ha surido un aacidente en obra, haz click para llevarlo a atencion medica
        </button>
      )}

      {accidenteObraResuelta && (
        <div
          style={{
            position:'absolute',
            top:'224px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #16a34a',
            background:'rgba(20, 83, 45, 0.95)',
            color:'#dcfce7',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          incidencia solucionada no olvides dejar regitro en la botacora de obra
        </div>
      )}

      {derrumbePendiente && (
        <div
          style={{
            position:'absolute',
            top:'290px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #f59e0b',
            background:'rgba(120, 53, 15, 0.95)',
            color:'#fff7ed',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          Se ha presedtadol un derrumbre de 3 m3 de tierra y se identificado que hay que hacer una pequeña etabilizcion del talud en una logitud de 2 metros hablen con el supervisor
        </div>
      )}

      {false && (
        <div
          style={{
            position:'absolute',
            top:'290px',
            left:'50%',
            transform:'translateX(-50%)',
            zIndex:1100,
            maxWidth:'760px',
            width:'calc(100% - 48px)',
            padding:'14px 18px',
            borderRadius:'12px',
            border:'1px solid #16a34a',
            background:'rgba(20, 83, 45, 0.95)',
            color:'#dcfce7',
            fontWeight:700,
            fontSize:'14px',
            textAlign:'center',
            boxShadow:'0 10px 24px rgba(0,0,0,0.35)',
          }}
        >
          incidencia solucionada no olvides dejar regitro en la botacora de obra
        </div>
      )}

      <div className="hud" style={{ top:'16px', left:'16px', padding:'14px 18px', minWidth:'260px' }}>
        <div style={{ fontWeight:700, fontSize:'14px', marginBottom:'8px' }}>Notificaciones</div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8', fontSize:'12px' }}>Tiempo desde inicio</span>
          <span style={{ fontFamily:'monospace', fontWeight:600, fontSize:'12px' }}>{elapsed}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8', fontSize:'12px' }}>Tiempo de obra</span>
          <span style={{ fontFamily:'monospace', fontWeight:600, fontSize:'12px', color:'#4ade80' }}>{workTimeDisplay}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8', fontSize:'12px' }}>Hora del juego</span>
          <span style={{ fontFamily:'monospace', fontWeight:600, fontSize:'12px', color:'#facc15' }}>{gameHourDisplay}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8', fontSize:'12px' }}>Avance general</span>
          <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:'12px', color:'#60a5fa' }}>{projectProgress.toFixed(1)}%</span>
        </div>

        {!startTile && !obraFinished && (
          <div style={{ marginTop:'8px', padding:'8px', background:'#1e3a5f', borderRadius:'6px', color:'#60a5fa', fontSize:'11px', textAlign:'center' }}>
            📍 Haz clic en la vía gris para iniciar
          </div>
        )}
        {suspended && <div style={{ marginTop:'6px', padding:'6px 8px', background:'#4a1c1c', borderRadius:'6px', color:'#fca5a5', fontSize:'11px', textAlign:'center' }}>⏸ Trabajos suspendidos</div>}
        {recursosAgotados && <div style={{ marginTop:'6px', padding:'6px 8px', background:'#4a3a1c', borderRadius:'6px', color:'#fbbf24', fontSize:'11px', textAlign:'center' }}>💰 Recursos agotados</div>}
        {obraFinished && <div style={{ marginTop:'6px', padding:'6px 8px', background:'#0a2e1a', borderRadius:'6px', color:'#4ade80', fontSize:'11px', textAlign:'center' }}>🎉 Obra terminada</div>}
        {!isDaytime && startTile && !obraFinished && <div style={{ marginTop:'6px', padding:'6px 8px', background:'#1e293b', borderRadius:'6px', color:'#94a3b8', fontSize:'11px', textAlign:'center' }}>🌙 Jornada nocturna</div>}

        <div style={{ borderTop:'1px solid #334155', marginTop:'8px', paddingTop:'8px', maxHeight:'100px', overflowY:'auto', fontSize:'11px' }}>
          {notifs.length === 0 && <div style={{ color:'#64748b' }}>Sin notificaciones</div>}
          {notifs.map(n => (
            <div key={n.id} style={{ margin:'3px 0', display:'flex', gap:'6px', alignItems:'center' }}>
              <span>{n.icon}</span><span style={{ color:'#cbd5e1' }}>{n.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position:'absolute', bottom:'16px', left:'300px', background:'rgba(12,20,32,0.93)', color:'#fff', padding:'14px 16px', borderRadius:'10px', zIndex:3, minWidth:'280px', maxWidth:'320px', fontSize:'12px' }}>
        <div style={{ fontWeight:700, fontSize:'13px', marginBottom:'8px' }}>Puntaje</div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8' }}>Puntaje actual</span>
          <span style={{ fontWeight:700, color:score > 40 ? '#4ade80' : '#facc15' }}>{score.toFixed(1)}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8' }}>Cambios valor contrato</span>
          <span>{cambiosContratoValorRef.current}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8' }}>Cambios duración</span>
          <span>{cambiosContratoDuracionRef.current}</span>
        </div>
        <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid #334155', color:'#94a3b8', fontSize:'11px' }}>
          Puntaje inicial: 50 · Puntaje mínimo: 35
        </div>
      </div>

      <div style={{ position:'absolute', bottom:'16px', right:'16px', background:'rgba(12,20,32,0.93)', color:'#fff', padding:'14px 16px', borderRadius:'10px', zIndex:3, minWidth:'440px', maxWidth:'520px', maxHeight:'320px', overflowY:'auto', fontSize:'12px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <div style={{ fontWeight:700, fontSize:'13px' }}>Actividades del proyecto</div>
        </div>

        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ color:'#94a3b8', fontSize:'10px' }}>
              <th style={{ textAlign:'center', padding:'4px', borderBottom:'1px solid #334155', width:'28px' }}>On</th>
              <th style={{ textAlign:'left', padding:'4px 6px', borderBottom:'1px solid #334155' }}>Actividad</th>
              <th style={{ textAlign:'right', padding:'4px 6px', borderBottom:'1px solid #334155' }}>Valor</th>
              <th style={{ textAlign:'right', padding:'4px', borderBottom:'1px solid #334155' }}>Días</th>
              <th style={{ textAlign:'right', padding:'4px 6px', borderBottom:'1px solid #334155' }}>Avance</th>
              <th style={{ textAlign:'right', padding:'4px 6px', borderBottom:'1px solid #334155' }}>Invertido</th>
            </tr>
          </thead>
          <tbody>
            {liveActs.filter(a => a.nombre).map(act => (
              <tr key={act.id} style={{ opacity:act.activa?1:0.4 }}>
                <td style={{ padding:'4px', borderBottom:'1px solid #1e293b', textAlign:'center' }}>
                  <input type="checkbox" checked={act.activa} onChange={() => toggleAct(act.id)} style={{ cursor:'pointer' }} disabled={obraFinished} />
                </td>
                <td style={{ padding:'5px 6px', borderBottom:'1px solid #1e293b', color:'#e5e7eb' }}>{act.nombre}</td>
                <td style={{ padding:'5px 6px', borderBottom:'1px solid #1e293b', textAlign:'right', color:'#facc15' }}>${(Number(act.valor)||0).toLocaleString('es-CO')}</td>
                <td style={{ padding:'5px 4px', borderBottom:'1px solid #1e293b', textAlign:'right' }}>{act.duracion || '—'}</td>
                <td style={{ padding:'5px 6px', borderBottom:'1px solid #1e293b', textAlign:'right' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px' }}>
                    <div style={{ width:'36px', height:'5px', background:'#1e293b', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ width:`${act.avance}%`, height:'100%', background:act.avance>=100?'#4ade80':'#facc15', borderRadius:'3px' }} />
                    </div>
                    <span style={{ fontSize:'11px' }}>{act.avance}%</span>
                  </div>
                </td>
                <td style={{ padding:'5px 6px', borderBottom:'1px solid #1e293b', textAlign:'right', color:'#60a5fa' }}>${act.invertido.toLocaleString('es-CO')}M</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop:'1px solid #334155', marginTop:'8px', paddingTop:'8px', display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:'12px' }}>
          <span>Invertido total</span>
          <span style={{ color:'#60a5fa' }}>${totalInv.toLocaleString('es-CO')}M / ${Math.min(totalPagos, asigTotal).toLocaleString('es-CO')}M</span>
        </div>
      </div>

      {!gameStarted && (
        <div className="hint">Arrastra para mover · Scroll para zoom · Clic en vía gris para iniciar obra</div>
      )}
    </div>
  );
}