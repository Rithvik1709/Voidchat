import type { Instrumentation } from 'next';

/**
 * Runs for every uncaught server-side error (API routes, server components). Logs a compact
 * record and forwards it to the optional alert webhook.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
    const err = error as { message?: string; digest?: string };
    const record = {
        type: 'server-error',
        at: new Date().toISOString(),
        message: String(err?.message ?? 'Unknown error').slice(0, 300),
        digest: err?.digest,
        route: context?.routePath,
        method: request?.method,
    };
    console.error(JSON.stringify(record));

    const { sendAlert } = await import('@/lib/server/alerts');
    await sendAlert(`Nullchat server error on ${record.method ?? ''} ${record.route ?? ''}: ${record.message}`, `${record.route}|${record.message}`);
};
