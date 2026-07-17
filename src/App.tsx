/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import { 
  Package, 
  Plus, 
  Trash2, 
  Layers, 
  RotateCcw, 
  Play, 
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Info,
  Copy,
  Camera,
  X,
  Loader2,
  Zap,
  ZapOff,
  ZoomIn,
  ZoomOut,
  ArrowLeftRight,
  ArrowUpDown,
  Box as BoxIcon,
  MoreVertical,
  History,
  Clock,
  Download,
  Upload,
  Share2,
  Link,
  QrCode,
  MessageSquare,
  Mail,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { idb, safeStorage } from './db';

// Error Boundary for 3D Canvas
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("3D Canvas Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Erro na Visualização 3D</h3>
          <p className="text-slate-600 text-sm max-w-xs">
            Houve um problema ao carregar o visual 3D. Tente fechar e abrir novamente.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
          >
            Recarregar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { PRODUCT_DB } from './data/products';
import { ChosenProduct, PalletLayer, PalletItem } from './types';

const colorStops = [
  { p: 100, rgb: [34, 197, 94] },    // Green (emerald-500) #22c55e
  { p: 90, rgb: [20, 184, 166] },    // Teal (teal-500) #14b8a6
  { p: 80, rgb: [59, 130, 246] },    // Blue (blue-500) #3b82f6
  { p: 70, rgb: [234, 179, 8] },     // Yellow (yellow-500) #eab308
  { p: 60, rgb: [249, 115, 22] },    // Orange (orange-500) #f97316
  { p: 50, rgb: [234, 88, 12] },     // Dark Orange (orange-600) #ea580c
  { p: 40, rgb: [239, 68, 68] },     // Red (red-500) #ef4444
];

const getPercentColorStyle = (percent: number): string => {
  const p = Math.max(0, Math.min(100, percent));
  
  if (p <= 40) {
    return 'rgb(239, 68, 68)'; // Red
  }
  if (p >= 100) {
    return 'rgb(34, 197, 94)'; // Green
  }
  
  let lowerStop = colorStops[colorStops.length - 1];
  let upperStop = colorStops[0];
  
  for (let i = 0; i < colorStops.length - 1; i++) {
    const s1 = colorStops[i];
    const s2 = colorStops[i + 1];
    if (p <= s1.p && p >= s2.p) {
      upperStop = s1;
      lowerStop = s2;
      break;
    }
  }
  
  const range = upperStop.p - lowerStop.p;
  const factor = range === 0 ? 0 : (p - lowerStop.p) / range;
  
  const r = Math.round(lowerStop.rgb[0] + factor * (upperStop.rgb[0] - lowerStop.rgb[0]));
  const g = Math.round(lowerStop.rgb[1] + factor * (upperStop.rgb[1] - lowerStop.rgb[1]));
  const b = Math.round(lowerStop.rgb[2] + factor * (upperStop.rgb[2] - lowerStop.rgb[2]));
  
  return `rgb(${r}, ${g}, ${b})`;
};

function getItemClass(item: any): string {
  if (item.classe) return item.classe;
  
  if (item.codOriginal && PRODUCT_DB[item.codOriginal]) {
    return PRODUCT_DB[item.codOriginal].classe;
  }
  
  if (item.nome) {
    const match = Object.values(PRODUCT_DB).find(p => p.nome === item.nome);
    if (match) return match.classe;
  }
  
  return "";
}

function getClassColor(item: any): string {
  const classe = getItemClass(item);
  if (!classe) return '#94a3b8';
  const clean = classe.trim().toLowerCase().replace(/\s+/g, '');
  
  // Latas (Azuis e Tons Frios)
  if (clean === 'lt220') return '#7dd3fc';
  if (clean === 'lt290') return '#38bdf8';
  if (clean === 'lt310') return '#0ea5e9';
  if (clean === 'lt350') return '#2563eb';
  if (clean === 'lt473') return '#1d4ed8';

  // Pets pequenas e médias (Laranjas, Amarelos e Ambares)
  if (clean === 'pet200') return '#fbbf24';
  if (clean === 'pet450') return '#fb923c';
  if (clean === 'pet500') return '#f97316';
  if (clean === 'pet510/600' || clean === 'pet510' || clean === 'pet600' || clean.includes('510/600')) return '#6366f1';

  // Pets grandes (Verdes)
  if (clean === 'pet1000') return '#34d399';
  if (clean === 'pet1500') return '#10b981';
  if (clean === 'pet2000') return '#059669';
  if (clean === 'pet3000') return '#047857';
  if (clean === 'pet5000') return '#115e59';

  // Caixas Tetra Pack (Rojos e Rosas)
  if (clean === 'tp200') return '#f87171';
  if (clean === 'tp1000') return '#ef4444';

  return '#94a3b8';
}

function MiniLayer2D({ layer }: { layer: PalletLayer }) {
  const firstItem = layer.itens[0];
  
  // Total positions needed (stacked items count as 1 position)
  const totalPositions = useMemo(() => {
    let total = 0;
    layer.itens.forEach(item => {
      const q = item.qtdUsada || 0;
      total += item.stack === "2x" ? Math.ceil(q / 2) : q;
    });
    return total;
  }, [layer.itens]);

  const capacity = useMemo(() => {
    if (!firstItem || !firstItem.percFardo) return 1;
    return Math.max(1, Math.round(100 / firstItem.percFardo));
  }, [firstItem]);

  const isFullLayer = layer.percentual >= 95;
  const targetCount = isFullLayer ? totalPositions : Math.max(capacity, totalPositions);

  const layout = useMemo(() => {
    if (targetCount === 45) return { rows: 9, getCols: () => 5 };
    if (targetCount === 40) return { rows: 8, getCols: () => 5 };
    if (targetCount === 30) return { rows: 6, getCols: () => 5 };
    if (targetCount === 28) return { rows: 4, getCols: () => 7 };
    
    // Mixed / Special layouts
    if (targetCount === 20) return { rows: 4, getCols: (r: number) => r < 2 ? 6 : 4 };
    if (targetCount === 21) return { rows: 4, getCols: (r: number) => r < 1 ? 6 : 5 };
    if (targetCount === 22) return { rows: 4, getCols: (r: number) => r < 3 ? 6 : 4 };
    if (targetCount === 23) return { rows: 4, getCols: (r: number) => r < 3 ? 6 : 5 };
    if (targetCount === 24) return { rows: 4, getCols: () => 6 };
    if (targetCount === 25) return { rows: 4, getCols: (r: number) => r < 3 ? 7 : 4 };
    if (targetCount === 26) return { rows: 4, getCols: (r: number) => r < 2 ? 7 : 6 };
    if (targetCount === 27) return { rows: 4, getCols: (r: number) => r < 3 ? 7 : 6 };
    
    const r = Math.max(1, Math.ceil(targetCount / 5));
    return { rows: r, getCols: () => 5 };
  }, [targetCount]);

  if (!firstItem || totalPositions === 0 || layout.rows === 0) {
    return (
      <div className="w-12 h-12 bg-slate-950 border border-white/10 rounded-xl flex items-center justify-center text-[10px] text-white/40 font-bold uppercase shrink-0">
        Vazia
      </div>
    );
  }

  const areaSize = 1.2;
  const spacingZ = areaSize / layout.rows;
  const rects: { x: number; y: number; w: number; h: number; color: string; id: string }[] = [];
  let currentPosIndex = 0;

  const getPos = (index: number) => {
    if (layout.rows <= 0) return { r: 0, c: 0, colsInRow: 1 };
    let count = 0;
    for (let r = 0; r < layout.rows; r++) {
      const colsInRow = layout.getCols(r);
      if (index < count + colsInRow) {
        return { r, c: index - count, colsInRow };
      }
      count += colsInRow;
    }
    const lastRow = Math.max(0, layout.rows - 1);
    return { r: lastRow, c: 0, colsInRow: layout.getCols(lastRow) };
  };

  layer.itens.forEach((item, itemIdx) => {
    const color = getClassColor(item);
    const isStacked = item.stack === "2x";
    const q = item.qtdUsada || 0;
    const effectiveQtd = isStacked ? Math.ceil(q / 2) : q;

    for (let i = 0; i < effectiveQtd; i++) {
      const { r, c, colsInRow } = getPos(currentPosIndex);
      if (r >= layout.rows) break;

      let itemsInThisRow = colsInRow;
      let currentCol = c;

      if (isFullLayer && r === layout.rows - 1) {
        let itemsBeforeLastRow = 0;
        for (let j = 0; j < r; j++) {
          itemsBeforeLastRow += layout.getCols(j);
        }
        const remaining = totalPositions - itemsBeforeLastRow;
        if (remaining > 0) {
          itemsInThisRow = remaining;
          currentCol = currentPosIndex - itemsBeforeLastRow;
        }
      }

      const spacingX = areaSize / itemsInThisRow;
      const posX = (currentCol - (itemsInThisRow - 1) / 2) * spacingX;
      const posZ = (r - (layout.rows - 1) / 2) * spacingZ;

      const gapFactor = isFullLayer ? 0.96 : 0.92;

      const boxW = spacingX * gapFactor;
      const boxH = spacingZ * gapFactor;

      const pixelSize = 48;
      const svgX = ((posX - boxW / 2) / areaSize + 0.5) * pixelSize;
      const svgY = ((posZ - boxH / 2) / areaSize + 0.5) * pixelSize;
      const svgW = (boxW / areaSize) * pixelSize;
      const svgH_val = (boxH / areaSize) * pixelSize;

      rects.push({
        x: Math.max(0.5, svgX),
        y: Math.max(0.5, svgY),
        w: Math.min(pixelSize - 1, svgW),
        h: Math.min(pixelSize - 1, svgH_val),
        color,
        id: `${itemIdx}-${i}`
      });

      currentPosIndex++;
    }
  });

  return (
    <div className="w-11 h-11 bg-slate-950 border border-white/20 rounded-xl relative overflow-hidden flex-shrink-0 shadow-inner flex items-center justify-center">
      <svg width="100%" height="100%" viewBox="0 0 48 48" className="w-full h-full">
        <rect x="1" y="1" width="46" height="46" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        
        <line x1="8" y1="0" x2="8" y2="48" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="16" y1="0" x2="16" y2="48" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="24" y1="0" x2="24" y2="48" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="32" y1="0" x2="32" y2="48" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="40" y1="0" x2="40" y2="48" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        {rects.map((rect) => (
          <rect
            key={rect.id}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill={rect.color}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="0.5"
            rx="1"
          />
        ))}
      </svg>
    </div>
  );
}

export default function App() {
  // Inicialização do estado com dados do LocalStorage (Lazy Initialization)
  const [chosenProducts, setChosenProducts] = useState<ChosenProduct[]>(() => {
    const saved = safeStorage.getItem('palletizer_products');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [palletLayers, setPalletLayers] = useState<PalletLayer[]>(() => {
    const saved = safeStorage.getItem('palletizer_layers');
    return saved ? JSON.parse(saved) : [];
  });

  const [allowStacking, setAllowStacking] = useState<boolean>(() => {
    const saved = safeStorage.getItem('palletizer_allow_stacking');
    return saved ? JSON.parse(saved) === true : false;
  });

  const [inputCodes, setInputCodes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningStatus, setScanningStatus] = useState("Reconhecendo códigos...");
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [configuringLayerId, setConfiguringLayerId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  interface PalletHistoryEntry {
    id: string;
    timestamp: string;
    skusCount: number;
    totalFardos: number;
    timeTaken: string;
    layersCount: number;
  }

  const [history, setHistory] = useState<PalletHistoryEntry[]>(() => {
    const saved = safeStorage.getItem('palletizer_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(curr => curr?.message === message ? null : curr);
    }, 4000);
  };
  const [timerActive, setTimerActive] = useState<boolean>(() => {
    return safeStorage.getItem('palletizer_timer_active') === 'true';
  });
  const [timeElapsed, setTimeElapsed] = useState<number>(() => {
    const active = safeStorage.getItem('palletizer_timer_active') === 'true';
    if (!active) return 0;
    const start = safeStorage.getItem('palletizer_timer_start');
    if (!start) return 0;
    const elapsed = Math.floor((Date.now() - parseInt(start, 10)) / 1000);
    return elapsed > 0 ? elapsed : 0;
  });

  const configuringLayer = useMemo(() => {
    return palletLayers.find(l => l.id === configuringLayerId) || null;
  }, [configuringLayerId, palletLayers]);

  // Restaura dados do IndexedDB e sincroniza com o LocalStorage
  React.useEffect(() => {
    const restoreFromDB = async () => {
      try {
        // 1. Histórico
        const localHistoryStr = safeStorage.getItem('palletizer_history');
        const localHistory = localHistoryStr ? JSON.parse(localHistoryStr) : [];
        const idbHistory = await idb.get<any[]>('palletizer_history');
        
        if (idbHistory && idbHistory.length > 0 && (!localHistory || localHistory.length === 0)) {
          setHistory(idbHistory);
          safeStorage.setItem('palletizer_history', JSON.stringify(idbHistory));
        } else if (localHistory && localHistory.length > 0 && (!idbHistory || idbHistory.length === 0)) {
          await idb.set('palletizer_history', localHistory);
        }

        // 2. Produtos Selecionados
        const localProductsStr = safeStorage.getItem('palletizer_products');
        const localProducts = localProductsStr ? JSON.parse(localProductsStr) : [];
        const idbProducts = await idb.get<any[]>('palletizer_products');
        
        if (idbProducts && idbProducts.length > 0 && (!localProducts || localProducts.length === 0)) {
          setChosenProducts(idbProducts);
          safeStorage.setItem('palletizer_products', JSON.stringify(idbProducts));
        } else if (localProducts && localProducts.length > 0 && (!idbProducts || idbProducts.length === 0)) {
          await idb.set('palletizer_products', localProducts);
        }

        // 3. Camadas de Palete
        const localLayersStr = safeStorage.getItem('palletizer_layers');
        const localLayers = localLayersStr ? JSON.parse(localLayersStr) : [];
        const idbLayers = await idb.get<any[]>('palletizer_layers');
        
        if (idbLayers && idbLayers.length > 0 && (!localLayers || localLayers.length === 0)) {
          setPalletLayers(idbLayers);
          safeStorage.setItem('palletizer_layers', JSON.stringify(idbLayers));
        } else if (localLayers && localLayers.length > 0 && (!idbLayers || idbLayers.length === 0)) {
          await idb.set('palletizer_layers', localLayers);
        }

        // 4. Empilhamento
        const localStackingStr = safeStorage.getItem('palletizer_allow_stacking');
        const localStacking = localStackingStr ? JSON.parse(localStackingStr) === true : false;
        const idbStacking = await idb.get<boolean>('palletizer_allow_stacking');
        
        if (idbStacking !== null && !localStacking) {
          setAllowStacking(idbStacking);
          safeStorage.setItem('palletizer_allow_stacking', JSON.stringify(idbStacking));
        } else if (localStacking && idbStacking === null) {
          await idb.set('palletizer_allow_stacking', localStacking);
        }
      } catch (e) {
        console.error("Erro ao sincronizar com IndexedDB:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    restoreFromDB();
  }, []);

  // Efeitos para salvar os dados sempre que houver alteração (somente após carregamento inicial completo)
  React.useEffect(() => {
    if (!isLoaded) return;
    safeStorage.setItem('palletizer_products', JSON.stringify(chosenProducts));
    idb.set('palletizer_products', chosenProducts);
  }, [chosenProducts, isLoaded]);

  React.useEffect(() => {
    if (!isLoaded) return;
    safeStorage.setItem('palletizer_layers', JSON.stringify(palletLayers));
    idb.set('palletizer_layers', palletLayers);
  }, [palletLayers, isLoaded]);

  React.useEffect(() => {
    if (!isLoaded) return;
    safeStorage.setItem('palletizer_allow_stacking', JSON.stringify(allowStacking));
    idb.set('palletizer_allow_stacking', allowStacking);
  }, [allowStacking, isLoaded]);

  React.useEffect(() => {
    if (!isLoaded) return;
    safeStorage.setItem('palletizer_history', JSON.stringify(history));
    idb.set('palletizer_history', history);
  }, [history, isLoaded]);

  React.useEffect(() => {
    safeStorage.setItem('palletizer_timer_active', JSON.stringify(timerActive));
  }, [timerActive]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive) {
      let startTimeStr = safeStorage.getItem('palletizer_timer_start');
      if (!startTimeStr) {
        startTimeStr = Date.now().toString();
        safeStorage.setItem('palletizer_timer_start', startTimeStr);
      }
      const startTime = parseInt(startTimeStr, 10);

      const updateElapsed = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimeElapsed(elapsed > 0 ? elapsed : 0);
      };

      // Atualiza imediatamente
      updateElapsed();

      interval = setInterval(updateElapsed, 1000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          updateElapsed();
        }
      };

      window.addEventListener('focus', updateElapsed);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (interval) clearInterval(interval);
        window.removeEventListener('focus', updateElapsed);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      setTimeElapsed(0);
    }
  }, [timerActive]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClearHistory = () => {
    setHistory([]);
    setConfirmClear(false);
  };

  const exportBackup = () => {
    try {
      const backupData = {
        history,
        chosenProducts,
        palletLayers,
        allowStacking,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_paletizador_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Erro ao exportar backup", e);
    }
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = e.target?.result as string;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          let importedAny = false;
          if (Array.isArray(parsed.history)) {
            setHistory(parsed.history);
            safeStorage.setItem('palletizer_history', JSON.stringify(parsed.history));
            await idb.set('palletizer_history', parsed.history);
            importedAny = true;
          }
          if (Array.isArray(parsed.chosenProducts)) {
            setChosenProducts(parsed.chosenProducts);
            safeStorage.setItem('palletizer_products', JSON.stringify(parsed.chosenProducts));
            await idb.set('palletizer_products', parsed.chosenProducts);
            importedAny = true;
          }
          if (Array.isArray(parsed.palletLayers)) {
            setPalletLayers(parsed.palletLayers);
            safeStorage.setItem('palletizer_layers', JSON.stringify(parsed.palletLayers));
            await idb.set('palletizer_layers', parsed.palletLayers);
            importedAny = true;
          }
          if (typeof parsed.allowStacking === 'boolean') {
            setAllowStacking(parsed.allowStacking);
            safeStorage.setItem('palletizer_allow_stacking', JSON.stringify(parsed.allowStacking));
            await idb.set('palletizer_allow_stacking', parsed.allowStacking);
            importedAny = true;
          }

          if (importedAny) {
            showToast("Backup do paletizador importado e restaurado com sucesso!", "success");
          } else {
            showToast("Nenhum dado compatível encontrado no arquivo.", "error");
          }
        }
      } catch (err) {
        showToast("Erro ao ler o arquivo de backup de dados.", "error");
      }
    };
    reader.readAsText(file);
  };

  const activePalletStats = useMemo(() => {
    if (palletLayers.length === 0) return { skusCount: 0, totalFardos: 0 };
    
    const uniqueSkus = new Set<string>();
    let totalFardos = 0;
    
    palletLayers.forEach(layer => {
      layer.itens.forEach(item => {
        uniqueSkus.add(item.nome);
        totalFardos += item.qtdUsada;
      });
    });
    
    return {
      skusCount: uniqueSkus.size,
      totalFardos
    };
  }, [palletLayers]);

  const handleFinalizePallet = () => {
    if (palletLayers.length === 0) return;
    
    const formattedTime = formatTime(timeElapsed);
    
    const newEntry: PalletHistoryEntry = {
      id: `${Date.now()}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      skusCount: activePalletStats.skusCount,
      totalFardos: activePalletStats.totalFardos,
      timeTaken: formattedTime,
      layersCount: palletLayers.length
    };
    
    setHistory(prev => [newEntry, ...prev]);
    setIsHistoryOpen(true);
    
    setTimerActive(false);
    setTimeElapsed(0);
    safeStorage.removeItem('palletizer_timer_start');
    safeStorage.setItem('palletizer_timer_active', 'false');
    
    showToast("Palete Finalizado e Salvo com Sucesso no Histórico!", "success");
  };

  const handleAddProducts = () => {
    const entries = inputCodes.split(/[\s,;]+/).filter(e => e.trim() !== "");
    if (entries.length === 0) return;

    const notFound: string[] = [];
    const newProducts: ChosenProduct[] = [];

    entries.forEach(entry => {
      // Suporta formato CÓDIGO ou CÓDIGO:QUANTIDADE
      const [code, qtdStr] = entry.split(':');
      const qtd = qtdStr ? parseInt(qtdStr) : 0;

      if (PRODUCT_DB[code]) {
        newProducts.push({
          ...PRODUCT_DB[code],
          codOriginal: code,
          idUnico: `${Date.now()}-${Math.random()}`,
          qtd: isNaN(qtd) ? 0 : qtd
        });
      } else {
        if (!notFound.includes(code)) notFound.push(code);
      }
    });

    if (notFound.length > 0) {
      setError(`CÓDIGO NÃO ENCONTRADO: ${notFound.join(", ")}`);
      setTimeout(() => setError(null), 5000);
    }

    setChosenProducts(prev => [...prev, ...newProducts]);
    setInputCodes('');
  };

  const handleRemoveProduct = (id: string) => {
    setChosenProducts(prev => prev.filter(p => p.idUnico !== id));
  };

  const handleUpdateQtd = (id: string, qtd: number) => {
    setChosenProducts(prev => prev.map(p => 
      p.idUnico === id ? { ...p, qtd: Math.max(0, qtd) } : p
    ));
  };

  const handleLoadTestPallet = () => {
    try {
      const keys = Object.keys(PRODUCT_DB);
      if (keys.length < 40) {
        showToast("Erro: Banco de dados com menos de 40 SKUs cadastrados.", "error");
        return;
      }
      
      // Select 40 different product keys
      const selectedKeys = keys.slice(0, 40);
      
      // We want EXACTLY 40 SKUs and EXACTLY 110 fardos total.
      // 30 products with 3 fardos each (30 * 3 = 90 fardos)
      // 10 products with 2 fardos each (10 * 2 = 20 fardos)
      // Total = 90 + 20 = 110 fardos.
      const testProducts: ChosenProduct[] = selectedKeys.map((code, index) => {
        const qtd = index < 30 ? 3 : 2;
        return {
          ...PRODUCT_DB[code],
          codOriginal: code,
          idUnico: `test-${code}-${index}-${Date.now()}`,
          qtd: qtd
        };
      });
      
      setChosenProducts(testProducts);
      // Generate the pallet with these products immediately so the user can see it!
      generatePallet(testProducts);
      showToast("Carga de Teste (40 SKUs, 110 Fardos) carregada e gerada com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar a carga de teste.", "error");
    }
  };

  const handleLoadComplexTestPallet = () => {
    try {
      const keys = Object.keys(PRODUCT_DB);
      if (keys.length < 50) {
        showToast("Erro: Banco de dados com menos de 50 SKUs cadastrados.", "error");
        return;
      }
      
      // Let's filter out tall items (altura 30) and short stackable items (altura 15)
      const tallKeys = keys.filter(k => PRODUCT_DB[k].altura === 30);
      const shortKeys = keys.filter(k => PRODUCT_DB[k].altura === 15);
      const otherKeys = keys.filter(k => PRODUCT_DB[k].altura !== 30 && PRODUCT_DB[k].altura !== 15);

      // Select up to 10 tall keys (bases for stacking)
      const selectedTall = tallKeys.slice(0, 10);
      // Select up to 15 short keys (stackable items)
      const selectedShort = shortKeys.slice(0, 15);
      
      // Combine and pad up to exactly 50 SKUs
      const selectedSet = new Set([...selectedTall, ...selectedShort]);
      let otherIndex = 0;
      while (selectedSet.size < 50 && otherIndex < otherKeys.length) {
        selectedSet.add(otherKeys[otherIndex]);
        otherIndex++;
      }
      
      // Safety check to ensure we have exactly 50 SKUs
      if (selectedSet.size < 50) {
        for (const k of keys) {
          selectedSet.add(k);
          if (selectedSet.size === 50) break;
        }
      }

      const finalKeys = Array.from(selectedSet).slice(0, 50);

      // 10 items with 3 fardos (30 fardos)
      // 40 items with 2 fardos (80 fardos)
      // Total: 110 fardos, exactly 50 SKUs!
      const testProducts: ChosenProduct[] = finalKeys.map((code, index) => {
        const qtd = index < 10 ? 3 : 2;
        return {
          ...PRODUCT_DB[code],
          codOriginal: code,
          idUnico: `complex-test-${code}-${index}-${Date.now()}`,
          qtd: qtd
        };
      });

      // Enable stacking state
      setAllowStacking(true);
      safeStorage.setItem('palletizer_allow_stacking', JSON.stringify(true));
      idb.set('palletizer_allow_stacking', true);

      setChosenProducts(testProducts);
      // Generate immediate pallet passing the override true for allowStacking
      generatePallet(testProducts, true);
      showToast("Carga de Teste Complexa (50 SKUs, 110 Fardos com Empilhamento) carregada e gerada com sucesso!", "success");
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar a carga de teste complexa.", "error");
    }
  };

  const handleClearAll = () => {
    setChosenProducts([]);
    setPalletLayers([]);
    setInputCodes('');
    setTimerActive(false);
    setTimeElapsed(0);
    safeStorage.removeItem('palletizer_timer_start');
    safeStorage.setItem('palletizer_timer_active', 'false');
  };

  const toggleLayerCompletion = (layerId: string) => {
    setPalletLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer;
      const nextCompleted = !layer.completed;
      return {
        ...layer,
        completed: nextCompleted,
        itens: layer.itens.map(item => ({
          ...item,
          checked: nextCompleted
        }))
      };
    }));
  };

  const toggleProductChecked = (layerId: string, itemKey: string) => {
    setPalletLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer;

      const groupItems = layer.itens.filter(item => `${item.nome}-${item.stack}` === itemKey);
      const isCurrentlyGroupChecked = groupItems.every(item => item.checked);

      const newItens = layer.itens.map(item => {
        if (`${item.nome}-${item.stack}` === itemKey) {
          return { ...item, checked: !isCurrentlyGroupChecked };
        }
        return item;
      });

      const allChecked = newItens.every(item => item.checked);

      return {
        ...layer,
        itens: newItens,
        completed: allChecked
      };
    }));
  };

  const handleUpdateLayerItemQtd = (layerId: string, itemKey: string, newQtd: number) => {
    setPalletLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer;

      const newItens = layer.itens.map(item => {
        const key = `${item.nome}-${item.stack}`;
        if (key === itemKey) {
          let adjustedQtd = Math.max(0, newQtd);
          if (item.stack === "2x" && adjustedQtd > 0) {
            adjustedQtd = Math.ceil(adjustedQtd / 2) * 2;
          }
          return { ...item, qtdUsada: adjustedQtd };
        }
        return item;
      }).filter(item => item.qtdUsada > 0);

      const percentual = newItens.reduce((sum, item) => {
        const slots = item.stack === "2x" ? Math.ceil(item.qtdUsada / 2) : item.qtdUsada;
        return sum + (slots * item.percFardo);
      }, 0);
      const altura = newItens.length > 0 
        ? Math.max(...newItens.map(item => item.stack === "2x" ? item.altura * 2 : item.altura))
        : 0;

      return {
        ...layer,
        itens: newItens,
        percentual,
        altura
      };
    }).filter(layer => layer.itens.length > 0)); // Remove empty layers
  };

  const handleToggleLayerItemStack = (layerId: string, itemKey: string) => {
    setPalletLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer;

      const itemToToggle = layer.itens.find(item => `${item.nome}-${item.stack}` === itemKey);
      if (!itemToToggle) return layer;

      const isCurrentlyStacked = itemToToggle.stack === "2x";
      const newStack = isCurrentlyStacked ? "" : "2x";
      
      let newQtd = itemToToggle.qtdUsada;
      if (newStack === "2x") {
        newQtd = Math.max(2, Math.ceil(newQtd / 2) * 2);
      }

      const newItens = layer.itens.map(item => {
        if (`${item.nome}-${item.stack}` === itemKey) {
          return { ...item, stack: newStack, qtdUsada: newQtd };
        }
        return item;
      });

      // Merge duplicates if any
      const mergedItens: PalletItem[] = [];
      newItens.forEach(item => {
        const existing = mergedItens.find(it => it.nome === item.nome && it.stack === item.stack);
        if (existing) {
          existing.qtdUsada += item.qtdUsada;
        } else {
          mergedItens.push({ ...item });
        }
      });

      const percentual = mergedItens.reduce((sum, item) => {
        const slots = item.stack === "2x" ? Math.ceil(item.qtdUsada / 2) : item.qtdUsada;
        return sum + (slots * item.percFardo);
      }, 0);

      const altura = mergedItens.length > 0 
        ? Math.max(...mergedItens.map(item => item.stack === "2x" ? item.altura * 2 : item.altura))
        : 0;

      return {
        ...layer,
        itens: mergedItens,
        percentual,
        altura
      };
    }));
  };

  const handleMoveLayerProduct = (
    sourceLayerId: string, 
    targetLayerId: string, 
    itemKey: string, 
    qtyToMove: number,
    targetStack?: string
  ) => {
    if (sourceLayerId === targetLayerId || qtyToMove <= 0) return;

    setPalletLayers(prev => {
      const sourceLayer = prev.find(l => l.id === sourceLayerId);
      if (!sourceLayer) return prev;

      const sourceItem = sourceLayer.itens.find(item => `${item.nome}-${item.stack}` === itemKey);
      if (!sourceItem) return prev;

      const actualQtyToMove = Math.min(qtyToMove, sourceItem.qtdUsada);

      let updatedLayers = [...prev];
      let finalTargetId = targetLayerId;

      if (targetLayerId === 'new') {
        const newLayerId = `${Date.now()}-new-layer`;
        const newLayer: PalletLayer = {
          id: newLayerId,
          percentual: 0,
          itens: [],
          altura: 0,
          completed: false
        };
        updatedLayers = [...updatedLayers, newLayer];
        finalTargetId = newLayerId;
      }

      const targetLayer = updatedLayers.find(l => l.id === finalTargetId);
      if (!targetLayer) return prev;

      return updatedLayers.map(layer => {
        if (layer.id === sourceLayerId) {
          const newItens = layer.itens.map(item => {
            if (`${item.nome}-${item.stack}` === itemKey) {
              return { ...item, qtdUsada: item.qtdUsada - actualQtyToMove };
            }
            return item;
          }).filter(item => item.qtdUsada > 0);

          const percentual = newItens.reduce((sum, item) => {
            const slots = item.stack === "2x" ? Math.ceil(item.qtdUsada / 2) : item.qtdUsada;
            return sum + (slots * item.percFardo);
          }, 0);
          const altura = newItens.length > 0 
            ? Math.max(...newItens.map(item => item.stack === "2x" ? item.altura * 2 : item.altura))
            : 0;

          return {
            ...layer,
            itens: newItens,
            percentual,
            altura
          };
        }

        if (layer.id === finalTargetId) {
          let itemExistsInTarget = false;
          const resolvedTargetStack = targetStack !== undefined ? targetStack : sourceItem.stack;

          let newItens = layer.itens.map(item => {
            if (item.nome === sourceItem.nome && item.stack === resolvedTargetStack) {
              itemExistsInTarget = true;
              return { ...item, qtdUsada: item.qtdUsada + actualQtyToMove };
            }
            return item;
          });

          if (!itemExistsInTarget) {
            const newItem: PalletItem = {
              ...sourceItem,
              stack: resolvedTargetStack,
              qtdUsada: actualQtyToMove,
              checked: false
            };
            newItens = [...newItens, newItem];
          }

          const percentual = newItens.reduce((sum, item) => {
            const slots = item.stack === "2x" ? Math.ceil(item.qtdUsada / 2) : item.qtdUsada;
            return sum + (slots * item.percFardo);
          }, 0);
          const altura = newItens.length > 0 
            ? Math.max(...newItens.map(item => item.stack === "2x" ? item.altura * 2 : item.altura))
            : 0;

          return {
            ...layer,
            itens: newItens,
            percentual,
            altura
          };
        }

        return layer;
      }).filter(layer => layer.itens.length > 0); // Purge empty layers
    });
  };

  const optimizeAndMergeLayers = (layersList: PalletLayer[]): PalletLayer[] => {
    if (layersList.length <= 1) return layersList;

    // Helper to merge items of the same product in a layer's items list
    const mergeDuplicateItens = (itens: PalletItem[]): PalletItem[] => {
      const merged: PalletItem[] = [];
      itens.forEach(item => {
        const existing = merged.find(it => it.idUnico === item.idUnico && it.stack === item.stack);
        if (existing) {
          existing.qtdUsada += item.qtdUsada;
        } else {
          merged.push({ ...item });
        }
      });
      return merged;
    };

    // Clone layers to avoid direct state mutation during calculations
    let list = layersList.map(l => ({ 
      ...l, 
      itens: l.itens.map(it => ({ ...it })) 
    }));

    // Stage 1: Try to merge layers with very close heights first (difference <= 1)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const layerA = list[i];
        const layerB = list[j];
        const heightDiff = Math.abs(layerA.altura - layerB.altura);
        
        if (heightDiff <= 1) {
          if (layerA.percentual + layerB.percentual <= 100.5) {
            // Merge layerB into layerA
            const mergedItens = mergeDuplicateItens([...layerA.itens, ...layerB.itens]);
            layerA.itens = mergedItens;
            layerA.percentual = mergedItens.reduce((sum, item) => {
              const slots = item.stack === "2x" ? Math.ceil(item.qtdUsada / 2) : item.qtdUsada;
              return sum + (slots * item.percFardo);
            }, 0);
            layerA.altura = Math.max(layerA.altura, layerB.altura);
            // Remove layerB
            list.splice(j, 1);
            j--; // Adjust index
          }
        }
      }
    }

    // Stage 2: Merge any remaining layers regardless of height differences
    // to minimize fragmented layers (camadas quebradas) at the top of the pallet!
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const layerA = list[i];
        const layerB = list[j];
        
        if (layerA.percentual + layerB.percentual <= 100.5) {
          // Merge layerB into layerA
          const mergedItens = mergeDuplicateItens([...layerA.itens, ...layerB.itens]);
          layerA.itens = mergedItens;
          layerA.percentual = mergedItens.reduce((sum, item) => {
            const slots = item.stack === "2x" ? Math.ceil(item.qtdUsada / 2) : item.qtdUsada;
            return sum + (slots * item.percFardo);
          }, 0);
          layerA.altura = Math.max(layerA.altura, layerB.altura);
          // Remove layerB
          list.splice(j, 1);
          j--; // Adjust index
        }
      }
    }

    return list;
  };

  const generatePallet = (customProducts?: ChosenProduct[] | React.MouseEvent, overrideAllowStacking?: boolean) => {
    const productsToUse = Array.isArray(customProducts) ? customProducts : chosenProducts;
    const useStacking = typeof overrideAllowStacking === 'boolean' ? overrideAllowStacking : allowStacking;
    const validItems = productsToUse.filter(p => p.qtd > 0);
    if (validItems.length === 0) {
      setError("Insira a quantidade de fardos para pelo menos um produto!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Clone and prepare items for processing
    let itemsToProcess = validItems.map(item => ({ ...item, qtdRestante: item.qtd }));
    const layers: PalletLayer[] = [];

    while (itemsToProcess.some(i => i.qtdRestante > 0)) {
      const available = itemsToProcess
        .filter(i => i.qtdRestante > 0)
        .sort((a, b) => {
          if (b.altura !== a.altura) {
            return b.altura - a.altura; // Sort by height descending
          }
          return b.qtdRestante - a.qtdRestante; // Secondary sort by remaining quantity descending
        });
      if (available.length === 0) break;

      const base = available[0];
      const capacity = Math.round(100 / base.percFardo);
      
      // Base product is never stacked on its own (always flat, defining the layer height)
      const effectiveHeight = base.altura;

      const currentLayer: PalletLayer = { 
        id: `${Date.now()}-${layers.length}`, 
        percentual: 0, 
        itens: [], 
        altura: effectiveHeight, 
        completed: false 
      };

      // Fill with base product
      const maxLayerQty = capacity;
      const unitsToUse = Math.min(base.qtdRestante, maxLayerQty);
      
      if (unitsToUse > 0) {
        currentLayer.itens.push({ ...base, qtdUsada: unitsToUse, stack: "" });
        const slotsOccupied = unitsToUse;
        currentLayer.percentual += slotsOccupied * base.percFardo;
        base.qtdRestante -= unitsToUse;
      }

      // Fill remaining space with compatible items
      if (currentLayer.percentual < 99.9) {
        for (const item of itemsToProcess) {
          if (item.qtdRestante <= 0 || item.idUnico === base.idUnico) continue;
          
          const isCompatible = Math.abs(item.altura - effectiveHeight) <= 1;
          const isStackableCompatible = useStacking && 
            (item.altura <= 15) && 
            (Math.abs(item.altura * 2 - effectiveHeight) <= 1) && 
            item.qtdRestante >= 2;

          if (isCompatible || isStackableCompatible) {
            const spaceLeft = 100.5 - currentLayer.percentual;
            const itemCapacity = Math.floor((spaceLeft / item.percFardo) + 0.001);
            const maxCompatibleQty = isStackableCompatible ? itemCapacity * 2 : itemCapacity;
            let toUse = Math.min(item.qtdRestante, maxCompatibleQty);
            if (isStackableCompatible) {
              toUse = Math.floor(toUse / 2) * 2;
            }
            
            if (toUse > 0) {
              currentLayer.itens.push({ ...item, qtdUsada: toUse, stack: isStackableCompatible ? "2x" : "" });
              const slotsUsed = isStackableCompatible ? Math.ceil(toUse / 2) : toUse;
              currentLayer.percentual += slotsUsed * item.percFardo;
              item.qtdRestante -= toUse;
            }
          }
          if (currentLayer.percentual >= 99.9) break;
        }
      }

      if (currentLayer.itens.length > 0) {
        layers.push(currentLayer);
      } else {
        break;
      }
    }

    // Group and optimize low-percentage layers together
    const optimizedLayers = optimizeAndMergeLayers(layers);

    // Sort layers: fullest at bottom for stability
    optimizedLayers.sort((a, b) => b.percentual - a.percentual);
    setPalletLayers(optimizedLayers);

    // Start/Restart assembly time counter
    safeStorage.setItem('palletizer_timer_start', Date.now().toString());
    safeStorage.setItem('palletizer_timer_active', 'true');
    setTimeElapsed(0);
    setTimerActive(true);
  };

  const handleScanImage = async (base64Image: string) => {
    setIsScanning(true);
    setScanningStatus("Enviando para processamento...");
    let useClientFallback = false;
    let fallbackReason = "";

    try {
      let response;
      try {
        response = await fetch('/api/scan-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ base64Image })
        });
      } catch (fetchErr: any) {
        console.warn("Falha ao se conectar à API do servidor. Usando fallback local:", fetchErr);
        useClientFallback = true;
        fallbackReason = "Servidor offline ou ambiente estático (como GitHub Pages) detectado.";
      }

      if (!useClientFallback && response) {
        if (response.status === 404) {
          useClientFallback = true;
          fallbackReason = "O endpoint /api/scan-image não existe neste servidor (ambiente estático).";
        } else if (!response.ok) {
          let errorMsg = "";
          try {
            const rawText = await response.text();
            try {
              const errData = JSON.parse(rawText);
              errorMsg = errData.error || `Erro do servidor (Código ${response.status})`;
            } catch {
              errorMsg = rawText || `Erro do servidor (Código ${response.status})`;
            }
          } catch (readErr: any) {
            errorMsg = `Erro do servidor (Código ${response.status})`;
          }
          console.warn("Erro ao usar API de IA para OCR, usando fallback local:", errorMsg);
          useClientFallback = true;
          fallbackReason = `Erro do servidor (${errorMsg}). Ativando processamento local.`;
          showToast("Servidor sem chave Gemini. Usando leitor local...", "warning");
        } else {
          const data = await response.json();
          const recognizedText = data.recognizedText || "";
          
          if (recognizedText) {
            setInputCodes(prev => prev ? `${prev} ${recognizedText}` : recognizedText);
            showToast("Imagem processada via IA (Gemini)!", "success");
          } else {
            setError("Nenhum código ou quantidade reconhecida na imagem.");
            setTimeout(() => setError(null), 4000);
          }
        }
      }

      if (useClientFallback) {
        console.log(`Iniciando OCR local devido a: ${fallbackReason}`);
        setScanningStatus("Iniciando leitor local no seu navegador...");
        showToast("Processando imagem localmente no seu navegador...", "info");
        
        const result = await Tesseract.recognize(
          base64Image, 
          'por+eng',
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                const percent = Math.round(m.progress * 100);
                setScanningStatus(`Lendo papel localmente: ${percent}%`);
              } else if (m.status === 'loading tesseract api' || m.status === 'initializing api') {
                setScanningStatus("Carregando leitor inteligente...");
              } else {
                setScanningStatus("Processando caracteres...");
              }
            }
          }
        );
        const text = result.data.text;
        console.log("Texto bruto extraído pelo Tesseract:", text);

        // EXTRAÇÃO INTELIGENTE COM TRATAMENTO DE ERROS DE OCR E ESPAÇAMENTO
        const firstDigitLikes = "0123456789OoIl|!SsBbGgZzAaTtHh";
        const digitLikes = "0123456789OoIl|!SsBbGgZzAaTtHh";
        const separators = " .-_/\t";
        const ocrResults: { code: string; quantity: number; index: number }[] = [];

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (firstDigitLikes.indexOf(char) !== -1) {
            let candidateStr = char;
            let j = i + 1;
            let digitLikesCount = 1;

            while (j < text.length && candidateStr.length < 18 && digitLikesCount < 9) {
              const nextChar = text[j];
              if (digitLikes.indexOf(nextChar) !== -1) {
                candidateStr += nextChar;
                digitLikesCount++;
                j++;
              } else if (separators.indexOf(nextChar) !== -1) {
                candidateStr += nextChar;
                j++;
              } else {
                break;
              }
            }

            if (digitLikesCount === 9) {
              let cleaned = "";
              for (const c of candidateStr) {
                if (digitLikes.indexOf(c) !== -1) {
                  let mapped = c;
                  if (c === 'O' || c === 'o') mapped = '0';
                  else if (c === 'I' || c === 'l' || c === '|' || c === '!') mapped = '1';
                  else if (c === 'S' || c === 's') mapped = '5';
                  else if (c === 'B' || c === 'b') mapped = '8';
                  else if (c === 'G' || c === 'g') mapped = '6';
                  else if (c === 'Z' || c === 'z') mapped = '2';
                  else if (c === 'A' || c === 'a') mapped = '4';
                  else if (c === 'T' || c === 't') mapped = '1';
                  else if (c === 'H' || c === 'h') mapped = '4';

                  if (mapped >= '0' && mapped <= '9') {
                    cleaned += mapped;
                  }
                }
              }

              if (cleaned.length === 9) {
                if (cleaned.startsWith('1') || cleaned.startsWith('4') || PRODUCT_DB[cleaned]) {
                  const followingText = text.substring(j, Math.min(text.length, j + 50));
                  let quantity = 0;

                  const explicitMatch = followingText.match(/(?::|x|X|-|\bsl\b|\bqtd\b|\bqtd:\b|\bqty\b|\bqty:\b)\s*\(?(\d{1,4})\)?/i);
                  if (explicitMatch && explicitMatch[1]) {
                    const val = parseInt(explicitMatch[1], 10);
                    if (val > 0 && val < 5000) {
                      quantity = val;
                    }
                  } else {
                    const anyNumberMatch = followingText.match(/\b(\d{1,4})\b/);
                    if (anyNumberMatch && anyNumberMatch[1]) {
                      const val = parseInt(anyNumberMatch[1], 10);
                      if (val > 0 && val < 5000) {
                        quantity = val;
                      }
                    }
                  }

                  if (!ocrResults.some(r => r.code === cleaned && Math.abs(r.index - i) < 15)) {
                    ocrResults.push({ code: cleaned, quantity, index: i });
                  }
                  i = j - 1;
                }
              }
            }
          }
        }

        console.log("Resultados da extração inteligente local:", ocrResults);
        let recognizedText = ocrResults.map(r => `${r.code}:${r.quantity}`).join(' ');

        if (recognizedText) {
          setInputCodes(prev => prev ? `${prev} ${recognizedText}` : recognizedText);
          showToast("Imagem processada localmente com sucesso!", "success");
        } else {
          setError("Não foi possível identificar nenhum código de 9 dígitos nesta imagem. Verifique a iluminação e legibilidade do papel.");
          setTimeout(() => setError(null), 8000);
        }
      }

    } catch (err: any) {
      console.error("Erro no reconhecimento de imagem:", err);
      setError(err.message || "Erro ao processar imagem. Tente novamente.");
      setTimeout(() => setError(null), 10000);
    } finally {
      setIsScanning(false);
      setIsCameraOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-4 md:p-8">
      {/* Custom Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-bold pointer-events-auto backdrop-blur-md max-w-md w-max"
            style={{
              backgroundColor: toast.type === 'success' ? 'rgba(236, 253, 245, 0.95)' : toast.type === 'error' ? 'rgba(254, 242, 242, 0.95)' : 'rgba(239, 246, 255, 0.95)',
              borderColor: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#dc2626' : '#2563eb',
              color: toast.type === 'success' ? '#065f46' : toast.type === 'error' ? '#991b1b' : '#1e3a8a'
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            ) : toast.type === 'error' ? (
              <span className="bg-red-500 text-white rounded-full p-0.5"><X size={12} className="shrink-0" /></span>
            ) : (
              <Info size={18} className="text-blue-500 shrink-0" />
            )}
            <span className="leading-tight">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="flex items-center gap-2">
                <Layers className="text-indigo-600" />
                Paletizador Inteligente
              </span>
              <button 
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/60 rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-1.5 shrink-0"
                title="Ver resumos de paletes salvos"
              >
                <History size={14} />
                Histórico
                {history.length > 0 && (
                  <span className="bg-indigo-600 text-white rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-black leading-none">
                    {history.length}
                  </span>
                )}
              </button>
            </h1>
            <p className="text-slate-500">Otimização de carregamento e logística de fardos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
            <button 
              onClick={handleLoadComplexTestPallet}
              className="px-4 py-2 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors flex items-center gap-2 shadow-sm"
              title="Carregar carga de teste complexa com 50 SKUs, 110 fardos e recurso de empilhamento duplo ativo"
            >
              <Layers size={16} className="text-violet-600 animate-pulse" />
              Teste de Empilhamento (50 SKUs - 110 Fardos)
            </button>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2 shadow-sm"
              title="Compartilhar aplicativo ou este palete configurado"
            >
              <Share2 size={16} className="text-indigo-600" />
              Compartilhar
            </button>
            <button 
              onClick={handleClearAll}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Limpar Tudo
            </button>
          </div>
        </header>

        {/* Input Card */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
            <Plus size={20} />
            <h2>Adicionar Produtos</h2>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <textarea 
                value={inputCodes}
                onChange={(e) => {
                  setInputCodes(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Cole os códigos aqui (ex: 100002199:14 100002202:7)"
                className={`w-full h-24 p-4 rounded-xl transition-all resize-none outline-none border-2 ${
                  error 
                  ? 'border-red-400 bg-red-50 focus:ring-red-500' 
                  : 'bg-slate-50 border-slate-200 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <label 
                  htmlFor="file-upload-scanner" 
                  className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors cursor-pointer"
                  title="Enviar foto ou imagem do celular"
                >
                  <Upload size={20} />
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = reader.result as string;
                        await handleScanImage(base64);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                  id="file-upload-scanner"
                />
                <button 
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                  title="Escanear com a câmera"
                >
                  <Camera size={20} />
                </button>
              </div>
            </div>
            <button 
              onClick={handleAddProducts}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
            >
              Adicionar à Lista
            </button>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-start gap-2 p-4 bg-red-100 border border-red-200 text-red-700 rounded-xl text-sm font-medium shadow-sm"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Atenção!</p>
                  <p>{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* List Section */}
        <AnimatePresence>
          {chosenProducts.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="p-6 border-bottom border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Package size={20} className="text-slate-400" />
                  Produtos na Fila ({chosenProducts.length})
                </h3>
              </div>
              
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {chosenProducts.map((product) => (
                  <div key={product.idUnico} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-semibold text-slate-800 text-xs md:text-sm truncate" title={product.nome}>{product.nome}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span 
                          className="px-2 py-0.5 rounded font-black text-white shrink-0 text-[11px]"
                          style={{ backgroundColor: getClassColor(product) }}
                        >
                          {getItemClass(product) || product.classe}
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded">Alt: {product.altura}cm</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded">Fardos/Camada: {Math.round(100/product.percFardo)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Qtd Fardos</label>
                        <input 
                          type="number" 
                          value={product.qtd || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handleUpdateQtd(product.idUnico, isNaN(val) ? 0 : val);
                          }}
                          className="w-20 p-2 text-center font-bold bg-white border-2 border-indigo-100 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                        />
                      </div>
                      <button 
                        onClick={() => handleRemoveProduct(product.idUnico)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Permitir Empilhamento Duplo (2x)</p>
                    <p className="text-[10px] text-slate-400">Empilha fardos baixos (≤ 15cm) para economizar espaço se houver quantidade suficiente.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={allowStacking}
                      onChange={(e) => setAllowStacking(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="w-full">
                  <button 
                    onClick={generatePallet}
                    className="w-full py-4 bg-emerald-600 text-white font-black text-lg rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-3"
                  >
                    <Play size={24} fill="currentColor" />
                    GERAR PALETE
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Camera Modal */}
        <AnimatePresence>
          {isCameraOpen && (
            <CameraModal 
              onClose={() => setIsCameraOpen(false)} 
              onCapture={handleScanImage}
              isScanning={isScanning}
              scanningStatus={scanningStatus}
              onError={(msg) => {
                setError(msg);
                setTimeout(() => setError(null), 6000);
              }}
            />
          )}
        </AnimatePresence>

        {/* 3D Preview Modal */}
        <AnimatePresence>
          {is3DModalOpen && (
            <Pallet3DModal 
              layers={palletLayers} 
              onClose={() => setIs3DModalOpen(false)} 
            />
          )}
        </AnimatePresence>

         {/* Layer Configuration Modal */}
        <AnimatePresence>
          {configuringLayer && (
            <LayerConfigModal 
              layer={configuringLayer}
              layers={palletLayers}
              onClose={() => setConfiguringLayerId(null)}
              onUpdateQtd={handleUpdateLayerItemQtd}
              onMoveProduct={handleMoveLayerProduct}
              onToggleStack={handleToggleLayerItemStack}
            />
          )}
        </AnimatePresence>

        {/* Results Section */}
        {palletLayers.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xl">
                <ChevronRight className="text-indigo-600" />
                Palete Gerado ({palletLayers.length} Camadas)
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <button 
                  onClick={() => setIs3DModalOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-emerald-600 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                  <BoxIcon size={16} />
                  Visualizar 3D
                </button>
                <button 
                  onClick={() => {
                    const summary = palletLayers.map((l, i) => {
                      const items = Object.values(l.itens.reduce((acc: any, item) => {
                        const key = `${item.nome}-${item.stack}`;
                        if (!acc[key]) acc[key] = { ...item, totalQtd: 0 };
                        acc[key].totalQtd += item.qtdUsada;
                        return acc;
                      }, {})).map((item: any) => 
                        `- ${item.nome}: ${item.stack === "2x" ? `${item.totalQtd / 2} Fardos (Empilhados)` : `${item.totalQtd} Fardos`}`
                      ).join('\n');
                      return `CAMADA ${i + 1} (${l.percentual.toFixed(1)}% - ${l.altura}cm):\n${items}`;
                    }).join('\n\n');
                    
                    const totalHeight = palletLayers.reduce((acc, l) => acc + l.altura, 0);
                    const totalFardos = palletLayers.reduce((acc, l) => acc + l.itens.reduce((sum, i) => sum + i.qtdUsada, 0), 0);
                    const fullText = `RESUMO DO PALETE:\nTotal de Camadas: ${palletLayers.length}\nAltura Total: ${totalHeight}cm\nTotal de Fardos: ${totalFardos}\n\n${summary}`;
                    
                    try {
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(fullText);
                        showToast("Resumo copiado para a área de transferência!", "success");
                      } else {
                        throw new Error("Clipboard API not supported");
                      }
                    } catch (e) {
                      console.error("Clipboard copy failed", e);
                      showToast("Não foi possível copiar automaticamente. Use a seleção manual.", "error");
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"
                >
                  <Copy size={16} />
                  Copiar Resumo
                </button>
                {timerActive && (
                  <div className="bg-white px-4 py-2 rounded-xl border border-red-200 bg-red-50/5 shadow-sm flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-0.5">Tempo Montagem</p>
                      <p className="text-sm font-black font-mono text-red-600 leading-none">
                        {formatTime(timeElapsed)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Altura Total</p>
                  <p className="text-lg font-black text-indigo-600">
                    {palletLayers.reduce((acc, l) => acc + l.altura, 0)}cm
                  </p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Fardos</p>
                  <p className="text-lg font-black text-emerald-600">
                    {palletLayers.reduce((acc, l) => acc + l.itens.reduce((sum, i) => sum + i.qtdUsada, 0), 0)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {palletLayers.map((layer, idx) => (
                <motion.div 
                  key={layer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: layer.completed ? 0.6 : 1, 
                    y: 0,
                    scale: layer.completed ? 0.98 : 1
                  }}
                  transition={{ delay: idx * 0.1 }}
                  className={`bg-white border-2 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
                    layer.completed ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200'
                  }`}
                >
                  <div className={`p-4 flex justify-between items-center transition-colors ${
                    layer.completed ? 'bg-emerald-600' : 'bg-slate-900'
                  } text-white`}>
                    <div className="flex items-center gap-3">
                      <MiniLayer2D layer={layer} />
                      <div>
                        <span className="text-xs font-bold uppercase opacity-60">Camada</span>
                        <p className="text-xl font-black">{idx + 1}</p>
                      </div>
                      {layer.completed && (
                        <div className="bg-white/20 p-1 rounded-full">
                          <CheckCircle2 size={20} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase opacity-60">Ocupação</span>
                        <p className={`text-xl font-black ${
                          layer.completed ? 'text-white' : ''
                        }`} style={layer.completed ? {} : { color: getPercentColorStyle(layer.percentual) }}>
                          {layer.percentual.toFixed(1)}%
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setConfiguringLayerId(layer.id)}
                          className={`p-2 rounded-lg transition-all ${
                            layer.completed 
                            ? 'bg-emerald-700/50 text-white hover:bg-emerald-700' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                          title="Configurar Camada"
                        >
                          <MoreVertical size={20} />
                        </button>

                        <button 
                          onClick={() => toggleLayerCompletion(layer.id)}
                          className={`p-2 rounded-lg transition-all ${
                            layer.completed 
                            ? 'bg-white text-emerald-600 hover:bg-emerald-50' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                          title={layer.completed ? "Marcar como pendente" : "Marcar como concluída"}
                        >
                          <CheckCircle2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-4 flex items-center justify-between text-sm font-medium border-b transition-colors ${
                    layer.completed ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-indigo-50/50 text-indigo-700 border-indigo-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Info size={14} />
                      <span>Altura da Camada: <span className="font-bold">{layer.altura}cm</span></span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/60 text-slate-700 border border-slate-200/50">
                      {layer.itens.reduce((sum, item) => sum + item.qtdUsada, 0)} fardos
                    </span>
                  </div>

                  <div className={`p-4 space-y-3 transition-all ${layer.completed ? 'grayscale-[0.5]' : ''}`}>
                    {/* Grouping items for display */}
                    {Object.values(layer.itens.reduce((acc: any, item) => {
                      const key = `${item.nome}-${item.stack}`;
                      if (!acc[key]) acc[key] = { ...item, totalQtd: 0, allGroupChecked: true };
                      acc[key].totalQtd += item.qtdUsada;
                      if (!item.checked) {
                        acc[key].allGroupChecked = false;
                      }
                      return acc;
                    }, {})).map((item: any, iIdx) => {
                      const itemKey = `${item.nome}-${item.stack}`;
                      return (
                        <div 
                          key={iIdx} 
                          onClick={() => toggleProductChecked(layer.id, itemKey)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                            item.allGroupChecked 
                              ? 'bg-emerald-50/40 border-emerald-100 text-slate-500' 
                              : 'bg-white border-slate-100 hover:border-indigo-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Checkbox */}
                            <div className={`p-1 rounded-md transition-colors ${
                              item.allGroupChecked 
                                ? 'bg-emerald-100 text-emerald-600' 
                                : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                            }`}>
                              {item.allGroupChecked ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <div className="h-4 w-4 border-2 border-slate-300 rounded" />
                              )}
                            </div>

                            <div 
                              className="border-l-4 pl-3 py-0.5 min-w-0"
                              style={{ borderLeftColor: getClassColor(item) }}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span 
                                  className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase shrink-0 text-white"
                                  style={{ backgroundColor: getClassColor(item) }}
                                >
                                  {getItemClass(item) || item.classe}
                                </span>
                                <p className={`text-[11px] font-bold uppercase truncate transition-all ${
                                  item.allGroupChecked ? 'line-through text-slate-400' : 'text-slate-500'
                                }`} title={item.nome}>{item.nome}</p>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className={`text-sm font-black transition-all ${
                                  item.allGroupChecked ? 'text-slate-400' : 'text-slate-900'
                                }`}>
                                  {item.stack === "2x" ? `${item.totalQtd / 2} Fardos (Empilhados)` : `${item.totalQtd} Fardos`}
                                </span>
                                {item.stack === "2x" && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">2x</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Action Buttons at the Bottom */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleFinalizePallet}
                className="w-full sm:w-auto px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 border border-indigo-700"
              >
                <CheckCircle2 size={24} />
                FINALIZAR E SALVAR PALETE
              </button>
            </div>
          </section>
        )}

        {/* History Drawer */}
        <AnimatePresence>
          {isHistoryOpen && (
            <>
              {/* Backdrop with elegant glass translucent overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsHistoryOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 cursor-pointer"
              />
              {/* Drawer Container */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col h-full"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <History className="text-indigo-600 animate-pulse" size={22} />
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-lg leading-tight">Histórico de Paletes</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Resumos dos paletes finalizados</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsHistoryOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {history.length === 0 ? (
                    <div className="text-center py-16 space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100/60">
                        <History className="text-slate-300" size={28} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-600 font-bold text-sm">Nenhum palete no histórico</p>
                        <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                          Gere um palete, use o botão <strong className="text-indigo-600">Finalizar</strong> para registrar o tempo e ver o resumo salvo aqui!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{history.length} paletes salvos</span>
                        {confirmClear ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-red-500 font-bold animate-pulse">Confirmar?</span>
                            <button
                              onClick={handleClearHistory}
                              className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded-md font-bold transition-all"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setConfirmClear(false)}
                              className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-1.5 py-0.5 rounded-md font-bold transition-all"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmClear(true)}
                            className="text-xs text-red-500 hover:text-red-600 font-bold hover:underline transition-all"
                          >
                            Limpar Histórico
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {history.map((item, idx) => (
                          <motion.div 
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 hover:bg-slate-100/50 transition-all shadow-sm flex flex-col gap-3 group relative overflow-hidden"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-extrabold text-slate-800 text-sm">Palete #{item.id.slice(-4)}</p>
                                <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <Clock size={10} />
                                  {item.timestamp}
                                </p>
                              </div>
                              <span className="text-[10px] uppercase font-extrabold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl">
                                {item.layersCount} Camadas
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200/50">
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                                <p className="text-[9px] uppercase font-bold text-slate-400">Total SKUs</p>
                                <p className="text-sm font-black text-slate-700 font-mono mt-0.5">{item.skusCount}</p>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                                <p className="text-[9px] uppercase font-bold text-slate-400 font-sans">Total Fardos</p>
                                <p className="text-sm font-black text-emerald-600 font-mono mt-0.5">{item.totalFardos}</p>
                              </div>
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                                <p className="text-[9px] uppercase font-bold text-slate-400">Tempo</p>
                                <p className="text-sm font-black text-indigo-600 font-mono mt-0.5">{item.timeTaken}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer / Backup controls */}
                <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col gap-2 shrink-0">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                    <span>Cópia de Segurança</span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-black">Salvo em IndexedDB (Seguro)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      onClick={exportBackup}
                      className="flex items-center justify-center gap-2 p-2.5 bg-white border border-slate-200 hover:border-indigo-100 hover:bg-indigo-50/20 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Download size={14} />
                      Exportar Backup
                    </button>
                    <label
                      className="flex items-center justify-center gap-2 p-2.5 bg-white border border-slate-200 hover:border-indigo-100 hover:bg-indigo-50/20 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer text-center"
                    >
                      <Upload size={14} />
                      Importar Backup
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={importBackup} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Share Modal */}
        <AnimatePresence>
          {isShareModalOpen && (
            <ShareModal 
              onClose={() => setIsShareModalOpen(false)}
              showToast={showToast}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

function RotatingGroup({ isAutoRotating, children }: { isAutoRotating: boolean; children: React.ReactNode }) {
  const groupRef = React.useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (isAutoRotating && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5; // Smooth time-independent rotation
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.2, 0]}>
      {children}
    </group>
  );
}

function Pallet3DModal({ layers, onClose }: { layers: PalletLayer[], onClose: () => void }) {
  const [viewMode, setViewMode] = useState<'all' | number>('all');
  const [isAutoRotating, setIsAutoRotating] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4"
    >
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl overflow-hidden flex flex-col relative shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <BoxIcon className="text-indigo-600" />
            Visualização 3D do Palete (Empilhamento Otimizado)
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-200 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Ver Tudo
              </button>
              <button 
                onClick={() => setViewMode(0)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode !== 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Por Camada
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div 
          className="flex-1 bg-slate-100 relative min-h-0 select-none touch-none"
        >
          <ErrorBoundary>
            <React.Suspense fallback={
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
                <p className="text-slate-500 font-medium">Carregando visualização 3D...</p>
              </div>
            }>
              <Canvas 
                shadows 
                camera={{ position: [4, 4, 4], fov: 40 }}
                gl={{ antialias: true, alpha: true }}
                onCreated={({ gl }) => {
                  gl.setClearColor('#f1f5f9');
                }}
              >
                <ambientLight intensity={0.7} />
                <directionalLight 
                  position={[5, 10, 5]} 
                  intensity={1} 
                  castShadow 
                  shadow-mapSize={[1024, 1024]}
                />
                <pointLight position={[-5, 5, -5]} intensity={0.5} />
                
                <RotatingGroup isAutoRotating={isAutoRotating}>
                   {/* Base do Pallet de Madeira Detalhado */}
                   <WoodenPallet />
                   
                   {/* Conteúdo do Palete */}
                   <PalletContent layers={layers} viewMode={viewMode} />
                </RotatingGroup>
  
                <OrbitControls 
                  makeDefault 
                  enableRotate={true}
                  enableZoom={true}
                  enablePan={true}
                  minDistance={2} 
                  maxDistance={15} 
                  enableDamping={true}
                  dampingFactor={0.05}
                  onStart={() => setIsAutoRotating(false)}
                />
                <ContactShadows position={[0, -1.2, 0]} opacity={0.3} scale={10} blur={2.5} far={4} />
              </Canvas>
            </React.Suspense>
          </ErrorBoundary>

          {/* Instruções de Gestos Táteis */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none bg-slate-900/90 backdrop-blur-md text-white text-[10px] sm:text-xs px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg border border-white/10 z-30 animate-pulse">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
            <span>Arraste para girar em 3D • Use scroll ou pinça para zoom</span>
          </div>

          {/* Autogiro Toggle sutil no canto superior direito */}
          <div className="absolute top-4 right-4 z-40">
            <button
              onClick={() => setIsAutoRotating(prev => !prev)}
              className={`px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 font-bold text-xs shadow-md border ${
                isAutoRotating 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/25 ring-2 ring-indigo-600/20' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Girar o modelo automaticamente"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              <span>{isAutoRotating ? 'Autogiro Ativo' : 'Autogiro Desligado'}</span>
            </button>
          </div>
          
          {viewMode !== 'all' && layers[viewMode] && (
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-xl border border-slate-200 max-w-[220px] flex items-center gap-3">
                <MiniLayer2D layer={layers[viewMode]} />
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">Camada {viewMode + 1} de {layers.length}</p>
                  <p className="text-xs text-slate-500">
                    Ocupação: <span style={{ color: getPercentColorStyle(layers[viewMode].percentual) }} className="font-bold">{layers[viewMode].percentual.toFixed(1)}%</span>
                  </p>
                  <p className="text-xs text-slate-500">Altura: {layers[viewMode].altura}cm</p>
                  <p className="text-xs text-slate-500">
                    Fardos: <span className="font-bold text-slate-700">{layers[viewMode].itens.reduce((sum, item) => sum + item.qtdUsada, 0)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 flex flex-col items-center gap-4 pointer-events-none">
            {viewMode !== 'all' && (
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur p-1.5 rounded-2xl shadow-2xl border border-slate-200 pointer-events-auto">
                <button 
                  disabled={viewMode === 0}
                  onClick={() => setViewMode(prev => typeof prev === 'number' ? Math.max(0, prev - 1) : 0)}
                  className="p-2 hover:bg-slate-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600"
                >
                  <ArrowUpDown className="rotate-180" size={20} />
                </button>
                <div className="px-4 flex flex-col items-center">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Nível</span>
                  <span className="text-xl font-black text-slate-800 leading-none">{viewMode + 1}</span>
                </div>
                <button 
                  disabled={viewMode === layers.length - 1}
                  onClick={() => setViewMode(prev => typeof prev === 'number' ? Math.min(layers.length - 1, prev + 1) : 0)}
                  className="p-2 hover:bg-slate-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-600"
                >
                  <ArrowUpDown size={20} />
                </button>
              </div>
            )}

            <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-xs font-bold text-slate-600 shadow-lg border border-slate-200 pointer-events-auto flex items-center gap-4">
              <span>🖱️ Girar</span>
              <span>🔍 Zoom</span>
              <span className="w-px h-3 bg-slate-300"></span>
              <span className="text-indigo-600">
                {viewMode === 'all' ? 'Visualizando Palete Completo' : `Visualizando Camada ${viewMode + 1}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function WoodenPallet() {
  return (
    <group>
      {/* Ripas de baixo */}
      <mesh position={[0, 0.02, 0.5]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.04, 0.1]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.04, 0.1]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, -0.5]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.04, 0.1]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.9} />
      </mesh>

      {/* Blocos centrais */}
      {[-0.5, 0, 0.5].map(x => [-0.5, 0, 0.5].map(z => (
        <mesh key={`block-${x}-${z}`} position={[x, 0.08, z]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.08, 0.12]} />
          <meshStandardMaterial color="#6a3a1a" roughness={0.9} />
        </mesh>
      )))}

      {/* Ripas de cima */}
      {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((z, i) => (
        <mesh key={`slat-${i}`} position={[0, 0.14, z]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.04, 0.15]} />
          <meshStandardMaterial color="#8B4513" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function PalletContent({ layers, viewMode }: { layers: PalletLayer[], viewMode: 'all' | number }) {
  let currentY = 0.16; // Inicia acima do pallet de madeira detalhado
  
  return (
    <>
      {layers.map((layer, index) => {
        const layerFloor = currentY;
        const layerHeight = (layer.altura || 15) / 100;
        
        // Se estivermos no modo "Por Camada", só mostramos a camada selecionada
        // E mostramos ela sempre na base (acima do pallet de madeira)
        const isVisible = viewMode === 'all' || viewMode === index;
        const displayFloor = viewMode === 'all' ? layerFloor : 0.16;

        const layerComponent = isVisible ? (
          <group key={layer.id}>
            {/* Folha de separação (Slip Sheet) sutil */}
            <mesh position={[0, displayFloor, 0]} receiveShadow>
              <boxGeometry args={[1.20, 0.002, 1.20]} />
              <meshStandardMaterial color="#cbd5e1" roughness={1} transparent opacity={0.5} />
            </mesh>
            
            <Layer3D layer={layer} floor={displayFloor + 0.002} />
          </group>
        ) : null;

        currentY += layerHeight + 0.002;
        return layerComponent;
      })}
    </>
  );
}

function Layer3D({ layer, floor }: { layer: PalletLayer, floor: number }) {
  const firstItem = layer.itens[0];
  
  // Total positions needed (stacked items count as 1 position)
  const totalPositions = useMemo(() => {
    let total = 0;
    layer.itens.forEach(item => {
      const q = item.qtdUsada || 0;
      total += item.stack === "2x" ? Math.ceil(q / 2) : q;
    });
    return total;
  }, [layer.itens]);

  // Calculate capacity based on the first item's area percentage
  const capacity = useMemo(() => {
    if (!firstItem || !firstItem.percFardo) return 1;
    return Math.max(1, Math.round(100 / firstItem.percFardo));
  }, [firstItem]);

  const isFullLayer = layer.percentual >= 95;
  
  // Use actual positions for full layers to "close" them, 
  // or theoretical capacity for partial layers to show gaps.
  const targetCount = isFullLayer ? totalPositions : Math.max(capacity, totalPositions);

  // Specific layout rules based on user request
  const layout = useMemo<{ rows: number, getCols: (r: number) => number }>(() => {
    // Rules for specific capacities
    if (targetCount === 45) return { rows: 9, getCols: () => 5 };
    if (targetCount === 40) return { rows: 8, getCols: () => 5 };
    if (targetCount === 30) return { rows: 6, getCols: () => 5 };
    if (targetCount === 28) return { rows: 4, getCols: () => 7 };
    
    // Mixed / Special layouts
    if (targetCount === 20) return { rows: 4, getCols: (r: number) => r < 2 ? 6 : 4 };
    if (targetCount === 21) return { rows: 4, getCols: (r: number) => r < 1 ? 6 : 5 };
    if (targetCount === 22) return { rows: 4, getCols: (r: number) => r < 3 ? 6 : 4 };
    if (targetCount === 23) return { rows: 4, getCols: (r: number) => r < 3 ? 6 : 5 };
    if (targetCount === 24) return { rows: 4, getCols: () => 6 };
    if (targetCount === 25) return { rows: 4, getCols: (r: number) => r < 3 ? 7 : 4 };
    if (targetCount === 26) return { rows: 4, getCols: (r: number) => r < 2 ? 7 : 6 };
    if (targetCount === 27) return { rows: 4, getCols: (r: number) => r < 3 ? 7 : 6 };
    
    // Default: 5 columns
    const r = Math.max(1, Math.ceil(targetCount / 5));
    return { rows: r, getCols: () => 5 };
  }, [targetCount]);

  if (!firstItem || totalPositions === 0 || layout.rows === 0) return null;

  const areaSize = 1.2; // Standard pallet size to match the wooden base
  const spacingZ = areaSize / layout.rows;

  const boxes: React.ReactNode[] = [];
  let currentPosIndex = 0;

  // Helper to get row and column in the custom layout
  const getPos = (index: number) => {
    if (layout.rows <= 0) return { r: 0, c: 0, colsInRow: 1 };
    let count = 0;
    for (let r = 0; r < layout.rows; r++) {
      const colsInRow = layout.getCols(r);
      if (index < count + colsInRow) {
        return { r, c: index - count, colsInRow };
      }
      count += colsInRow;
    }
    // Fallback for overflow
    const lastRow = Math.max(0, layout.rows - 1);
    return { r: lastRow, c: 0, colsInRow: layout.getCols(lastRow) };
  };

  layer.itens.forEach((item, itemIdx) => {
    const color = getClassColor(item);
    const h = (item.altura || 15) / 100;
    const isStacked = item.stack === "2x";

    // If stacked, we process in pairs (one position for two boxes)
    const q = item.qtdUsada || 0;
    const effectiveQtd = isStacked ? Math.ceil(q / 2) : q;

    for (let i = 0; i < effectiveQtd; i++) {
      const { r, c, colsInRow } = getPos(currentPosIndex);
      if (r >= layout.rows) break;

      let itemsInThisRow = colsInRow;
      let currentCol = c;

      // If it's a full layer and we are at the last row, 
      // we might need to stretch to close the layer if the count doesn't match exactly
      if (isFullLayer && r === layout.rows - 1) {
        let itemsBeforeLastRow = 0;
        for (let j = 0; j < r; j++) {
          itemsBeforeLastRow += layout.getCols(j);
        }
        const remaining = totalPositions - itemsBeforeLastRow;
        if (remaining > 0) {
          itemsInThisRow = remaining;
          currentCol = currentPosIndex - itemsBeforeLastRow;
        }
      }

      const spacingX = areaSize / itemsInThisRow;
      const posX = (currentCol - (itemsInThisRow - 1) / 2) * spacingX;
      const posZ = (r - (layout.rows - 1) / 2) * spacingZ;

      // Use smaller gaps for full layers to make them look "closed"
      const gapFactor = isFullLayer ? 0.995 : 0.96;

      // Bottom Box
      boxes.push(
        <Box3D 
          key={`${layer.id}-${itemIdx}-${item.idUnico}-${i}-bot`} 
          position={[posX, floor + h/2, posZ]} 
          size={[spacingX * gapFactor, h * 0.98, spacingZ * gapFactor]} 
          color={color} 
        />
      );

      // Top Box (if stacked)
      if (isStacked && (i * 2 + 1 < item.qtdUsada)) {
        boxes.push(
          <Box3D 
            key={`${layer.id}-${itemIdx}-${item.idUnico}-${i}-top`} 
            position={[posX, floor + h + h/2, posZ]} 
            size={[spacingX * gapFactor, h * 0.98, spacingZ * gapFactor]} 
            color={color} 
          />
        );
      }
      currentPosIndex++;
    }
  });

  return <>{boxes}</>;
}

function Box3D({ position, size, color }: { position: [number, number, number], size: [number, number, number], color: string }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial 
          color={color} 
          roughness={0.4} 
          metalness={0.2} 
          emissive={color}
          emissiveIntensity={0.05}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[size[0] * 1.001, size[1] * 1.001, size[2] * 1.001]} />
        <meshBasicMaterial color="black" wireframe opacity={0.1} transparent />
      </mesh>
    </group>
  );
}

function CameraModal({ onClose, onCapture, isScanning, scanningStatus, onError }: { onClose: () => void, onCapture: (img: string) => void, isScanning: boolean, scanningStatus?: string, onError?: (msg: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [currentZoom, setCurrentZoom] = useState(1);
  const [guideWidth, setGuideWidth] = useState(80); // Porcentagem (10-100)
  const [guideHeight, setGuideHeight] = useState(33); // Porcentagem (10-100)
  const [localError, setLocalError] = useState<string | null>(null);

  const [focusPoint, setFocusPoint] = useState<{ x: number, y: number } | null>(null);

  React.useEffect(() => {
    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isNotHttps = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        let msg = "Acesso à câmera não disponível neste navegador ou ambiente.";
        if (isNotHttps) {
          msg = "O navegador bloqueia o acesso à câmera por falta de uma conexão segura HTTPS. Por favor, acesse usando https:// ou utilize o botão verde de Upload de Foto ao lado do campo de texto.";
        } else {
          msg = "O navegador ou o iframe (como no GitHub ou preview) bloqueou o acesso à câmera. Por favor, abra o aplicativo diretamente em uma nova aba do navegador ou utilize o botão de Upload de Foto.";
        }
        if (onError) {
          setTimeout(() => onError(msg), 0);
        } else {
          console.warn("Camera failed to start:", msg);
        }
        setLocalError(msg);
        return;
      }

      const constraints = [
        { 
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1920 }, 
            height: { ideal: 1080 },
          } 
        },
        { video: { facingMode: 'environment' } },
        { video: true }
      ];

      let lastError: any = null;
      for (const constraint of constraints) {
        try {
          const s = await navigator.mediaDevices.getUserMedia(constraint);
          setStream(s);
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            
            const tracks = s.getVideoTracks();
            const track = tracks && tracks.length > 0 ? tracks[0] : null;
            if (track) {
              const supportedConstraints = navigator.mediaDevices.getSupportedConstraints() as any;
              
              if (typeof track.getCapabilities === 'function') {
                const capabilities = track.getCapabilities() as any;
                
                if (capabilities.torch) setHasTorch(true);
                if (capabilities.zoom) {
                  setHasZoom(true);
                  setZoomRange({
                    min: capabilities.zoom.min || 1,
                    max: capabilities.zoom.max || 1,
                    step: capabilities.zoom.step || 0.1
                  });
                  setCurrentZoom(capabilities.zoom.min || 1);
                }

                if (supportedConstraints.focusMode && capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                  try {
                    await track.applyConstraints({
                      advanced: [{ focusMode: 'continuous' }] as any
                    });
                  } catch (e) {
                    console.warn("Foco contínuo não suportado ou falhou:", e);
                  }
                }
              }
            }
          }
          return; // Sucesso!
        } catch (err: any) {
          lastError = err;
          console.warn(`Tentativa com constraint falhou:`, constraint, err);
        }
      }

      // Se todas as tentativas falharem
      console.warn("Erro ao acessar câmera:", lastError);
      let msg = "Não foi possível acessar a câmera.";
      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        msg = "O acesso à câmera foi negado pelo navegador ou sistema. Por favor, use o botão de Upload de Foto (ícone de nuvem verde) ao lado do campo de texto para fazer o escaneamento, ou abra o aplicativo em uma nova aba do navegador.";
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        msg = "Nenhuma câmera física foi encontrada neste dispositivo. Use a opção de Upload de Foto.";
      } else {
        msg = "Erro ao carregar a câmera ou permissão bloqueada no iframe atual. Por favor, envie uma foto usando o botão de Upload de Foto verde.";
      }
      
      if (onError) {
        setTimeout(() => onError(msg), 0);
      } else {
        console.warn("Camera failed to start:", msg);
      }
      setLocalError(msg);
    }
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleZoomChange = async (value: number) => {
    if (stream && hasZoom) {
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ zoom: value }] as any
        });
        setCurrentZoom(value);
      } catch (e) {
        console.warn("Erro ao ajustar zoom:", e);
      }
    }
  };

  const toggleTorch = async () => {
    if (stream && hasTorch) {
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ torch: !isTorchOn }] as any
        });
        setIsTorchOn(!isTorchOn);
      } catch (e) {
        console.warn("Erro ao alternar lanterna:", e);
      }
    }
  };

  const triggerFocus = async (e?: React.MouseEvent) => {
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setFocusPoint(null), 1000);
    }

    if (stream) {
      const track = stream.getVideoTracks()[0];
      const supportedConstraints = navigator.mediaDevices.getSupportedConstraints() as any;

      if (supportedConstraints.focusMode && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.focusMode) {
          try {
            // Tenta forçar um ciclo de foco
            const hasManual = capabilities.focusMode.includes('manual');
            const hasContinuous = capabilities.focusMode.includes('continuous');

            if (hasManual) {
              await track.applyConstraints({
                advanced: [{ focusMode: 'manual' }] as any
              });
              
              if (hasContinuous) {
                setTimeout(async () => {
                  try {
                    await track.applyConstraints({
                      advanced: [{ focusMode: 'continuous' }] as any
                    });
                  } catch (e) {
                    console.warn("Falha ao retornar para foco contínuo:", e);
                  }
                }, 100);
              }
            }
          } catch (e) {
            console.warn("Falha ao forçar foco:", e);
          }
        }
      }
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const cropW = vw * (guideWidth / 100);
      const cropH = vh * (guideHeight / 100);
      const cropX = (vw - cropW) / 2;
      const cropY = (vh - cropH) / 2;

      // Redimensionar para otimizar velocidade sem perder muita precisão
      const MAX_DIM = 1024;
      let targetW = cropW;
      let targetH = cropH;
      
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = (MAX_DIM / targetW) * targetH;
          targetW = MAX_DIM;
        } else {
          targetW = (MAX_DIM / targetH) * targetW;
          targetH = MAX_DIM;
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.filter = 'contrast(1.4) brightness(1.1) saturate(0)';
        
        ctx.drawImage(
          video, 
          cropX, cropY, cropW, cropH,
          0, 0, targetW, targetH
        );
        
        // Qualidade 0.8 para reduzir o tamanho do payload e acelerar o upload
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg relative">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Camera size={20} className="text-indigo-600" />
            Escanear Códigos
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        {localError ? (
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-inner">
              <AlertCircle size={36} />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-lg font-black text-slate-800 font-sans">Câmera Não Disponível</h4>
              <p className="text-sm text-slate-600 leading-relaxed max-w-sm font-sans">
                {localError}
              </p>
            </div>

            <div className="w-full flex flex-col gap-2 pt-2">
              <a 
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 text-sm font-sans"
              >
                ABRIR EM NOVA ABA (RECOMENDADO)
                <ChevronRight size={18} />
              </a>

              <label 
                htmlFor="modal-file-upload-error" 
                className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm border border-emerald-200 font-sans"
              >
                <Upload size={18} />
                CARREGAR FOTO DA GALERIA
              </label>
              <input 
                type="file" 
                accept="image/*" 
                id="modal-file-upload-error"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = reader.result as string;
                      onCapture(base64);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
              />

              <button 
                onClick={onClose}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all text-sm font-sans"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div 
              className="relative aspect-video bg-black cursor-crosshair overflow-hidden"
              onClick={triggerFocus}
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {isScanning && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-3 px-4 text-center">
                  <Loader2 className="animate-spin" size={48} />
                  <p className="font-bold">{scanningStatus || "Reconhecendo códigos..."}</p>
                </div>
              )}

              {/* Quality Badge */}
              <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 pointer-events-none">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                HD 1080p • QUALIDADE MÁXIMA
              </div>

              {/* Torch Toggle */}
              {hasTorch && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTorch();
                  }}
                  className={`absolute top-4 right-4 p-3 rounded-full transition-all ${
                    isTorchOn ? 'bg-yellow-400 text-black' : 'bg-black/40 text-white'
                  }`}
                >
                  {isTorchOn ? <Zap size={20} /> : <ZapOff size={20} />}
                </button>
              )}

              {/* Focus Ring */}
              <AnimatePresence>
                {focusPoint && (
                  <motion.div 
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute w-16 h-16 border-2 border-yellow-400 rounded-full pointer-events-none"
                    style={{ left: focusPoint.x - 32, top: focusPoint.y - 32 }}
                  />
                )}
              </AnimatePresence>

              {/* Guide Overlay */}
              <div className="absolute inset-0 border-2 border-white/30 pointer-events-none flex items-center justify-center">
                <motion.div 
                  animate={{ 
                    width: `${guideWidth}%`,
                    height: `${guideHeight}%`
                  }}
                  className="border-2 border-indigo-400 rounded-lg shadow-[0_0_0_1000px_rgba(0,0,0,0.4)] relative overflow-hidden"
                >
                  {/* Scanning Line Animation */}
                  <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-0.5 bg-indigo-400/50 shadow-[0_0_10px_rgba(129,140,248,0.8)] z-10"
                  />
                </motion.div>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Controls Container */}
              <div className="space-y-3">
                {/* Zoom Control */}
                {hasZoom && (
                  <div className="flex items-center gap-3 bg-slate-50 p-2 px-3 rounded-xl border border-slate-100">
                    <ZoomOut size={16} className="text-slate-400" />
                    <input 
                      type="range"
                      min={zoomRange.min}
                      max={zoomRange.max}
                      step={zoomRange.step}
                      value={currentZoom}
                      onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <ZoomIn size={16} className="text-slate-400" />
                    <span className="text-[10px] font-mono font-bold text-indigo-600 w-8 text-right">
                      {currentZoom.toFixed(1)}x
                    </span>
                  </div>
                )}

                {/* Guide Width Control */}
                <div className="flex items-center gap-3 bg-slate-50 p-2 px-3 rounded-xl border border-slate-100">
                  <ArrowLeftRight size={16} className="text-slate-400" />
                  <input 
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={guideWidth}
                    onChange={(e) => setGuideWidth(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-[10px] font-mono font-bold text-indigo-600 w-8 text-right">
                    {guideWidth}%
                  </span>
                </div>

                {/* Guide Height Control */}
                <div className="flex items-center gap-3 bg-slate-50 p-2 px-3 rounded-xl border border-slate-100">
                  <ArrowUpDown size={16} className="text-slate-400" />
                  <input 
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={guideHeight}
                    onChange={(e) => setGuideHeight(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-[10px] font-mono font-bold text-indigo-600 w-8 text-right">
                    {guideHeight}%
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 text-center leading-tight">
                Toque para focar. Ajuste o zoom e o tamanho da área de captura nos controles acima.
              </p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    capture();
                  }}
                  disabled={isScanning}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {isScanning ? <Loader2 className="animate-spin" /> : <Camera />}
                  {isScanning ? 'PROCESSANDO...' : 'CAPTURAR E RECONHECER'}
                </button>

                <label 
                  htmlFor="modal-file-upload" 
                  className={`w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-sm ${isScanning ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <Upload size={18} />
                  CARREGAR FOTO DA GALERIA
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="modal-file-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = reader.result as string;
                        onCapture(base64);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function LayerConfigModal({ 
  layer, 
  layers, 
  onClose, 
  onUpdateQtd, 
  onMoveProduct,
  onToggleStack
}: { 
  layer: PalletLayer; 
  layers: PalletLayer[]; 
  onClose: () => void; 
  onUpdateQtd: (layerId: string, itemKey: string, newQtd: number) => void; 
  onMoveProduct: (sourceLayerId: string, targetLayerId: string, itemKey: string, qtyToMove: number, targetStack?: string) => void; 
  onToggleStack: (layerId: string, itemKey: string) => void;
}) {
  const layerIndex = layers.findIndex(l => l.id === layer.id) + 1;

  // Group items for display matching the main view
  const groupedItens = useMemo(() => {
    return Object.values(layer.itens.reduce((acc: any, item) => {
      const key = `${item.nome}-${item.stack}`;
      if (!acc[key]) acc[key] = { ...item, totalQtd: 0 };
      acc[key].totalQtd += item.qtdUsada;
      return acc;
    }, {}));
  }, [layer.itens]);

  // Track selected target layers and move quantities for each item in the layer
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [moveQuantities, setMoveQuantities] = useState<Record<string, number>>({});

  // Adding product from another layer state
  const [isAddingFromOther, setIsAddingFromOther] = useState(false);
  const [selectedSourceLayerId, setSelectedSourceLayerId] = useState<string>("");
  const [pullQuantities, setPullQuantities] = useState<Record<string, number>>({});
  const [pullStacked, setPullStacked] = useState<Record<string, boolean>>({});

  const handleTargetChange = (itemKey: string, targetId: string) => {
    setMoveTargets(prev => ({ ...prev, [itemKey]: targetId }));
  };

  const handleMoveQtyChange = (itemKey: string, qty: number, maxQty: number) => {
    const val = Math.max(0, Math.min(maxQty, qty));
    setMoveQuantities(prev => ({ ...prev, [itemKey]: val }));
  };

  const executeMove = (itemKey: string, maxQty: number) => {
    const targetId = moveTargets[itemKey];
    if (!targetId) return;

    const qty = moveQuantities[itemKey] !== undefined ? moveQuantities[itemKey] : maxQty;
    if (qty <= 0) return;

    onMoveProduct(layer.id, targetId, itemKey, qty);
    
    // Clear move inputs for this item after moving
    setMoveTargets(prev => {
      const copy = { ...prev };
      delete copy[itemKey];
      return copy;
    });
    setMoveQuantities(prev => {
      const copy = { ...prev };
      delete copy[itemKey];
      return copy;
    });
  };

  // Find source layer for dynamic pull
  const srcLayer = useMemo(() => {
    return layers.find(l => l.id === selectedSourceLayerId) || null;
  }, [selectedSourceLayerId, layers]);

  // Group items of the selected source layer for dynamic pull list
  const srcGroupedItens = useMemo(() => {
    if (!srcLayer) return [];
    return Object.values(srcLayer.itens.reduce((acc: any, item) => {
      const key = `${item.nome}-${item.stack}`;
      if (!acc[key]) acc[key] = { ...item, totalQtd: 0 };
      acc[key].totalQtd += item.qtdUsada;
      return acc;
    }, {}));
  }, [srcLayer]);

  const executePull = (itemKey: string, srcTotalQtd: number) => {
    if (!selectedSourceLayerId) return;
    const qtyToPull = pullQuantities[itemKey] !== undefined ? pullQuantities[itemKey] : srcTotalQtd;
    if (qtyToPull <= 0) return;

    const wantsStacked = !!pullStacked[itemKey];

    onMoveProduct(selectedSourceLayerId, layer.id, itemKey, qtyToPull, wantsStacked ? "2x" : undefined);

    // Reset pull state for this item
    setPullQuantities(prev => {
      const copy = { ...prev };
      delete copy[itemKey];
      return copy;
    });
    setPullStacked(prev => {
      const copy = { ...prev };
      delete copy[itemKey];
      return copy;
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-slate-100 max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <MiniLayer2D layer={layer} />
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">
                Configurar Camada {layerIndex}
              </h3>
              <p className="text-xs text-slate-500">
                Ajuste manual de quantidades e movimentações entre camadas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Layer Stats */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ocupação</p>
              <p className="text-xl font-black mt-1" style={{ color: getPercentColorStyle(layer.percentual) }}>{layer.percentual.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Altura</p>
              <p className="text-xl font-black text-emerald-600 mt-1">{layer.altura}cm</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fardos</p>
              <p className="text-xl font-black text-indigo-600 mt-1">{layer.itens.reduce((sum, item) => sum + item.qtdUsada, 0)}</p>
            </div>
          </div>

          {/* ADD FROM OTHER LAYER SECTION COMPONENT */}
          <div className="bg-slate-50/60 p-4 border border-slate-200/60 rounded-2xl space-y-4">
            <button 
              onClick={() => setIsAddingFromOther(!isAddingFromOther)}
              className="w-full flex items-center justify-between text-indigo-600 hover:text-indigo-700 font-bold text-sm transition-all py-1"
            >
              <span className="flex items-center gap-2">
                <Plus size={18} className={`transition-transform duration-200 ${isAddingFromOther ? 'rotate-45' : ''}`} />
                Puxar Produto de outra Camada
              </span>
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-xl">Novo</span>
            </button>

            <AnimatePresence>
              {isAddingFromOther && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-2 space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Selecione a Camada de Origem</label>
                    <select
                      value={selectedSourceLayerId}
                      onChange={(e) => {
                        setSelectedSourceLayerId(e.target.value);
                        setPullQuantities({});
                      }}
                      className="w-full bg-white border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Escolha uma Camada...</option>
                      {layers.map((l, lIdx) => {
                        if (l.id === layer.id) return null;
                        return (
                          <option key={l.id} value={l.id}>
                            Camada {lIdx + 1} ({l.percentual.toFixed(0)}% Ocupada • {l.itens.length} tipo(s) de produto)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedSourceLayerId && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Produtos disponíveis na origem:</p>
                      {srcGroupedItens.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-white p-3 rounded-xl border">Não há produtos nesta camada.</p>
                      ) : (
                        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                          {srcGroupedItens.map((item: any, sIdx) => {
                            const itemKey = `${item.nome}-${item.stack}`;
                            const maxPull = item.totalQtd;
                            const isCurrentlyStacked = item.stack === '2x';
                            const wantsStacked = !!pullStacked[itemKey];

                            const currentPullRaw = pullQuantities[itemKey] !== undefined ? pullQuantities[itemKey] : maxPull;
                            const currentPull = (isCurrentlyStacked || wantsStacked) 
                              ? (currentPullRaw % 2 === 0 ? currentPullRaw : Math.floor(currentPullRaw / 2) * 2)
                              : currentPullRaw;

                            const currentRemain = maxPull - currentPull;

                            const step = (isCurrentlyStacked || wantsStacked) ? 2 : 1;

                            const updatePull = (newVal: number) => {
                              let adjusted = Math.max(0, Math.min(maxPull, newVal));
                              if ((isCurrentlyStacked || wantsStacked) && adjusted > 0) {
                                adjusted = Math.ceil(adjusted / 2) * 2;
                                if (adjusted > maxPull) {
                                  adjusted = Math.floor(maxPull / 2) * 2;
                                }
                              }
                              setPullQuantities(prev => ({ ...prev, [itemKey]: adjusted }));
                            };

                            return (
                              <div key={sIdx} className="bg-white border border-slate-100 rounded-xl p-4 space-y-3 shadow-sm text-xs">
                                <div className="flex justify-between items-start min-w-0">
                                  <div>
                                    <p className="font-bold text-slate-800 text-xs truncate uppercase" title={item.nome}>{item.nome}</p>
                                    <p className="text-[10px] text-slate-400">Total disponível: {item.totalQtd} fardos ({item.stack === '2x' ? '2x Empilhado' : 'Normal'})</p>
                                  </div>
                                  <span 
                                    className="text-[10px] px-2 py-0.5 rounded font-black uppercase text-white shrink-0"
                                    style={{ backgroundColor: getClassColor(item) }}
                                  >
                                    {getItemClass(item) || item.classe}
                                  </span>
                                </div>

                                {item.altura <= 15 && !isCurrentlyStacked && (
                                  <div className="flex items-center gap-2 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-indigo-600 select-none w-full">
                                      <input 
                                        type="checkbox"
                                        checked={wantsStacked}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setPullStacked(prev => ({ ...prev, [itemKey]: checked }));
                                          if (checked) {
                                            const rawVal = pullQuantities[itemKey] !== undefined ? pullQuantities[itemKey] : maxPull;
                                            let evenVal = Math.floor(rawVal / 2) * 2;
                                            if (evenVal <= 0 && maxPull >= 2) {
                                              evenVal = 2;
                                            }
                                            setPullQuantities(prev => ({ ...prev, [itemKey]: evenVal }));
                                          }
                                        }}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                                      />
                                      <span className="flex items-center gap-1">
                                        <Layers size={12} className="text-indigo-500" />
                                        Empilhar por par (Somente múltiplos de 2)
                                      </span>
                                    </label>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                                  {/* Puxar amount */}
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-bold mb-1">Trazer para esta camada:</p>
                                    <div className="flex items-center gap-1.5">
                                      <button 
                                        type="button"
                                        onClick={() => updatePull(currentPull - step)}
                                        className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold"
                                      >
                                        -
                                      </button>
                                      <span className="flex-1 text-center font-bold text-indigo-600 bg-slate-50 py-1 rounded-lg border border-slate-100">
                                        {currentPull}
                                      </span>
                                      <button 
                                        type="button"
                                        onClick={() => updatePull(currentPull + step)}
                                        className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Permanecer amount */}
                                  <div>
                                    <p className="text-[10px] text-slate-400 font-bold mb-1">Deixar na camada original:</p>
                                    <div className="flex items-center gap-1.5">
                                      <button 
                                        type="button"
                                        onClick={() => updatePull(currentPull + step)}
                                        className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold"
                                      >
                                        -
                                      </button>
                                      <span className="flex-1 text-center font-bold text-slate-600 bg-slate-50 py-1 rounded-lg border border-slate-100">
                                        {currentRemain}
                                      </span>
                                      <button 
                                        type="button"
                                        onClick={() => updatePull(currentPull - step)}
                                        className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <button 
                                  onClick={() => executePull(itemKey, maxPull)}
                                  disabled={currentPull <= 0}
                                  className="w-full mt-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                                >
                                  Puxar {currentPull} fardo(s) para Camada {layerIndex} {wantsStacked ? ' (Empilhado 2x)' : ''}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-slate-400 font-bold">Produtos nesta Camada</h4>
            
            {groupedItens.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm">Nenhum produto nesta camada.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedItens.map((item: any, idx) => {
                  const itemKey = `${item.nome}-${item.stack}`;
                  const currentMoveTarget = moveTargets[itemKey] || "";
                  const maxQty = item.totalQtd;
                  const currentMoveQty = moveQuantities[itemKey] !== undefined ? moveQuantities[itemKey] : maxQty;
                  const currentKeepQty = maxQty - currentMoveQty;

                  const step = item.stack === '2x' ? 2 : 1;

                  // Update synchronized move quantities
                  const updateMoveQty = (newMoveValue: number) => {
                    const adjusted = Math.max(0, Math.min(maxQty, newMoveValue));
                    setMoveQuantities(prev => ({ ...prev, [itemKey]: adjusted }));
                  };

                  return (
                    <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-200 transition-all">
                      {/* Product Header */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="text-[10px] px-2 py-0.5 rounded font-black uppercase text-white shrink-0"
                              style={{ backgroundColor: getClassColor(item) }}
                            >
                              {getItemClass(item) || item.classe}
                            </span>
                            {item.stack === "2x" && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">2x Empilhado</span>
                            )}
                          </div>
                          <p className="font-bold text-slate-800 truncate text-xs md:text-sm uppercase" title={item.nome}>{item.nome}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">Alt: {item.altura}cm • {item.percFardo}% por fardo</p>
                        </div>
                        
                        {/* Remove from Layer Button */}
                        <button 
                          onClick={() => onUpdateQtd(layer.id, itemKey, 0)}
                          className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover produto da camada"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      {/* Controls and Move Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                        {/* Quantity controls */}
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quantidade na Camada</label>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                onUpdateQtd(layer.id, itemKey, Math.max(0, item.totalQtd - step));
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              value={item.totalQtd}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                onUpdateQtd(layer.id, itemKey, isNaN(val) ? 0 : val);
                              }}
                              className="h-9 w-18 text-center font-bold bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                            <button 
                              onClick={() => {
                                onUpdateQtd(layer.id, itemKey, item.totalQtd + step);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>

                          {/* Manual Stacking Option if height <= 15cm */}
                          {item.altura <= 15 && (
                            <div className="mt-3.5 pt-2 border-t border-slate-100">
                              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Empilhamento Manual</p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onToggleStack(layer.id, itemKey)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                                    item.stack === "2x" 
                                      ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700" 
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                  }`}
                                  title={item.stack === "2x" ? "Desativar empilhamento" : "Ativar empilhamento de par em par"}
                                >
                                  <Layers size={13} className={item.stack === "2x" ? "text-white" : "opacity-60"} />
                                  {item.stack === "2x" ? "Empilhado 2x" : "Ativar Empilhamento (2x)"}
                                </button>
                                {item.stack === "2x" && (
                                  <span className="text-[10px] text-slate-400 italic font-medium">Somente em pares</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Move controls */}
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mudar de Camada</label>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <select 
                                value={currentMoveTarget}
                                onChange={(e) => handleTargetChange(itemKey, e.target.value)}
                                className="flex-1 bg-white border border-slate-200 text-xs rounded-xl p-2 font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-w-0"
                              >
                                <option value="">Destino...</option>
                                <option value="new">🆕 Criar Camada</option>
                                {layers.map((l, lIdx) => {
                                  if (l.id === layer.id) return null;
                                  return (
                                    <option key={l.id} value={l.id}>
                                      Camada {lIdx + 1} ({l.percentual.toFixed(0)}% Ocupada)
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {currentMoveTarget && (
                              <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                                <div className="grid grid-cols-2 gap-2 text-center">
                                  <div>
                                    <p className="font-bold text-slate-400 text-[9px] uppercase">Enviar:</p>
                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                      <button 
                                        type="button"
                                        onClick={() => updateMoveQty(currentMoveQty - step)}
                                        className="w-6 h-6 flex items-center justify-center bg-white border rounded text-[10px] font-bold"
                                      >
                                        -
                                      </button>
                                      <span className="font-black text-indigo-600 text-xs">{currentMoveQty}</span>
                                      <button 
                                        type="button"
                                        onClick={() => updateMoveQty(currentMoveQty + step)}
                                        className="w-6 h-6 flex items-center justify-center bg-white border rounded text-[10px] font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-400 text-[9px] uppercase">Ficar:</p>
                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                      <button 
                                        type="button"
                                        onClick={() => updateMoveQty(currentMoveQty + step)}
                                        className="w-6 h-6 flex items-center justify-center bg-white border rounded text-[10px] font-bold"
                                      >
                                        -
                                      </button>
                                      <span className="font-black text-slate-600 text-xs">{currentKeepQty}</span>
                                      <button 
                                        type="button"
                                        onClick={() => updateMoveQty(currentMoveQty - step)}
                                        className="w-6 h-6 flex items-center justify-center bg-white border rounded text-[10px] font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <button 
                                  onClick={() => executeMove(itemKey, maxQty)}
                                  disabled={currentMoveQty <= 0}
                                  className="w-full mt-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-lg text-[11px] transition-all"
                                >
                                  {currentMoveTarget === 'new' ? 'Criar & Mover' : 'Confirmar Envio'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-900 transition-colors"
          >
            Concluir Ajustes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ShareModal({ 
  onClose,
  showToast
}: { 
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    let origin = window.location.origin + window.location.pathname;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  };

  const shareUrl = getShareUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("Link do aplicativo copiado!", "success");
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
      showToast("Falha ao copiar o link.", "error");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Paletizador Inteligente',
          text: 'Confira este aplicativo para otimização de fardos e paletização inteligente!',
          url: shareUrl,
        });
      } catch (err) {
        console.warn("Compartilhamento nativo cancelado ou falhou:", err);
      }
    }
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    'Confira este excelente aplicativo para otimização de fardos e paletização inteligente! Acesse: ' + shareUrl
  )}`;

  const emailUrl = `mailto:?subject=${encodeURIComponent('Paletizador Inteligente')}&body=${encodeURIComponent(
    'Olá, gostaria de compartilhar o Paletizador Inteligente para otimização de carregamento e logística:\n\n' + shareUrl
  )}`;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 cursor-pointer"
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed inset-x-4 bottom-4 md:bottom-auto md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 max-w-lg w-full bg-white rounded-3xl shadow-2xl z-50 border border-slate-150 flex flex-col overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight">Compartilhar Aplicativo</h3>
              <p className="text-[11px] text-slate-400 font-semibold leading-none mt-1">Envie o link de acesso ao aplicativo para outras pessoas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Link Box */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
              Link de Acesso ao Aplicativo
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 text-xs text-slate-500 font-mono truncate select-all">
                {shareUrl}
              </div>
              <button
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 shrink-0 ${
                  copied 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100'
                }`}
              >
                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* QR Code and Quick Share */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* QR Code */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">Escanear com Celular</span>
              <div className="bg-white p-2 rounded-xl border border-slate-200/40 shadow-sm shrink-0 w-[130px] h-[130px] flex items-center justify-center">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=114x114&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR Code de Compartilhamento"
                  className="w-[114px] h-[114px]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[9px] text-slate-400 font-medium leading-tight max-w-[150px]">
                Abra a câmera do celular para abrir o aplicativo instantaneamente
              </p>
            </div>

            {/* Quick Share Buttons */}
            <div className="flex flex-col gap-2 justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">Compartilhamento Rápido</span>
              
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 text-center justify-center"
              >
                <MessageSquare size={16} />
                Enviar via WhatsApp
              </a>

              <a
                href={emailUrl}
                className="flex items-center gap-2.5 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 text-center justify-center"
              >
                <Mail size={16} />
                Enviar via E-mail
              </a>

              {navigator.share && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-2.5 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 justify-center"
                >
                  <Share2 size={16} />
                  Mais Opções do Sistema
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 leading-tight">
            Envie este link para colegas para que eles possam utilizar o Paletizador Inteligente em seus próprios dispositivos.
          </p>
        </div>
      </motion.div>
    </>
  );
}
