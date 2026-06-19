// Cloudflare Pages Function: GET /api/diagrams
// Returns the sync manifest: { [id]: { id, name, updatedAt } }.
// Compiled and served by Cloudflare Pages (not part of the Vite build).

interface Env {
    DIAGRAMS_KV: {
        get(key: string): Promise<string | null>;
    };
}

export const onRequestGet = async ({
    env,
}: {
    env: Env;
}): Promise<Response> => {
    const manifest = await env.DIAGRAMS_KV.get('manifest');
    return new Response(manifest ?? '{}', {
        headers: { 'content-type': 'application/json' },
    });
};
