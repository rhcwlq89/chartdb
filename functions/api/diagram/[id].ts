// Cloudflare Pages Function: /api/diagram/:id
//   GET    -> returns the stored diagram JSON
//   PUT    -> stores the diagram JSON and updates the manifest
//   DELETE -> removes the diagram and its manifest entry
// Compiled and served by Cloudflare Pages (not part of the Vite build).

interface Env {
    DIAGRAMS_KV: {
        get(key: string): Promise<string | null>;
        put(key: string, value: string): Promise<void>;
        delete(key: string): Promise<void>;
    };
}

interface ManifestEntry {
    id: string;
    name: string;
    updatedAt: number;
}

type Manifest = Record<string, ManifestEntry>;

interface Ctx {
    env: Env;
    params: Record<string, string | string[]>;
    request: Request;
}

const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
    });

const readManifest = async (env: Env): Promise<Manifest> => {
    const raw = await env.DIAGRAMS_KV.get('manifest');
    return raw ? (JSON.parse(raw) as Manifest) : {};
};

export const onRequestGet = async ({
    env,
    params,
}: Ctx): Promise<Response> => {
    const id = String(params.id);
    const data = await env.DIAGRAMS_KV.get(`diagram:${id}`);
    if (data === null) return json({ error: 'not found' }, 404);
    return new Response(data, {
        headers: { 'content-type': 'application/json' },
    });
};

export const onRequestPut = async ({
    env,
    params,
    request,
}: Ctx): Promise<Response> => {
    const id = String(params.id);
    const body = (await request.json()) as {
        name?: string;
        updatedAt?: number;
        diagram?: unknown;
    };

    if (!body || typeof body.diagram === 'undefined') {
        return json({ error: 'invalid body' }, 400);
    }

    await env.DIAGRAMS_KV.put(`diagram:${id}`, JSON.stringify(body.diagram));

    const manifest = await readManifest(env);
    manifest[id] = {
        id,
        name: body.name ?? '',
        updatedAt: body.updatedAt ?? Date.now(),
    };
    await env.DIAGRAMS_KV.put('manifest', JSON.stringify(manifest));

    return json({ ok: true });
};

export const onRequestDelete = async ({
    env,
    params,
}: Ctx): Promise<Response> => {
    const id = String(params.id);
    await env.DIAGRAMS_KV.delete(`diagram:${id}`);

    const manifest = await readManifest(env);
    delete manifest[id];
    await env.DIAGRAMS_KV.put('manifest', JSON.stringify(manifest));

    return json({ ok: true });
};
