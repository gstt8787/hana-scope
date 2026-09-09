import { runSimulation } from '../domain/simulate.mjs';

export async function executeSimulationRequest({
  requestId,
  input,
  postMessage,
  isCancelled,
  yieldToMessages = () => new Promise((resolve) => setTimeout(resolve, 0)),
}) {
  const summaries = [];
  const settings = input.settings ?? input.machine.settings.map((row) => row.setting);

  for (const setting of settings) {
    if (isCancelled(requestId)) {
      postMessage({
        type: 'cancelled',
        requestId,
        partialResult: {
          machineId: input.machine.id,
          games: input.games,
          trials: input.trials,
          seed: input.seed,
          cancelled: true,
          summaries,
        },
      });
      return;
    }

    const result = runSimulation({ ...input, settings: [setting] });
    summaries.push(result.summaries[0]);
    postMessage({
      type: 'progress',
      requestId,
      completedSettings: summaries.length,
      totalSettings: settings.length,
      setting,
    });
    await yieldToMessages();
  }

  postMessage({
    type: 'result',
    requestId,
    result: {
      machineId: input.machine.id,
      games: input.games,
      trials: input.trials,
      seed: input.seed,
      cancelled: false,
      summaries,
    },
  });
}
