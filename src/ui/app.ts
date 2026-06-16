import { FLEET_SPECS } from '../model/constants.ts';
import {
  allPlayerShipsPlaced,
  createInitialState,
  getSunkShipCells,
  opponentFire,
  playerFire,
  startMatch,
  accuracy,
  type GameEngineState,
} from '../model/gameEngine.ts';
import {
  canPlaceShip,
  placeShip,
  randomizeFleet,
} from '../model/fleet.ts';
import { probabilityChooseMove } from '../bots/probability.ts';
import {
  createHuntTargetState,
  huntTargetAfterShot,
  huntTargetChooseMove,
} from '../bots/huntTarget.ts';
import { remainingShipSizes } from '../model/fleet.ts';
import { AiNanoOpponent } from '../ai/opponent.ts';
import {
  checkAvailability,
  ensureModelReady,
  type AvailabilityInfo,
} from '../ai/availability.ts';
import {
  loadSettings,
  resolveOpponent,
  saveSettings,
  type Settings,
} from '../storage/settings.ts';
import {
  animateCell,
  applyPreviewClasses,
  clearPreviewClasses,
  getPreviewCells,
  moveFocus,
  renderBoard,
} from './boards.ts';
import {
  playFire,
  playHit,
  playLose,
  playMiss,
  playSink,
  playWin,
  resumeAudio,
  setMuted,
} from './sounds.ts';
import { coordToLabel } from '../utils/coordinates.ts';
import type {
  Coordinate,
  OpponentType,
  Orientation,
  ShipSpec,
  TranscriptEntry,
} from '../types/game.ts';

export function createApp(root: HTMLElement): void {
  const settings = loadSettings();
  setMuted(settings.muted);

  let availability: AvailabilityInfo = {
    supported: false,
    state: 'unavailable',
    reason: '',
    downloadProgress: null,
  };

  let state = createInitialState(resolveOpponent(settings.opponent, false));
  let selectedShipSpec: ShipSpec | null = null;
  let placementOrientation: Orientation = 'horizontal';
  let placementPreview: Coordinate | null = null;
  let focusedEnemyCell: Coordinate = { row: 0, col: 0 };
  let huntState = createHuntTargetState();
  let transcript: TranscriptEntry[] = [];
  let aiThinking = false;
  let opponentBusy = false;

  const aiOpponent = new AiNanoOpponent({
    onTranscript(entry) {
      transcript = [...transcript, entry];
      render();
    },
    onThinking(thinking) {
      aiThinking = thinking;
      render();
    },
  });

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div>
          <h1>Nano Battleship</h1>
          <p class="subtitle">Classic Battleship with an on-device AI opponent via Chrome's Prompt API (Gemini Nano).</p>
        </div>
        <div class="header-actions">
          <button type="button" id="mute-toggle" class="btn secondary"></button>
          <button type="button" id="new-match" class="btn secondary">New Match</button>
        </div>
      </header>

      <div id="live-region" class="sr-only" aria-live="polite" aria-atomic="true"></div>

      <section class="panel setup-panel">
        <h2>Choose Opponent</h2>
        <div class="opponent-options" id="opponent-options"></div>
        <div id="ai-status" class="ai-status"></div>
      </section>

      <section class="panel status-panel">
        <div id="status-text" class="status-text"></div>
        <div id="stats" class="stats-grid"></div>
      </section>

      <section class="game-layout">
        <div id="player-board-wrap"></div>
        <div id="enemy-board-wrap"></div>
        <aside class="panel side-panel">
          <h2 id="side-panel-title">Log</h2>
          <div id="transcript" class="transcript"></div>
        </aside>
      </section>

      <section class="panel placement-panel">
        <h2>Place Your Fleet</h2>
        <p class="hint">Pick a ship from the palette, drag it onto your board, or use keyboard focus + Enter. Ships cannot overlap or touch.</p>
        <div id="ship-palette" class="ship-palette"></div>
        <div class="placement-controls">
          <button type="button" id="rotate-btn" class="btn secondary">Rotate</button>
          <button type="button" id="randomize-btn" class="btn secondary">Randomize</button>
          <button type="button" id="clear-btn" class="btn secondary">Clear</button>
          <button type="button" id="start-btn" class="btn primary" disabled>Start Battle</button>
        </div>
      </section>
    </div>
  `;

  const liveRegion = root.querySelector('#live-region') as HTMLElement;
  const opponentOptionsEl = root.querySelector('#opponent-options') as HTMLElement;
  const aiStatusEl = root.querySelector('#ai-status') as HTMLElement;
  const statusTextEl = root.querySelector('#status-text') as HTMLElement;
  const statsEl = root.querySelector('#stats') as HTMLElement;
  const playerBoardWrap = root.querySelector('#player-board-wrap') as HTMLElement;
  const enemyBoardWrap = root.querySelector('#enemy-board-wrap') as HTMLElement;
  const sidePanelTitle = root.querySelector('#side-panel-title') as HTMLElement;
  const transcriptEl = root.querySelector('#transcript') as HTMLElement;
  const shipPaletteEl = root.querySelector('#ship-palette') as HTMLElement;
  const startBtn = root.querySelector('#start-btn') as HTMLButtonElement;
  const muteToggle = root.querySelector('#mute-toggle') as HTMLButtonElement;

  function announce(text: string): void {
    liveRegion.textContent = text;
  }

  function currentSettings(): Settings {
    return {
      opponent: state.opponentType,
      muted: settings.muted,
      reducedMotion: settings.reducedMotion,
    };
  }

  function resetToSetup(opponentType?: OpponentType): void {
    aiOpponent.endMatch();
    huntState = createHuntTargetState();
    transcript = [];
    opponentBusy = false;
    selectedShipSpec = null;
    placementPreview = null;
    state = createInitialState(
      resolveOpponent(
        opponentType ?? settings.opponent,
        availability.state === 'available',
      ),
    );
    render();
  }

  function playResultSound(result: import('../types/game.ts').ShotResult): void {
    if (result.kind === 'miss') playMiss();
    else if (result.kind === 'hit') playHit();
    else playSink();
  }

  async function refreshAvailability(): Promise<void> {
    availability = await checkAvailability();
    if (settings.opponent === 'aiNano' && availability.state !== 'available') {
      state = {
        ...state,
        opponentType: resolveOpponent('aiNano', false),
      };
    }
    render();
  }

  async function selectOpponent(type: OpponentType): Promise<void> {
    resumeAudio();
    if (type === 'aiNano') {
      if (availability.state === 'unavailable') return;
      try {
        if (availability.state === 'downloadable' || availability.state === 'downloading') {
          aiStatusEl.textContent = 'Preparing on-device model...';
          await ensureModelReady((progress) => {
            availability = { ...availability, downloadProgress: progress, state: 'downloading' };
            render();
          });
          availability = { ...availability, state: 'available', downloadProgress: 100 };
        }
      } catch (error) {
        aiStatusEl.textContent =
          error instanceof Error ? error.message : 'Failed to prepare AI model.';
        return;
      }
    }

    settings.opponent = type;
    state = { ...state, opponentType: type };
    saveSettings(currentSettings());
    render();
  }

  function renderOpponentOptions(): void {
    opponentOptionsEl.innerHTML = '';
    aiStatusEl.replaceChildren();
    const options: Array<{ type: OpponentType; label: string; description: string }> = [
      {
        type: 'huntTarget',
        label: 'Hunt/Target Bot',
        description: 'Classic search-and-destroy with parity hunting.',
      },
      {
        type: 'probability',
        label: 'Probability Bot',
        description: 'Heatmap-based placement density targeting.',
      },
      {
        type: 'aiNano',
        label: 'AI-Nano',
        description: 'On-device Gemini Nano via Chrome Prompt API.',
      },
    ];

    for (const option of options) {
      const label = document.createElement('label');
      label.className = 'opponent-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'opponent';
      input.value = option.type;
      input.checked = state.opponentType === option.type;
      const disabled =
        option.type === 'aiNano' && availability.state !== 'available';
      input.disabled = disabled;

      const text = document.createElement('div');
      text.innerHTML = `<strong>${option.label}</strong><span>${option.description}</span>`;
      if (disabled) {
        const reason = document.createElement('small');
        reason.className = 'disabled-reason';
        reason.textContent = availability.reason || 'AI unavailable on this browser.';
        text.appendChild(reason);
      }

      input.addEventListener('change', () => {
        void selectOpponent(option.type);
      });

      label.appendChild(input);
      label.appendChild(text);
      opponentOptionsEl.appendChild(label);
    }

    if (availability.state === 'downloadable') {
      aiStatusEl.replaceChildren();
      const enableBtn = document.createElement('button');
      enableBtn.type = 'button';
      enableBtn.className = 'btn secondary';
      enableBtn.textContent = 'Enable On-Device AI';
      enableBtn.addEventListener('click', () => {
        void selectOpponent('aiNano');
      });
      aiStatusEl.appendChild(enableBtn);
    } else if (availability.state === 'downloading') {
      aiStatusEl.textContent = `Downloading model... ${availability.downloadProgress ?? 0}%`;
    } else if (availability.state === 'available') {
      aiStatusEl.textContent = 'On-device AI ready.';
    } else if (availability.state === 'unavailable') {
      aiStatusEl.textContent = availability.reason;
    } else {
      aiStatusEl.textContent = '';
    }
  }

  function renderPalette(): void {
    shipPaletteEl.innerHTML = '';
    for (const spec of FLEET_SPECS) {
      const placed = state.playerShips.some((s) => s.spec.id === spec.id);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `ship-chip ${placed ? 'placed' : ''} ${selectedShipSpec?.id === spec.id ? 'selected' : ''}`;
      chip.draggable = !placed && state.phase === 'setup';
      chip.disabled = placed || state.phase !== 'setup';
      chip.textContent = `${spec.name} (${spec.length})`;
      chip.addEventListener('click', () => {
        if (placed) return;
        selectedShipSpec = spec;
        render();
      });
      chip.addEventListener('dragstart', (event) => {
        selectedShipSpec = spec;
        event.dataTransfer?.setData('text/plain', spec.id);
      });
      shipPaletteEl.appendChild(chip);
    }
  }

  function renderStatus(state: GameEngineState): void {
    if (state.phase === 'setup') {
      statusTextEl.textContent = 'Place your fleet, then start the battle.';
      return;
    }
    if (state.phase === 'finished') {
      statusTextEl.textContent =
        state.winner === 'player'
          ? 'You win! All enemy ships sunk.'
          : 'You lose. Your fleet has been destroyed.';
      return;
    }
    if (opponentBusy || aiThinking) {
      statusTextEl.textContent = 'Opponent is thinking...';
      return;
    }
    statusTextEl.textContent =
      state.turn === 'player'
        ? 'Your turn — fire at the enemy grid.'
        : 'Opponent turn...';
  }

  function renderStats(state: GameEngineState): void {
    statsEl.innerHTML = `
      <div><strong>You</strong><br/>Shots: ${state.playerStats.shots}<br/>Hits: ${state.playerStats.hits}<br/>Accuracy: ${accuracy(state.playerStats)}%<br/>Turns: ${state.playerStats.turns}</div>
      <div><strong>Opponent</strong><br/>Shots: ${state.opponentStats.shots}<br/>Hits: ${state.opponentStats.hits}<br/>Accuracy: ${accuracy(state.opponentStats)}%<br/>Turns: ${state.opponentStats.turns}</div>
    `;
  }

  function renderTranscript(): void {
    sidePanelTitle.textContent =
      state.opponentType === 'aiNano' ? 'AI Transcript' : 'Move Log';
    transcriptEl.innerHTML = '';
    if (transcript.length === 0) {
      transcriptEl.innerHTML = '<p class="empty-log">No moves yet.</p>';
      return;
    }
    for (const entry of transcript.slice().reverse()) {
      const item = document.createElement('div');
      item.className = `transcript-entry ${entry.kind}`;
      item.textContent = entry.text;
      transcriptEl.appendChild(item);
    }
  }

  function updatePlacementPreview(coord: Coordinate | null): void {
    placementPreview = coord;
    if (!selectedShipSpec || !placementPreview || state.phase !== 'setup') {
      clearPreviewClasses(playerBoardWrap);
      return;
    }
    applyPreviewClasses(
      playerBoardWrap,
      getPreviewCells(
        placementPreview,
        selectedShipSpec.length,
        placementOrientation,
      ),
      canPlaceShip(
        state.playerShips,
        selectedShipSpec,
        placementPreview,
        placementOrientation,
      ),
    );
  }

  function tryPlaceShipAt(coord: Coordinate): void {
    if (!selectedShipSpec || state.phase !== 'setup') return;
    if (!canPlaceShip(state.playerShips, selectedShipSpec, coord, placementOrientation)) {
      announce('Illegal placement.');
      return;
    }
    state = {
      ...state,
      playerShips: placeShip(
        state.playerShips,
        selectedShipSpec,
        coord,
        placementOrientation,
      ),
    };
    selectedShipSpec = null;
    placementPreview = null;
    render();
  }

  function renderBoards(): void {
    playerBoardWrap.replaceChildren(
      renderBoard({
        id: 'player',
        title: 'Your Fleet',
        interactive: state.phase === 'setup',
        showShips: true,
        ships: state.playerShips,
        shotBoard: state.opponentView,
        sunkCells: getSunkShipCells(state.playerShips),
        onCellKeydown: (coord, event) => {
          if (state.phase !== 'setup') return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            tryPlaceShipAt(coord);
          }
        },
      }),
    );
    updatePlacementPreview(placementPreview);

    const enemyInteractive =
      state.phase === 'playing' &&
      state.turn === 'player' &&
      !opponentBusy &&
      !aiThinking;

    enemyBoardWrap.replaceChildren(
      renderBoard({
        id: 'enemy',
        title: 'Enemy Waters',
        interactive: enemyInteractive,
        showShips: state.phase === 'finished',
        ships: state.opponentShips,
        shotBoard: state.playerView,
        sunkCells: getSunkShipCells(state.opponentShips),
        focusedCell: focusedEnemyCell,
        onCellClick: (coord) => {
          void handlePlayerFire(coord);
        },
        onCellKeydown: (coord, event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusedEnemyCell = moveFocus(focusedEnemyCell, 'up');
            render();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusedEnemyCell = moveFocus(focusedEnemyCell, 'down');
            render();
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focusedEnemyCell = moveFocus(focusedEnemyCell, 'left');
            render();
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            focusedEnemyCell = moveFocus(focusedEnemyCell, 'right');
            render();
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void handlePlayerFire(coord);
          }
        },
      }),
    );
  }

  playerBoardWrap.addEventListener('click', (event) => {
    if (state.phase !== 'setup' || !selectedShipSpec) return;
    const cell = (event.target as HTMLElement).closest('.board-cell');
    if (!cell) return;
    tryPlaceShipAt({
      row: Number(cell.getAttribute('data-row')),
      col: Number(cell.getAttribute('data-col')),
    });
  });

  playerBoardWrap.addEventListener('mousemove', (event) => {
    if (state.phase !== 'setup' || !selectedShipSpec) return;
    const cell = (event.target as HTMLElement).closest('.board-cell');
    if (!cell) return;
    updatePlacementPreview({
      row: Number(cell.getAttribute('data-row')),
      col: Number(cell.getAttribute('data-col')),
    });
  });

  playerBoardWrap.addEventListener('mouseleave', () => {
    if (state.phase !== 'setup') return;
    updatePlacementPreview(null);
  });

  playerBoardWrap.addEventListener('dragover', (event) => {
    if (state.phase !== 'setup') return;
    event.preventDefault();
  });

  playerBoardWrap.addEventListener('drop', (event) => {
    if (state.phase !== 'setup') return;
    event.preventDefault();
    const cell = (event.target as HTMLElement).closest('.board-cell');
    if (!cell) return;
    tryPlaceShipAt({
      row: Number(cell.getAttribute('data-row')),
      col: Number(cell.getAttribute('data-col')),
    });
  });

  async function handlePlayerFire(coord: Coordinate): Promise<void> {
    if (state.phase !== 'playing' || state.turn !== 'player') return;
    resumeAudio();
    playFire();
    const outcome = playerFire(state, coord);
    if (!outcome) return;

    state = outcome.state;
    playResultSound(outcome.result);
    animateCell('enemy', coord, `anim-${outcome.result.kind}`, settings.reducedMotion);
    announce(
      `${coordToLabel(coord)}: ${outcome.result.kind}${outcome.continuesTurn ? '. Hit — fire again.' : '. Turn over.'}`,
    );

    if (state.phase === 'finished') {
      if (state.winner === 'player') playWin();
      render();
      return;
    }

    render();
    if (!outcome.continuesTurn) {
      await runOpponentTurn();
    }
  }

  async function runOpponentTurn(): Promise<void> {
    if (state.phase !== 'playing' || state.turn !== 'opponent') return;
    opponentBusy = true;
    render();

    while (state.phase === 'playing' && state.turn === 'opponent') {
      const coord = await chooseOpponentMove();
      resumeAudio();
      playFire();
      const outcome = opponentFire(state, coord);
      if (!outcome) break;

      state = outcome.state;
      playResultSound(outcome.result);

      if (state.opponentType !== 'aiNano') {
        transcript = [
          ...transcript,
          {
            id: crypto.randomUUID(),
            kind: 'bot-move',
            text: `${coordToLabel(coord)} → ${outcome.result.kind}`,
            timestamp: Date.now(),
          },
        ];
      }

      animateCell('player', coord, `anim-${outcome.result.kind}`, settings.reducedMotion);
      announce(
        `Opponent fired ${coordToLabel(coord)}: ${outcome.result.kind}`,
      );

      if (state.opponentType === 'huntTarget') {
        huntState = huntTargetAfterShot(huntState, {
          coord,
          result: outcome.result,
        });
      }

      if (state.phase === 'finished') {
        playLose();
        break;
      }

      if (!outcome.continuesTurn) break;
      render();
      await delay(state.opponentType === 'aiNano' ? 300 : 500);
    }

    opponentBusy = false;
    render();
  }

  async function chooseOpponentMove(): Promise<Coordinate> {
    const board = state.opponentView;
    const history = state.opponentShotHistory;
    const sizes = remainingShipSizes(state.playerShips);
    const last = history[history.length - 1] ?? null;

    if (state.opponentType === 'probability') {
      return probabilityChooseMove(board, history, sizes);
    }

    if (state.opponentType === 'aiNano') {
      const move = await aiOpponent.chooseMove(
        board,
        state.playerShips,
        history,
        last,
      );
      return { row: move.row, col: move.col };
    }

    const result = huntTargetChooseMove(board, history, sizes, huntState);
    huntState = result.state;
    return result.coord;
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function render(): void {
    renderOpponentOptions();
    renderPalette();
    renderStatus(state);
    renderStats(state);
    renderTranscript();
    renderBoards();
    startBtn.disabled = !allPlayerShipsPlaced(state.playerShips) || state.phase !== 'setup';
    muteToggle.textContent = settings.muted ? 'Unmute' : 'Mute';
  }

  root.querySelector('#rotate-btn')?.addEventListener('click', () => {
    if (!selectedShipSpec) {
      announce('Select a ship from the palette first.');
      return;
    }
    placementOrientation =
      placementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    updatePlacementPreview(placementPreview);
    render();
  });

  root.querySelector('#randomize-btn')?.addEventListener('click', () => {
    state = { ...state, playerShips: randomizeFleet() };
    selectedShipSpec = null;
    render();
  });

  root.querySelector('#clear-btn')?.addEventListener('click', () => {
    state = { ...state, playerShips: [] };
    selectedShipSpec = null;
    render();
  });

  startBtn.addEventListener('click', async () => {
    resumeAudio();
    state = startMatch(state);
    huntState = createHuntTargetState();
    transcript = [];
    announce(
      state.turn === 'player'
        ? 'Battle started. You fire first.'
        : 'Battle started. Opponent fires first.',
    );
    render();
    if (state.opponentType === 'aiNano') {
      await aiOpponent.prepare();
      await aiOpponent.startMatch(state.playerShips);
    }
    if (state.turn === 'opponent') {
      await runOpponentTurn();
    }
  });

  muteToggle.addEventListener('click', () => {
    settings.muted = !settings.muted;
    setMuted(settings.muted);
    saveSettings(currentSettings());
    render();
  });

  root.querySelector('#new-match')?.addEventListener('click', () => {
    resetToSetup();
  });

  settings.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  void refreshAvailability();
  render();
}
