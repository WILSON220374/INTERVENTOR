import { useEffect, useRef, useState, useCallback } from 'react';
import GameCanvas from './GameCanvas.tsx';
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
  const [view, setView] = useState<'setup'|'game'>('setup');
  const [projectForm, setProjectForm] = useState<ProjectFormState>(INITIAL_FORM);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [gameHourDisplay, setGameHourDisplay] = useState('Día 1 - 07:00');
  const [isNight, setIsNight] = useState(false);
  const [nightOpacity, setNightOpacity] = useState(0);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [workDays, setWorkDays] = useState(0);
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

  const startRef = useRef(Date.now());
  const nidRef = useRef(0);
  const suspendedTimeRef = useRef(0);
  const suspendStartRef = useRef(0);

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
        };
      })
    );
  }

  function resetGameState(showNotif = false) {
    startRef.current = Date.now();
    suspendedTimeRef.current = 0;
    suspendStartRef.current = 0;
    setElapsed('00:00:00');
    setGameHourDisplay('Día 1 - 07:00');
    setWorkDays(0);
    setStartTile(null);
    setRoadProgress(0);
    setProjectProgress(0);
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
    if (showNotif) pushNotif('🔄', 'Proyecto reiniciado');
  }

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

  function resolverManifestacionComunidad() {
    if (!manifestacionComunidadPendiente) return;

    if (suspended) {
      suspendedTimeRef.current += Date.now() - suspendStartRef.current;
    }

    setManifestacionComunidadPendiente(false);
    setManifestacionComunidadResuelta(true);
    setSuspended(false);
    pushNotif('🤝', 'Manifestación de la comunidad solucionada.');
  }

  function resolverDemoraMateriales() {
    if (!demoraMaterialesPendiente) return;

    if (suspended) {
      suspendedTimeRef.current += Date.now() - suspendStartRef.current;
    }

    setDemoraMaterialesPendiente(false);
    setDemoraMaterialesResuelta(true);
    setSuspended(false);
    pushNotif('📦', 'Demora en los materiales solucionada.');
  }

  function resolverAccidenteObra() {
    if (!accidenteObraPendiente) return;

    if (suspended) {
      suspendedTimeRef.current += Date.now() - suspendStartRef.current;
    }

    setAccidenteObraPendiente(false);
    setAccidenteObraResuelta(true);
    setSuspended(false);
    pushNotif('🚑', 'Accidente en la obra solucionado.');
  }

  useEffect(() => {
    syncLiveActsWithForm();
  }, [projectForm.actividades, projectForm.pagosCols, projectForm.pagosGlobales]);
  
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
    if (!lluviaIntensaActiva) return;
    if (suspended) return;

    suspendStartRef.current = Date.now();
    setSuspended(true);
    pushNotif('🌧️', 'La intensidad del invierno impide continuar con los trabajos.');
  }, [view, lluviaIntensaActiva, suspended]);

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
    syncLiveActsWithForm();
  }, [projectForm.actividades, projectForm.pagosCols, projectForm.pagosGlobales]);

  useEffect(() => {
    if (gameStarted && recursosAgotados) {
      const nuevoTotalPagos = totalPagosGlobales();
      const nuevoTotalAsignado = totalAsignadoGeneral();
      const maxDisponible = Math.min(nuevoTotalPagos, nuevoTotalAsignado);
      const totalInvertidoActual = liveActs.reduce((sum, act) => sum + act.invertido, 0);

      if (maxDisponible > totalInvertidoActual) {
        setRecursosAgotados(false);
        pushNotif('💵', 'Ingresaron nuevos recursos. La obra continúa.');
      }
    }
  }, [projectForm.pagosGlobales, projectForm.actividades]);
  useEffect(() => {
    if (view !== 'game') return;

    const iv = setInterval(() => {
      if (obraFinished) return;

      const realEl = Date.now() - startRef.current;
      const eh = Math.floor(realEl / 3600000);
      const em = Math.floor((realEl % 3600000) / 60000);
      const es = Math.floor((realEl % 60000) / 1000);
      setElapsed(`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:${String(es).padStart(2,'0')}`);

      const gameMs = realEl * 8 * timeScale
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

      if (!gameStarted || !startTile) return;

      const suspTime = suspended
        ? (Date.now() - suspendStartRef.current + suspendedTimeRef.current)
        : suspendedTimeRef.current;

      const totalGameDays = (gameMs / 3600000) / 24;
      const fullDays = Math.floor(totalGameDays);
      const partialH = gameTotalHours % 24;

      let workH = fullDays * 11;
      if (partialH >= 7 && partialH < 18) workH += (partialH - 7);
      else if (partialH >= 18) workH += 11;

      const suspGameH = (suspTime * 8 * timeScale) / 3600000;
      const effWorkH = Math.max(0, workH - suspGameH);
      const effWorkDays = effWorkH / 11;
      setWorkDays(effWorkDays);

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
            return {
              ...act,
              avance: act.avance,
              invertido: act.invertido,
            };
          }

          const valorDiaActividad = valorAct / dur;
          const maxDiasPorAsignado = Math.min(dur, asignado / valorDiaActividad);
          const diasTrabajadosActividad = Math.min(effWorkDays, maxDiasPorAsignado);

          let newInvertido = Math.min(asignado, valorDiaActividad * diasTrabajadosActividad);
          let newAvance = Math.min(100, (newInvertido / valorAct) * 100);

          totalSpent += newInvertido;

          return {
            ...act,
            avance: Math.round(newAvance),
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
              avance: Math.round(avanceAjustado),
            };

            faltante -= descuento;
          }

          totalSpent = topeGlobalDisponible;
        }

        const avanceGeneral = contratoTotal > 0 ? Math.min(100, (totalSpent / contratoTotal) * 100) : 0;
        setProjectProgress(avanceGeneral);
        setRoadProgress(avanceGeneral);

        if (topeGlobalDisponible > 0 && totalSpent >= topeGlobalDisponible && !recursosAgotados) {
          setRecursosAgotados(true);
          pushNotif('💰', 'Recursos agotados. La obra se detiene.');
        }

        const activasConRecursos = updated.filter(a => a.nombre && a.activa && Number(a.asignado) > 0);
        if (activasConRecursos.length > 0 && activasConRecursos.every(a => a.avance >= 100) && !obraFinished) {
          setObraFinished(true);
          pushNotif('🎉', '¡Obra terminada!');
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
    setProjectForm(p => ({
      ...p,
      pagosGlobales: {
        ...p.pagosGlobales,
        [pagoId]: Number(v) || 0,
      }
    }));
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
  const canStart = actividadesOk && !!projectForm.proyectoNombre && !!projectForm.contratistaNombre && totalPagos > 0;

  if (view === 'setup') {
    return (
      <div style={{ minHeight:'100vh', maxHeight:'100vh', overflowY:'auto', background:'#0f172a', color:'#e5e7eb', padding:'32px', fontFamily:'Inter,system-ui,sans-serif', boxSizing:'border-box' }}>
        <div style={{ maxWidth:'1250px', margin:'0 auto', background:'#111827', border:'1px solid #334155', borderRadius:'18px', padding:'28px', boxShadow:'0 10px 30px rgba(0,0,0,0.25)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:'20px', alignItems:'center', marginBottom:'24px', flexWrap:'wrap' }}>
            <div>
              <h1 style={{ margin:0, fontSize:'28px' }}>Configuración inicial del proyecto</h1>
              <p style={{ margin:'8px 0 0 0', color:'#94a3b8' }}>Registra la información base antes de entrar al juego.</p>
            </div>

            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'flex-end' }}>
              <button
                onClick={() => {
                  if (canStart && !gameStarted) {
                    setLiveActs(projectForm.actividades.map(a => ({
                      ...a,
                      asignado: totalAsignadoActividad(a),
                      avance: 0,
                      invertido: 0,
                    })));
                    setStartTile(null);
                    setManifestacionComunidadPendiente(manifestacionComunidadActiva);
                    setManifestacionComunidadResuelta(false);
                    setDemoraMaterialesPendiente(demoraMaterialesActiva);
                    setDemoraMaterialesResuelta(false);
                    setAccidenteObraPendiente(accidenteObraActiva);
                    setAccidenteObraResuelta(false);
                    setView('game');
                  }
                }}
                disabled={!canStart || gameStarted}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:(canStart && !gameStarted)?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:(canStart && !gameStarted)?'pointer':'not-allowed', fontSize:'15px', opacity:(canStart && !gameStarted)?1:0.5 }}
              >
                Iniciar proyecto
              </button>

              <button
                onClick={() => setView('game')}
                disabled={!gameStarted}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:gameStarted?'#0f766e':'#334155', color:'#fff', fontWeight:700, cursor:gameStarted?'pointer':'not-allowed', fontSize:'15px', opacity:gameStarted?1:0.5 }}
              >
                Regresar a la obra
              </button>

              <button
                onClick={toggleSuspend}
                disabled={!gameStarted || obraFinished}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:(!gameStarted || obraFinished)?'#334155':(suspended?'#16a34a':'#dc2626'), color:'#fff', fontWeight:700, cursor:(!gameStarted || obraFinished)?'not-allowed':'pointer', fontSize:'15px', opacity:(!gameStarted || obraFinished)?0.5:1 }}
              >
                {suspended ? 'Reanudar' : 'Suspender'}
              </button>

              <button
                onClick={() => resetGameState(true)}
                style={{ padding:'12px 18px', borderRadius:'12px', border:'none', background:'#475569', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'15px' }}
              >
                Reiniciar
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
                      <th key={col.id} style={{ textAlign:'center', padding:'8px 10px', borderBottom:'1px solid #334155' }}>{col.label}</th>
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

            <div style={{ overflowX:'auto' }}>
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
            </div>

            <div style={{ marginTop:'14px', paddingTop:'12px', borderTop:'1px solid #334155', display:'flex', justifyContent:'space-between', fontWeight:700 }}>
              <span>Total recursos asignados</span>
              <span style={{ color:asigTotal > totalPagos ? '#ef4444' : '#4ade80' }}>
                ${asigTotal.toLocaleString('es-CO')}M / ${totalPagos.toLocaleString('es-CO')}M
              </span>
            </div>
          </div>

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
      />
      <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:`rgba(8,12,35,${nightOpacity})`, pointerEvents:'none', zIndex:1, transition:'background 2s ease' }} />

      <div style={{ position:'fixed', top:20, right:20, zIndex:1200, display:'flex', gap:'8px' }}>
        <button onClick={() => setView('setup')} style={{ padding:'10px 14px', borderRadius:'10px', border:'none', background:'#0f172a', color:'#fff', fontWeight:700, cursor:'pointer', boxShadow:'0 6px 16px rgba(0,0,0,0.3)', fontSize:'12px' }}>
          ← Configuración
        </button>
        <button onClick={() => setTimeScale(1)} style={{ padding:'10px 12px', borderRadius:'10px', border:'none', background:timeScale===1?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          x1
        </button>
        <button onClick={() => setTimeScale(4)} style={{ padding:'10px 12px', borderRadius:'10px', border:'none', background:timeScale===4?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          x4
        </button>
        <button onClick={() => setTimeScale(12)} style={{ padding:'10px 12px', borderRadius:'10px', border:'none', background:timeScale===12?'#2563eb':'#334155', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'12px' }}>
          x12
        </button>
      </div>

      <div style={{ position:'absolute', top:16, left:'50%', transform:'translateX(-50%)', background:'rgba(12,20,32,0.93)', color:'#fff', padding:'12px 24px', borderRadius:'10px', zIndex:3, textAlign:'center', minWidth:'380px', fontSize:'13px' }}>
        <div style={{ fontSize:'17px', fontWeight:700, marginBottom:'4px', color:'#facc15' }}>{projectForm.proyectoNombre || 'Sin nombre'}</div>
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

      <div className="hud" style={{ top:'16px', left:'16px', padding:'14px 18px', minWidth:'260px' }}>
        <div style={{ fontWeight:700, fontSize:'14px', marginBottom:'8px' }}>Notificaciones</div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8', fontSize:'12px' }}>Tiempo desde inicio</span>
          <span style={{ fontFamily:'monospace', fontWeight:600, fontSize:'12px' }}>{elapsed}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', margin:'4px 0' }}>
          <span style={{ color:'#94a3b8', fontSize:'12px' }}>Tiempo de obra</span>
          <span style={{ fontFamily:'monospace', fontWeight:600, fontSize:'12px', color:'#4ade80' }}>{workDays.toFixed(1)} días</span>
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

      <div className="hint">Arrastra para mover · Scroll para zoom · Clic en vía gris para iniciar obra</div>
    </div>
  );
}
