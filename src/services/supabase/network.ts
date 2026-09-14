export async function boundedFetch(input: RequestInfo | URL, init?: RequestInit) {
 const controller = new AbortController();
 const abort = () => controller.abort();
 if (init?.signal?.aborted) controller.abort();
 init?.signal?.addEventListener('abort', abort, { once: true });
 const timer = setTimeout(abort, 20000);
 try { return await fetch(input, { ...init, signal: controller.signal }); }
 finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', abort); }
}
