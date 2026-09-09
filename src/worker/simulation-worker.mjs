import { STAR_HANAHANA } from '../domain/machine.mjs';
import { executeSimulationRequest } from './protocol.mjs';

const cancelledRequests = new Set();

self.addEventListener('message', async (event) => {
  const message = event.data;
  if (message?.type === 'cancel') {
    cancelledRequests.add(message.requestId);
    return;
  }
  if (message?.type !== 'run') return;

  const { requestId, input } = message;
  cancelledRequests.delete(requestId);
  try {
    await executeSimulationRequest({
      requestId,
      input: { ...input, machine: STAR_HANAHANA },
      postMessage: (payload) => self.postMessage(payload),
      isCancelled: () => cancelledRequests.has(requestId),
    });
  } catch (error) {
    self.postMessage({ type: 'error', requestId, message: error.message });
  } finally {
    cancelledRequests.delete(requestId);
  }
});
