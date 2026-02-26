import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bomb, Flag, Clock, RotateCcw, Trophy, Skull, Settings2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

type Difficulty = 'easy' | 'medium' | 'hard';

interface GameConfig {
  rows: number;
  cols: number;
  mines: number;
}

const CONFIGS: Record<Difficulty, GameConfig> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
};

interface CellData {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
}

type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [minesLeft, setMinesLeft] = useState(0);
  const [timer, setTimer] = useState(0);
  const [showDifficultyMenu, setShowDifficultyMenu] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const initBoard = useCallback((diff: Difficulty) => {
    const { rows, cols, mines } = CONFIGS[diff];
    const newGrid: CellData[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: CellData[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          r, c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborCount: 0,
        });
      }
      newGrid.push(row);
    }
    
    setGrid(newGrid);
    setStatus('idle');
    setMinesLeft(mines);
    setTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    initBoard(difficulty);
  }, [difficulty, initBoard]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const placeMines = (firstR: number, firstC: number, currentGrid: CellData[][]) => {
    const { rows, cols, mines } = CONFIGS[difficulty];
    let minesPlaced = 0;
    const newGrid = [...currentGrid.map(row => [...row])];

    while (minesPlaced < mines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      // Don't place mine on the first clicked cell or its neighbors to ensure a "safe start"
      const isNearFirstClick = Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1;

      if (!newGrid[r][c].isMine && !isNearFirstClick) {
        newGrid[r][c].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!newGrid[r][c].isMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && newGrid[nr][nc].isMine) {
                count++;
              }
            }
          }
          newGrid[r][c].neighborCount = count;
        }
      }
    }
    return newGrid;
  };

  const revealCell = (r: number, c: number) => {
    if (status === 'won' || status === 'lost' || grid[r][c].isRevealed || grid[r][c].isFlagged) return;

    let currentGrid = [...grid.map(row => [...row])];
    let currentStatus = status;

    if (status === 'idle') {
      currentGrid = placeMines(r, c, currentGrid);
      currentStatus = 'playing';
      setStatus('playing');
      startTimer();
    }

    if (currentGrid[r][c].isMine) {
      // Game Over
      currentGrid[r][c].isRevealed = true;
      // Reveal all mines
      currentGrid.forEach(row => row.forEach(cell => {
        if (cell.isMine) cell.isRevealed = true;
      }));
      setGrid(currentGrid);
      setStatus('lost');
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const floodFill = (row: number, col: number, g: CellData[][]) => {
      if (row < 0 || row >= g.length || col < 0 || col >= g[0].length || g[row][col].isRevealed || g[row][col].isMine || g[row][col].isFlagged) return;
      
      g[row][col].isRevealed = true;
      
      if (g[row][col].neighborCount === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            floodFill(row + dr, col + dc, g);
          }
        }
      }
    };

    floodFill(r, c, currentGrid);
    
    // Check win
    const { rows, cols, mines } = CONFIGS[difficulty];
    let revealedCount = 0;
    currentGrid.forEach(row => row.forEach(cell => {
      if (cell.isRevealed) revealedCount++;
    }));

    if (revealedCount === rows * cols - mines) {
      setStatus('won');
      if (timerRef.current) clearInterval(timerRef.current);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    setGrid(currentGrid);
  };

  const toggleFlag = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status === 'won' || status === 'lost' || grid[r][c].isRevealed) return;

    const newGrid = [...grid.map(row => [...row])];
    const isFlagged = !newGrid[r][c].isFlagged;
    newGrid[r][c].isFlagged = isFlagged;
    setGrid(newGrid);
    setMinesLeft(prev => isFlagged ? prev - 1 : prev + 1);
    
    if (status === 'idle') {
      setStatus('playing');
      startTimer();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#F5F5F0] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-5xl font-serif italic tracking-tight mb-2">Minesweeper</h1>
            <p className="text-sm opacity-60 uppercase tracking-widest font-mono">Modern Edition / v1.0</p>
          </div>
          
          <div className="flex items-center gap-6 bg-white p-4 rounded-2xl shadow-sm border border-black/5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider opacity-40 font-bold mb-1 flex items-center gap-1">
                <Bomb size={10} /> Mines
              </span>
              <span className="text-2xl font-mono font-medium leading-none">
                {minesLeft.toString().padStart(3, '0')}
              </span>
            </div>
            
            <div className="w-px h-8 bg-black/5" />
            
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider opacity-40 font-bold mb-1 flex items-center gap-1">
                <Clock size={10} /> Time
              </span>
              <span className="text-2xl font-mono font-medium leading-none">
                {formatTime(timer)}
              </span>
            </div>

            <button 
              onClick={() => initBoard(difficulty)}
              className="p-3 bg-[#141414] text-[#F5F5F0] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-6">
          <div className="relative">
            <button 
              onClick={() => setShowDifficultyMenu(!showDifficultyMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-black/5 text-sm font-medium hover:bg-black/5 transition-colors"
            >
              <Settings2 size={16} />
              <span className="capitalize">{difficulty}</span>
              <ChevronDown size={14} className={`transition-transform ${showDifficultyMenu ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showDifficultyMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden z-50"
                >
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDifficulty(d);
                        setShowDifficultyMenu(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-black/5 transition-colors capitalize ${difficulty === d ? 'font-bold bg-black/5' : ''}`}
                    >
                      {d}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Board Container */}
        <div className="relative group">
          <div 
            className="bg-white p-4 rounded-3xl shadow-xl border border-black/5 overflow-auto max-h-[70vh] scrollbar-hide"
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${CONFIGS[difficulty].cols}, minmax(32px, 1fr))`,
              gap: '4px',
              width: 'fit-content',
              margin: '0 auto'
            }}
          >
            {grid.map((row, r) => (
              row.map((cell, c) => (
                <Cell 
                  key={`${r}-${c}`} 
                  cell={cell} 
                  onClick={() => revealCell(r, c)}
                  onContextMenu={(e) => toggleFlag(e, r, c)}
                  status={status}
                />
              ))
            ))}
          </div>

          {/* Game Over Overlay */}
          <AnimatePresence>
            {(status === 'won' || status === 'lost') && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-40 flex items-center justify-center bg-[#F5F5F0]/60 backdrop-blur-sm rounded-3xl"
              >
                <div className="bg-[#141414] text-[#F5F5F0] p-8 rounded-3xl shadow-2xl text-center max-w-xs w-full mx-4">
                  <div className="mb-4 flex justify-center">
                    {status === 'won' ? (
                      <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Trophy size={32} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center">
                        <Skull size={32} />
                      </div>
                    )}
                  </div>
                  <h2 className="text-3xl font-serif italic mb-2">
                    {status === 'won' ? 'Victory!' : 'Game Over'}
                  </h2>
                  <p className="text-sm opacity-60 mb-6 uppercase tracking-widest font-mono">
                    {status === 'won' ? `Cleared in ${timer}s` : 'Better luck next time'}
                  </p>
                  <button 
                    onClick={() => initBoard(difficulty)}
                    className="w-full py-3 bg-[#F5F5F0] text-[#141414] rounded-xl font-bold hover:scale-105 active:scale-95 transition-all"
                  >
                    Play Again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <footer className="mt-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-30 font-bold">
            Left Click: Reveal · Right Click: Flag
          </p>
        </footer>
      </div>
    </div>
  );
}

function Cell({ cell, onClick, onContextMenu, status }: { 
  cell: CellData, 
  onClick: () => void, 
  onContextMenu: (e: React.MouseEvent) => void,
  status: GameStatus,
  key?: string
}) {
  const getNumberColor = (count: number) => {
    const colors = [
      '', 'text-blue-500', 'text-emerald-500', 'text-rose-500', 
      'text-indigo-500', 'text-amber-500', 'text-cyan-500', 
      'text-purple-500', 'text-slate-500'
    ];
    return colors[count] || '';
  };

  const isRevealed = cell.isRevealed;
  const isMine = cell.isMine;
  const isFlagged = cell.isFlagged;

  return (
    <motion.div
      whileHover={!isRevealed && status === 'playing' ? { scale: 1.1, zIndex: 10 } : {}}
      whileTap={!isRevealed && status === 'playing' ? { scale: 0.9 } : {}}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-sm font-mono font-bold rounded-lg cursor-pointer transition-colors
        ${isRevealed 
          ? (isMine ? 'bg-rose-500 text-white' : 'bg-black/5') 
          : 'bg-white border border-black/5 shadow-sm hover:bg-black/5'}
      `}
    >
      {isRevealed ? (
        isMine ? (
          <Bomb size={16} />
        ) : (
          cell.neighborCount > 0 ? (
            <span className={getNumberColor(cell.neighborCount)}>{cell.neighborCount}</span>
          ) : null
        )
      ) : (
        isFlagged ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <Flag size={14} className="text-rose-500 fill-rose-500/20" />
          </motion.div>
        ) : null
      )}
    </motion.div>
  );
}
