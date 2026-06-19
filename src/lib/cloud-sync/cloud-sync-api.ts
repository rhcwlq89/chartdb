import { diagramSchema, type Diagram } from '@/lib/domain/diagram';

// Client for the Cloudflare Pages Functions sync API (/api/*).
// All calls fail soft: when the API is unavailable (e.g. local `vite dev`,
// or a non-deployed environment) helpers return null/false so the app keeps
// working purely on local IndexedDB.

const BASE = '/api';

export interface DiagramManifestEntry {
    id: string;
    name: string;
    updatedAt: number;
}

export type DiagramManifest = Record<string, DiagramManifestEntry>;

// Serialize preserving every id so the same diagram maps to the same record
// across devices (unlike diagramToJSONOutput which regenerates ids).
export const serializeDiagram = (diagram: Diagram): string =>
    JSON.stringify(diagram);

export const deserializeDiagram = (json: string): Diagram => {
    const loaded = JSON.parse(json);
    return diagramSchema.parse({
        ...loaded,
        createdAt: new Date(loaded.createdAt),
        updatedAt: new Date(loaded.updatedAt),
    });
};

const isJsonResponse = (res: Response): boolean =>
    (res.headers.get('content-type') ?? '').includes('application/json');

export const fetchManifest = async (): Promise<DiagramManifest | null> => {
    try {
        const res = await fetch(`${BASE}/diagrams`, {
            headers: { accept: 'application/json' },
        });
        // A non-JSON 200 means the SPA fallback served index.html — i.e. the
        // function isn't deployed. Treat that as "sync unavailable".
        if (!res.ok || !isJsonResponse(res)) return null;
        return (await res.json()) as DiagramManifest;
    } catch {
        return null;
    }
};

export const fetchRemoteDiagram = async (
    id: string
): Promise<Diagram | null> => {
    try {
        const res = await fetch(`${BASE}/diagram/${id}`);
        if (!res.ok || !isJsonResponse(res)) return null;
        return deserializeDiagram(await res.text());
    } catch {
        return null;
    }
};

export const pushRemoteDiagram = async (diagram: Diagram): Promise<boolean> => {
    try {
        const res = await fetch(`${BASE}/diagram/${diagram.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: diagram.name,
                updatedAt: diagram.updatedAt.getTime(),
                diagram,
            }),
        });
        return res.ok;
    } catch {
        return false;
    }
};

export const deleteRemoteDiagram = async (id: string): Promise<boolean> => {
    try {
        const res = await fetch(`${BASE}/diagram/${id}`, { method: 'DELETE' });
        return res.ok;
    } catch {
        return false;
    }
};
