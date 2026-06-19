import type React from 'react';
import { useEffect, useRef } from 'react';
import { useStorage } from '@/hooks/use-storage';
import { useChartDB } from '@/hooks/use-chartdb';
import {
    fetchManifest,
    fetchRemoteDiagram,
    pushRemoteDiagram,
} from '@/lib/cloud-sync/cloud-sync-api';

const PUSH_DEBOUNCE_MS = 3000;

const FULL_INCLUDES = {
    includeTables: true,
    includeRelationships: true,
    includeDependencies: true,
    includeAreas: true,
    includeCustomTypes: true,
    includeNotes: true,
} as const;

// Headless component: keeps local diagrams in sync with the Cloudflare KV
// backend. On mount it reconciles both directions (last-write-wins by
// updatedAt); afterwards it debounce-pushes the active diagram on every edit.
// Renders nothing and no-ops when the sync API is unavailable.
export const CloudSync: React.FC = () => {
    const { listDiagrams, addDiagram, deleteDiagram } = useStorage();
    const { currentDiagram, loadDiagram } = useChartDB();
    const reconciledRef = useRef(false);
    const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep a live ref so the async reconcile can check the currently open
    // diagram without capturing a stale value at mount time.
    const currentDiagramRef = useRef(currentDiagram);
    currentDiagramRef.current = currentDiagram;

    useEffect(() => {
        if (reconciledRef.current) return;
        reconciledRef.current = true;

        const reconcile = async () => {
            const manifest = await fetchManifest();
            if (!manifest) return; // sync unavailable — stay local-only

            const local = await listDiagrams(FULL_INCLUDES);
            const localById = new Map(local.map((d) => [d.id, d]));

            // Pull: remote is newer than local, or missing locally.
            for (const entry of Object.values(manifest)) {
                const localDiagram = localById.get(entry.id);
                if (
                    localDiagram &&
                    entry.updatedAt <= localDiagram.updatedAt.getTime()
                ) {
                    continue;
                }

                const remote = await fetchRemoteDiagram(entry.id);
                if (!remote) continue;

                if (localDiagram) await deleteDiagram(remote.id);
                await addDiagram({ diagram: remote });

                // Refresh the canvas if the diagram on screen was updated.
                if (currentDiagramRef.current?.id === remote.id) {
                    await loadDiagram(remote.id);
                }
            }

            // Push: local is newer than remote, or missing remotely.
            for (const localDiagram of local) {
                const entry = manifest[localDiagram.id];
                if (
                    !entry ||
                    localDiagram.updatedAt.getTime() > entry.updatedAt
                ) {
                    await pushRemoteDiagram(localDiagram);
                }
            }
        };

        void reconcile();
        // Run exactly once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!currentDiagram?.id) return;

        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => {
            void pushRemoteDiagram(currentDiagram);
        }, PUSH_DEBOUNCE_MS);

        return () => {
            if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        };
    }, [currentDiagram]);

    return null;
};
