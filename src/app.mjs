import { estimateSettings } from './domain/estimate.mjs';
import { representativeRunToCsv } from './domain/csv.mjs';
import { STAR_HANAHANA } from './domain/machine.mjs';
import {
  buildEstimateViewModel,
  buildRepresentativeRunViewModel,
  buildSimulationViewModel,
} from './ui/view-model.mjs';
import {
  renderEstimateResult,
  renderRepresentativeRun,
  renderSimulationResult,
} from './ui/render.mjs';

const ESTIMATE_STORAGE_KEY = 'hana-scope:estimate-state';
const MACHINE_INPUT_KEYS = ['games', 'big', 'regular'];
const COUNTER_KEYS = ['watchedBig', 'bigWatermelon', 'watchedReg'];
const COLOUR_GROUPS = ['regSideLamp', 'featherAfterBig', 'featherAfterReg'];

const estimateForm = document.querySelector('#estimate-form');
const estimateResult = document.querySelector('#estimate-result');
const estimateError = document.querySelector('#estimate-error');
const priorPanel = document.querySelector('#prior-panel');
const priorGrid = document.querySelector('#prior-grid');
const screenButtons = [...document.querySelectorAll('[data-screen]')];
const screenPanels = [...document.querySelectorAll('[data-screen-panel]')];
const simulationForm = document.querySelector('#simulation-form');
const simulationTitle = document.querySelector('#simulation-title');
const simulationOverview = document.querySelector('#simulation-overview');
const simulationResult = document.querySelector('#simulation-result');
const simulationError = document.querySelector('#simulation-error');
const simulationProgress = document.querySelector('#simulation-progress');
const simulationStatus = document.querySelector('#simulation-status');
const simulationPercent = document.querySelector('#simulation-percent');
const simulationStart = document.querySelector('#simulation-start');
const simulationCancel = document.querySelector('#simulation-cancel');
const runDetail = document.querySelector('#run-detail');

const markupParser = new DOMParser();

// All markup comes from the app's own renderers; every interpolated value is a validated
// integer, a formatted percentage or a fixed label, never free text from the user.
function renderInto(element, markup) {
  const parsed = markupParser.parseFromString(markup, 'text/html');
  element.replaceChildren(...parsed.body.childNodes);
}

function defaultEstimateState() {
  return {
    games: 0,
    big: 0,
    regular: 0,
    watchedBig: 0,
    bigWatermelon: 0,
    watchedReg: 0,
    regSideLamp: {},
    featherAfterBig: {},
    featherAfterReg: {},
    undo: { regSideLamp: [], featherAfterBig: [], featherAfterReg: [] },
    useAnalysisEvidence: true,
  };
}

function loadEstimateState() {
  const base = defaultEstimateState();
  try {
    const stored = JSON.parse(localStorage.getItem(ESTIMATE_STORAGE_KEY));
    if (!stored || typeof stored !== 'object') return base;
    const state = { ...base };
    for (const key of [...MACHINE_INPUT_KEYS, ...COUNTER_KEYS]) {
      const value = Number(stored[key]);
      if (Number.isInteger(value) && value >= 0) state[key] = value;
    }
    for (const group of COLOUR_GROUPS) {
      state[group] = { ...(stored[group] ?? {}) };
      state.undo[group] = Array.isArray(stored.undo?.[group]) ? [...stored.undo[group]] : [];
    }
    if (typeof stored.useAnalysisEvidence === 'boolean') state.useAnalysisEvidence = stored.useAnalysisEvidence;
    return state;
  } catch {
    return base;
  }
}

let estimateState = loadEstimateState();
let activePrior;
let simulationWorker;
let activeRequestId;
let latestSimulationResult;
let latestCoinValueYen = 20;
let selectedRun;

renderInto(priorGrid, STAR_HANAHANA.settings.map(({ setting }) => `
  <label><span>設定${setting}</span><input type="number" min="0.01" step="0.1" value="1" data-prior-setting="${setting}" inputmode="decimal"></label>
`).join(''));

function saveEstimateState() {
  try {
    localStorage.setItem(ESTIMATE_STORAGE_KEY, JSON.stringify(estimateState));
  } catch {
    // Storage is optional; the estimator remains usable without it.
  }
}

function observedFromState() {
  return {
    watchedBig: estimateState.watchedBig,
    watchedReg: estimateState.watchedReg,
    bigWatermelon: estimateState.bigWatermelon,
    regSideLamp: { ...estimateState.regSideLamp },
    featherAfterBig: { ...estimateState.featherAfterBig },
    featherAfterReg: { ...estimateState.featherAfterReg },
  };
}

function renderEstimate() {
  const result = estimateSettings({
    machine: STAR_HANAHANA,
    games: estimateState.games,
    big: estimateState.big,
    regular: estimateState.regular,
    prior: activePrior,
    observed: observedFromState(),
    useAnalysisEvidence: estimateState.useAnalysisEvidence,
  });
  renderInto(estimateResult, renderEstimateResult(buildEstimateViewModel(result)));
}

function refreshEstimate({ scroll = false } = {}) {
  try {
    estimateError.textContent = '';
    renderEstimate();
    if (scroll) estimateResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    estimateError.textContent = error.message;
  }
}

function syncEstimateForm() {
  for (const key of MACHINE_INPUT_KEYS) estimateForm.elements[key].value = estimateState[key];
  for (const key of COUNTER_KEYS) {
    estimateForm.querySelector(`[data-counter="${key}"] output`).textContent = estimateState[key];
  }
  for (const group of COLOUR_GROUPS) {
    const fieldset = estimateForm.querySelector(`[data-evidence="${group}"]`);
    fieldset.querySelectorAll('.colour-chip').forEach((chip) => {
      chip.querySelector('output').textContent = estimateState[group][chip.dataset.colour] ?? 0;
    });
    fieldset.querySelector('[data-action="undo"]').disabled = estimateState.undo[group].length === 0;
  }
  estimateForm.elements.useAnalysisEvidence.checked = estimateState.useAnalysisEvidence;
}

function readMachineInput(name) {
  const raw = estimateForm.elements[name].value;
  if (raw === '') return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new RangeError('0以上の整数で入力してください。');
  return value;
}

function commitEstimateState() {
  saveEstimateState();
  syncEstimateForm();
  refreshEstimate();
}

function readBoundedPositiveInteger(formData, key, minimum, maximum) {
  const value = Number(formData.get(key));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${minimum.toLocaleString('ja-JP')}〜${maximum.toLocaleString('ja-JP')}の整数で入力してください。`);
  }
  return value;
}

function setSimulationRunning(running) {
  simulationStart.disabled = running;
  simulationStart.textContent = running ? '計算中…' : '6設定をシミュレーション';
  simulationProgress.hidden = !running;
  simulationForm.querySelectorAll('input').forEach((input) => { input.disabled = running; });
}

function saveSimulationPreferences(input) {
  try {
    localStorage.setItem('hana-scope:simulation-input', JSON.stringify(input));
  } catch {
    // Storage is optional; the simulator remains fully usable without it.
  }
}

function restoreSimulationPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem('hana-scope:simulation-input'));
    if (!stored) return;
    for (const key of ['games', 'trials', 'seed', 'coinValueYen']) {
      if (Number.isFinite(Number(stored[key]))) simulationForm.elements[key].value = stored[key];
    }
  } catch {
    // Ignore unavailable or malformed local preferences.
  }
}

function compactTrialCount(trials) {
  if (trials >= 10_000 && trials % 10_000 === 0) return `${trials / 10_000}万`;
  return trials.toLocaleString('ja-JP');
}

function updateSimulationTitle(games, trials) {
  simulationTitle.textContent = `${games.toLocaleString('ja-JP')}Gのブレを${compactTrialCount(trials)}回ぶん見る`;
}

function renderSimulation(result) {
  latestSimulationResult = result;
  renderInto(simulationResult, renderSimulationResult(
    buildSimulationViewModel(result, { coinValueYen: latestCoinValueYen }),
  ));
}

function ensureSimulationWorker() {
  if (simulationWorker) return simulationWorker;
  simulationWorker = new Worker(new URL('./worker/simulation-worker.mjs', import.meta.url), { type: 'module' });
  simulationWorker.addEventListener('message', (event) => {
    const message = event.data;
    if (message.requestId !== activeRequestId) return;

    if (message.type === 'progress') {
      simulationProgress.querySelector('progress').value = message.completedSettings;
      simulationStatus.textContent = `設定${message.setting} 完了`;
      simulationPercent.textContent = `${Math.round((message.completedSettings / message.totalSettings) * 100)}%`;
      return;
    }
    if (message.type === 'result') {
      renderSimulation(message.result);
      setSimulationRunning(false);
      simulationStatus.textContent = '完了';
      return;
    }
    if (message.type === 'cancelled') {
      if (message.partialResult.summaries.length > 0) renderSimulation(message.partialResult);
      setSimulationRunning(false);
      simulationError.textContent = '途中で中止しました。完了済みの設定だけ表示しています。';
      return;
    }
    if (message.type === 'error') {
      setSimulationRunning(false);
      simulationError.textContent = message.message;
    }
  });
  simulationWorker.addEventListener('error', () => {
    setSimulationRunning(false);
    simulationError.textContent = '計算処理を開始できませんでした。ページを再読み込みしてください。';
  });
  return simulationWorker;
}

function showRepresentativeRun(setting, percentile = 0.5) {
  const summary = latestSimulationResult?.summaries.find((row) => row.setting === Number(setting));
  if (!summary) return;
  const run = summary.representativeRuns.find((candidate) => candidate.percentile === Number(percentile));
  if (!run) return;
  selectedRun = run;
  renderInto(runDetail, renderRepresentativeRun(
    buildRepresentativeRunViewModel(run, { coinValueYen: latestCoinValueYen }),
  ));
  simulationOverview.hidden = true;
  runDetail.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function downloadSelectedRun() {
  if (!selectedRun) return;
  const csv = representativeRunToCsv(selectedRun);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `star-hanahana-setting${selectedRun.setting}-${selectedRun.games}G.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

estimateForm.addEventListener('input', (event) => {
  const name = event.target.name;
  if (!MACHINE_INPUT_KEYS.includes(name)) return;
  try {
    estimateState[name] = readMachineInput(name);
    saveEstimateState();
    refreshEstimate();
  } catch (error) {
    estimateError.textContent = error.message;
  }
});

estimateForm.addEventListener('change', (event) => {
  if (event.target.name !== 'useAnalysisEvidence') return;
  estimateState.useAnalysisEvidence = event.target.checked;
  saveEstimateState();
  refreshEstimate();
});

estimateForm.addEventListener('click', (event) => {
  const step = event.target.closest('[data-step]');
  if (step) {
    const key = step.closest('[data-counter]').dataset.counter;
    estimateState[key] = Math.max(0, estimateState[key] + Number(step.dataset.step));
    commitEstimateState();
    return;
  }

  const chip = event.target.closest('.colour-chip');
  if (chip) {
    const group = chip.closest('[data-evidence]').dataset.evidence;
    const colour = chip.dataset.colour;
    estimateState[group][colour] = (estimateState[group][colour] ?? 0) + 1;
    estimateState.undo[group].push(colour);
    commitEstimateState();
    return;
  }

  const undo = event.target.closest('[data-action="undo"]');
  if (undo) {
    const group = undo.dataset.evidence;
    const colour = estimateState.undo[group].pop();
    if (colour && estimateState[group][colour] > 0) estimateState[group][colour] -= 1;
    commitEstimateState();
    return;
  }

  if (event.target.closest('[data-action="reset-observed"]')) {
    if (!window.confirm('台データと、座ってから見た分のカウントを全部消します。よろしいですか？')) return;
    estimateState = { ...defaultEstimateState(), useAnalysisEvidence: estimateState.useAnalysisEvidence };
    commitEstimateState();
  }
});

estimateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    for (const key of MACHINE_INPUT_KEYS) estimateState[key] = readMachineInput(key);
    saveEstimateState();
    refreshEstimate({ scroll: true });
  } catch (error) {
    estimateError.textContent = error.message;
  }
});

simulationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(simulationForm);
    const games = readBoundedPositiveInteger(formData, 'games', 100, 30_000);
    const trials = readBoundedPositiveInteger(formData, 'trials', 100, 100_000);
    const seed = Number(formData.get('seed'));
    const coinValueYen = Number(formData.get('coinValueYen'));
    if (!Number.isSafeInteger(seed)) throw new RangeError('乱数シードは整数で入力してください。');
    if (!Number.isFinite(coinValueYen) || coinValueYen < 0 || coinValueYen > 100) {
      throw new RangeError('換算単価は0〜100円で入力してください。');
    }

    latestCoinValueYen = coinValueYen;
    updateSimulationTitle(games, trials);
    saveSimulationPreferences({ games, trials, seed, coinValueYen });
    simulationError.textContent = '';
    simulationResult.replaceChildren();
    simulationProgress.querySelector('progress').value = 0;
    simulationStatus.textContent = '設定1を計算中';
    simulationPercent.textContent = '0%';
    setSimulationRunning(true);
    activeRequestId = `${Date.now()}-${seed}`;
    ensureSimulationWorker().postMessage({
      type: 'run',
      requestId: activeRequestId,
      input: {
        games,
        trials,
        settings: STAR_HANAHANA.settings.map((row) => row.setting),
        seed,
        riskSampleTrials: Math.min(100, trials),
      },
    });
  } catch (error) {
    simulationError.textContent = error.message;
  }
});

simulationCancel.addEventListener('click', () => {
  if (!activeRequestId || !simulationWorker) return;
  simulationStatus.textContent = '中止を予約しました';
  simulationWorker.postMessage({ type: 'cancel', requestId: activeRequestId });
});

document.addEventListener('click', (event) => {
  const disclosure = event.target.closest('[data-action="toggle-prior"]');
  if (disclosure) {
    priorPanel.hidden = !priorPanel.hidden;
    if (!priorPanel.hidden) priorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (event.target.closest('[data-action="apply-prior"]')) {
    activePrior = [...priorGrid.querySelectorAll('input')].map((input) => Number(input.value));
    refreshEstimate();
  }

  const showRun = event.target.closest('[data-action="show-run"]');
  if (showRun) showRepresentativeRun(showRun.dataset.setting);

  const percentile = event.target.closest('[data-action="select-percentile"]');
  if (percentile && selectedRun) showRepresentativeRun(selectedRun.setting, percentile.dataset.percentile);

  if (event.target.closest('[data-action="back-to-summary"]')) {
    runDetail.hidden = true;
    simulationOverview.hidden = false;
    simulationResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (event.target.closest('[data-action="download-csv"]')) downloadSelectedRun();
});

screenButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const screen = button.dataset.screen;
    screenButtons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle('is-active', active);
      if (active) candidate.setAttribute('aria-current', 'page');
      else candidate.removeAttribute('aria-current');
    });
    screenPanels.forEach((panel) => {
      const active = panel.dataset.screenPanel === screen;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  });
});

restoreSimulationPreferences();
updateSimulationTitle(
  Number(simulationForm.elements.games.value),
  Number(simulationForm.elements.trials.value),
);
syncEstimateForm();
refreshEstimate();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
