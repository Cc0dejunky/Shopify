/**
 * Hacker Slots - Sequential Stagger System (v10.0)
 * Light Theme | Shuffled Random Reveal | "Perfect" Binary Scramble
 */

import { useState, useEffect, useRef } from 'react';
import '../styles/SlotMachine.css';

const GRID_SIZE = 5;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;
const SYMBOLS = ['0', '1'] as const;
type Symbol = typeof SYMBOLS[number];

const STAGGER_MS = 200;
const MIN_DUR = 3000;
const MAX_DUR = 5000;

interface SlotCell {
    id: string;
    displayValue: Symbol;
    isLocked: boolean;
}

interface WinMetadata {
    id: string;
    title: string;
    description: string;
    header: string;
}

interface SpinResult {
    success: boolean;
    grid: Symbol[][];
    nonce: number;
    revealedServerSeed: string;
    winningPrize?: WinMetadata;
}

interface BalanceResponse {
    gold_coins: number;
    bonus_credits: number;
    onboarding_completed: boolean;
    favorite_categories: string[];
    customerId?: string;
}

function shuffle<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export default function SlotMachine({ isLoggedIn, customerName }: { isLoggedIn: boolean; customerName?: string }) {
    const [isClient, setIsClient] = useState(false);

    // Game state
    const [grid, setGrid] = useState<SlotCell[]>([]);
    const [goldCoins, setGoldCoins] = useState<number>(0);
    const [bonusCredits, setBonusCredits] = useState<number>(0);
    const [spinning, setSpinning] = useState<boolean>(false);
    const [activeWin, setActiveWin] = useState<WinMetadata | null>(null);
    const [gameMode, setGameMode] = useState<'social' | 'sweep'>('sweep');

    // Provably fair state
    const [clientSeed] = useState<string>(Math.random().toString(36).substring(7));
    const [nonce, setNonce] = useState<number>(0);

    // Animation Refs
    const animationFrameRef = useRef<number | null>(null);
    const cellStatesRef = useRef<{ lastUpdate: number; interval: number; currentSymbol: Symbol; isLocked: boolean }[]>([]);

    useEffect(() => {
        setIsClient(true);
        const initialGrid = Array(CELL_COUNT).fill(null).map((_, i) => ({
            id: `init-${i}`,
            displayValue: Math.round(Math.random()).toString() as Symbol,
            isLocked: false
        }));
        setGrid(initialGrid);

        cellStatesRef.current = Array(CELL_COUNT).fill(null).map(() => ({
            lastUpdate: performance.now(),
            interval: Math.random() * 80 + 30, // RAPID Scramble timing
            currentSymbol: Math.round(Math.random()).toString() as Symbol,
            isLocked: false
        }));

        void loadBalances();
    }, [isLoggedIn]);

    // Binary Scramble Loop (Pure 0/1) - "PERFECT" Scramble logic
    useEffect(() => {
        if (!spinning) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const updateCells = (timestamp: number) => {
            let changed = false;
            const newGrid = [...grid];

            cellStatesRef.current.forEach((state, i) => {
                if (state.isLocked) return;

                const elapsed = timestamp - state.lastUpdate;
                if (elapsed >= state.interval) {
                    state.currentSymbol = Math.round(Math.random()).toString() as Symbol;
                    newGrid[i] = { ...newGrid[i], displayValue: state.currentSymbol, isLocked: false };

                    state.interval = Math.random() * 60 + 20; // Fast but rhythmic
                    state.lastUpdate = timestamp;
                    changed = true;
                }
            });

            if (changed) setGrid(newGrid);
            animationFrameRef.current = requestAnimationFrame(updateCells);
        };

        animationFrameRef.current = requestAnimationFrame(updateCells);
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [spinning, grid]);

    async function loadBalances() {
        try {
            const response = await fetch('/api/customer/credits');
            const data = (await response.json()) as BalanceResponse;
            setGoldCoins(data.gold_coins || 0);
            setBonusCredits(data.bonus_credits || 0);
        } catch (error) {
            console.error('[CORE] Sync failed');
        }
    }

    async function handleSpin() {
        if (spinning) return;
        const balance = gameMode === 'social' ? goldCoins : bonusCredits;
        if (balance < 1) {
            alert(`LOW_FUNDS: REQ 1 ${gameMode === 'social' ? 'Gold Coin' : 'Bonus Credit'}`);
            return;
        }

        setSpinning(true);
        setActiveWin(null);

        // Reset all lock states
        cellStatesRef.current.forEach(s => s.isLocked = false);
        setGrid(prev => prev.map(c => ({ ...c, isLocked: false })));

        try {
            const response = await fetch('/api/games/hacker-slots/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientSeed, nonce: nonce + 1, gameType: gameMode }),
            });

            const result = (await response.json()) as SpinResult;

            if (result.success) {
                const finalValues = result.grid.flat();

                // SHUFFLED RANDOM REVEAL
                const shuffledIndices = shuffle(Array.from({ length: CELL_COUNT }, (_, i) => i));
                let completedCount = 0;

                shuffledIndices.forEach((cellIndex, orderIndex) => {
                    // Perfect Stagger Timing (3-5 seconds variance)
                    const lockDelay = (orderIndex * STAGGER_MS) + MIN_DUR + (Math.random() * (MAX_DUR - MIN_DUR) * 0.4);

                    setTimeout(() => {
                        cellStatesRef.current[cellIndex].isLocked = true;
                        cellStatesRef.current[cellIndex].currentSymbol = finalValues[cellIndex];

                        setGrid(prev => {
                            const updated = [...prev];
                            updated[cellIndex] = {
                                ...updated[cellIndex],
                                displayValue: finalValues[cellIndex],
                                isLocked: true
                            };
                            return updated;
                        });

                        completedCount++;
                        if (completedCount === CELL_COUNT) {
                            finalizeSpin(result);
                        }
                    }, lockDelay);
                });
            }
        } catch (error) {
            console.error('[CORE] Breach failed');
            setSpinning(false);
        }
    }

    function finalizeSpin(result: SpinResult) {
        setSpinning(false);
        setNonce(result.nonce);

        if (gameMode === 'social') setGoldCoins(prev => prev - 1);
        else setBonusCredits(prev => prev - 1);

        if (result.winningPrize) {
            setTimeout(() => setActiveWin(result.winningPrize || null), 800);
        }
    }

    if (!isClient) return <div className="hacker-slots-container"><div className="brand-body">INITIALIZING...</div></div>;

    return (
        <div className="hacker-slots-container">
            <nav className="game-nav-bar">
                <a href="/" className="nav-link">&larr; ABORT_MISSION</a>
                <span className="brand-body">AGENT_NODE: {customerName || 'SECURE_ACCESS'}</span>
                {isLoggedIn ? (
                    <a href="https://shopify.com/71568162972/account" className="nav-link" target="_blank" rel="noopener noreferrer">MY_ACCOUNT</a>
                ) : (
                    <a href="/account/login" className="nav-link">IDENTITY_LINK</a>
                )}
            </nav>

            <header className="terminal-header text-center">
                <h1 className="brand-h1">HACKER SLOTS</h1>
                <p className="brand-body">DECRYPTION_PROTOCOL: ACTIVE &bull; {gameMode.toUpperCase()}_MODE</p>
            </header>

            <div className="stats-bar">
                <button
                    type="button"
                    className={`balance-box ${gameMode === 'social' ? 'active-mode' : ''}`}
                    onClick={() => setGameMode('social')}
                >
                    <span className="brand-body balance-label">GOLD_COINS</span>
                    <h2 className="brand-h2">{goldCoins}</h2>
                </button>
                <button
                    type="button"
                    className={`balance-box ${gameMode === 'sweep' ? 'active-mode' : ''}`}
                    onClick={() => setGameMode('sweep')}
                >
                    <span className="brand-body balance-label">BONUS_CREDITS</span>
                    <h2 className="brand-h2">{bonusCredits}</h2>
                </button>
            </div>

            <main className="grid-container">
                <div className="slot-grid-fixed">
                    {grid.map((cell) => (
                        <div
                            key={cell.id}
                            className={`hacker-grid-cell ${spinning && !cell.isLocked ? 'is-decrypting' : ''} ${cell.isLocked ? 'is-locked-cell' : ''}`}
                        >
                            <span className="cell-value">
                                {cell.displayValue}
                            </span>
                        </div>
                    ))}
                </div>
            </main>

            <button
                type="button"
                className="spin-button-action"
                onClick={() => { void handleSpin(); }}
                disabled={spinning}
            >
                {spinning ? 'BREACHING...' : `INITIALIZE_BREACH`}
            </button>

            {activeWin && (
                <div className="win-overlay">
                    <div className="win-module">
                        <h1 className="brand-h1 win-title">{activeWin.header}</h1>
                        <h2 className="brand-h2 win-subtitle">{activeWin.title}</h2>
                        <p className="brand-body win-description">{activeWin.description}</p>
                        <button type="button" className="spin-button-action" onClick={() => setActiveWin(null)}>SECURE_DATA</button>
                    </div>
                </div>
            )}

            <div className="integrity-hub">
                <table className="integrity-table">
                    <tbody>
                        <tr>
                            <td>[SYSTEM_TRANSPARENCY]</td>
                            <td className="text-right">[STATUS_OK]</td>
                        </tr>
                        <tr>
                            <td>PRIZE_POOL_ALLOCATION</td>
                            <td className="text-right">50%</td>
                        </tr>
                        <tr>
                            <td>OPERATIONAL_FEE</td>
                            <td className="text-right">8%</td>
                        </tr>
                        <tr>
                            <td>PLATFORM_PROFIT</td>
                            <td className="text-right">42%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
