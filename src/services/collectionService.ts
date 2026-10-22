/**
 * Cardback User Collection Service
 * Manages user-owned collection data with hybrid synchronization:
 * - Live Neon PostgreSQL server backend when available (/api/collection)
 * - Transparent offline-resilient local cache in localStorage
 */

import { INITIAL_USER_COLLECTION } from '../data/catalogueSeed';
import { OwnedFigure, CollectionStats, FigureCondition } from '../types/domain';

const STORAGE_KEY = 'cardback_user_collection_v1';
const DELETED_IDS_STORAGE_KEY = 'cardback_deleted_figure_ids';

function readUserId(): string | null {
  try {
    const saved = localStorage.getItem('cb_user');
    return saved ? JSON.parse(saved)?.id || null : null;
  } catch {
    return null;
  }
}

let activeUserId = readUserId();
const storageKey = () => `${STORAGE_KEY}:${activeUserId || 'anonymous'}`;

function getDeletedIds(): Set<string> {
  const set = new Set<string>();
  try {
    const specificKey = `${DELETED_IDS_STORAGE_KEY}:${activeUserId || 'anonymous'}`;
    const rawSpecific = localStorage.getItem(specificKey);
    if (rawSpecific) {
      const arr = JSON.parse(rawSpecific);
      if (Array.isArray(arr)) arr.forEach((id: string) => set.add(id));
    }
    const rawGlobal = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (rawGlobal) {
      const arr = JSON.parse(rawGlobal);
      if (Array.isArray(arr)) arr.forEach((id: string) => set.add(id));
    }
  } catch (e) {
    console.error('Failed to read deleted figure IDs', e);
  }
  return set;
}

function markAsDeleted(id: string): void {
  try {
    const specificKey = `${DELETED_IDS_STORAGE_KEY}:${activeUserId || 'anonymous'}`;
    const rawSpecific = localStorage.getItem(specificKey);
    const set1 = new Set(rawSpecific ? JSON.parse(rawSpecific) : []);
    set1.add(id);
    localStorage.setItem(specificKey, JSON.stringify(Array.from(set1)));

    const rawGlobal = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    const set2 = new Set(rawGlobal ? JSON.parse(rawGlobal) : []);
    set2.add(id);
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(set2)));
  } catch (e) {
    console.error('Failed to mark figure ID as deleted', e);
  }
}

type Listener = (collection: OwnedFigure[]) => void;
const listeners: Set<Listener> = new Set();

function loadFromStorage(): OwnedFigure[] {
  const deleted = getDeletedIds();
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item: OwnedFigure) => !deleted.has(item.id));
      }
    }
  } catch (e) {
    console.error('Failed to load collection from localStorage', e);
  }

  // If uninitialized, seed initial collection excluding any previously deleted IDs
  const initial = activeUserId 
    ? [] 
    : INITIAL_USER_COLLECTION.filter(item => !deleted.has(item.id));
  
  try {
    localStorage.setItem(storageKey(), JSON.stringify(initial));
  } catch {}

  return initial;
}

/**
 * Trims oversized base64 images from items saved to localStorage to prevent quota exhaustion.
 * Full images remain untouched in memory and on the server.
 */
function sanitizeItemForStorage(item: OwnedFigure): OwnedFigure {
  let figureImageUrl = item.figureImageUrl;
  // Preserve user uploaded photos up to 400KB in localStorage; fallback only if massive
  if (typeof figureImageUrl === 'string' && figureImageUrl.startsWith('data:image') && figureImageUrl.length > 400000) {
    figureImageUrl = '/cardback_placeholder.jpeg';
  }

  const images = (item.images || []).map(img => {
    if (typeof img === 'string' && img.startsWith('data:image') && img.length > 400000) {
      return '/cardback_placeholder.jpeg';
    }
    return img;
  });

  return {
    ...item,
    figureImageUrl,
    images
  };
}

function cleanupStorageQuota(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cb_tmp_') || key.startsWith('cb_cache_') || key.includes('_old_'))) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

function saveToStorage(collection: OwnedFigure[]): void {
  const safeCollection = collection.map(sanitizeItemForStorage);
  try {
    localStorage.setItem(storageKey(), JSON.stringify(safeCollection));
  } catch (e: any) {
    console.warn('Initial localStorage.setItem exceeded quota, performing emergency cleanup:', e?.message || e);
    cleanupStorageQuota();
    try {
      // Second attempt: strip all inline base64 images completely to guarantee fit
      const minimalCollection = safeCollection.map(it => ({
        ...it,
        figureImageUrl: (it.figureImageUrl && it.figureImageUrl.startsWith('data:image')) ? '/cardback_placeholder.jpeg' : it.figureImageUrl,
        images: (it.images || []).filter(img => typeof img === 'string' && !img.startsWith('data:image'))
      }));
      localStorage.setItem(storageKey(), JSON.stringify(minimalCollection));
    } catch (finalErr) {
      console.warn('localStorage is full; keeping collection safely in active memory:', finalErr);
    }
  }
  listeners.forEach(cb => cb(collection));
}

let currentCollection: OwnedFigure[] = loadFromStorage();
let isSyncing = false;
let pendingSync = false;
let dbConnected = false;

// Initial background sync with Neon PostgreSQL
async function syncWithNeon() {
  if (isSyncing) {
    pendingSync = true;
    return;
  }
  isSyncing = true;
  const requestedUserId = activeUserId;
  const deleted = getDeletedIds();

  try {
    const res = await fetch('/api/collection', {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.quotaExceeded) {
        dbConnected = false;
        console.warn('[Neon] Quota limit reached (5GB). Operating in offline local storage mode.');
        return;
      }
      if (Array.isArray(data.items) && requestedUserId === activeUserId) {
        dbConnected = true;

        // If server returned an item that was locally marked as deleted, ensure server deletes it too
        for (const item of data.items) {
          if (deleted.has(item.id)) {
            fetch(`/api/collection/${encodeURIComponent(item.id)}`, {
              method: 'DELETE',
              credentials: 'same-origin',
              headers: { Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}` }
            }).catch(() => {});
          }
        }

        // Filter out any items locally recorded as deleted
        const activeServerItems = data.items.filter((i: any) => !deleted.has(i.id));
        const serverIds = new Set(activeServerItems.map((i: any) => i.id));

        const unsavedLocal = currentCollection.filter(i => 
          !serverIds.has(i.id) && 
          !deleted.has(i.id) && 
          (i.userId === activeUserId || !i.userId || i.userId === 'anonymous')
        );

        // Upload any local items to server
        for (const item of unsavedLocal) {
          fetch('/api/collection', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}` },
            body: JSON.stringify(item)
          }).catch(err => console.warn('Could not sync local item to Neon:', err));
        }

        currentCollection = [...activeServerItems, ...unsavedLocal];
        saveToStorage(currentCollection);
      }
    }
  } catch (e) {
    console.warn('Neon DB not reachable yet, operating in local mode:', e);
  } finally {
    isSyncing = false;
    if (pendingSync) {
      pendingSync = false;
      void syncWithNeon();
    }
  }
}

// Trigger initial sync
if (typeof window !== 'undefined' && activeUserId && localStorage.getItem('cb_token')) {
  syncWithNeon();
}

export const CollectionService = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(currentCollection);
    return () => {
      listeners.delete(listener);
    };
  },

  isNeonConnected(): boolean {
    return dbConnected;
  },

  async refetchFromNeon(): Promise<boolean> {
    await syncWithNeon();
    return dbConnected;
  },

  setUserId(userId?: string): void {
    if (activeUserId === (userId || null)) return;
    activeUserId = userId || null;
    dbConnected = false;
    currentCollection = loadFromStorage();
    listeners.forEach(cb => cb(currentCollection));
    if (activeUserId) void syncWithNeon();
  },

  getAll(): OwnedFigure[] {
    return [...currentCollection];
  },

  getOwnedFigures(): OwnedFigure[] {
    return currentCollection.filter(item => !item.isWishlist);
  },

  getWishlist(): OwnedFigure[] {
    return currentCollection.filter(item => Boolean(item.isWishlist));
  },

  getCollectionStats() {
    const stats = this.getStats();
    const unrealizedGain = Math.max(0, stats.totalEstimatedValue - stats.totalInvested);
    const gainPercentage = stats.totalInvested > 0
      ? Math.round((unrealizedGain / stats.totalInvested) * 100)
      : 0;

    return {
      ...stats,
      totalFigures: stats.totalOwned,
      uniqueFiguresCount: stats.totalUniqueFigures,
      unrealizedGain,
      gainPercentage
    };
  },

  getCollection(options?: {
    condition?: FigureCondition | 'ALL';
    franchiseId?: string;
    lineId?: string;
    isWishlist?: boolean;
    search?: string;
    sortBy?: 'date' | 'name' | 'value' | 'price' | 'condition';
    sortOrder?: 'asc' | 'desc';
  }): OwnedFigure[] {
    let list = currentCollection.filter(item => {
      if (options?.isWishlist !== undefined && Boolean(item.isWishlist) !== Boolean(options.isWishlist)) {
        return false;
      }
      if (options?.condition && options.condition !== 'ALL' && item.condition !== options.condition) {
        return false;
      }
      if (options?.franchiseId && item.franchiseId !== options.franchiseId) {
        return false;
      }
      if (options?.lineId && item.lineId !== options.lineId) {
        return false;
      }
      if (options?.search) {
        const q = options.search.toLowerCase();
        const matchName = item.figureName.toLowerCase().includes(q);
        const matchCode = item.figureCode?.toLowerCase().includes(q);
        const matchNotes = item.collectorNotes?.toLowerCase().includes(q);
        const matchVariant = item.variantName?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchNotes && !matchVariant) {
          return false;
        }
      }
      return true;
    });

    // Sorting
    const order = options?.sortOrder === 'desc' ? -1 : 1;
    const sortBy = options?.sortBy || 'date';

    list.sort((a, b) => {
      if (sortBy === 'date') {
        return (new Date(b.acquisitionDate).getTime() - new Date(a.acquisitionDate).getTime()) * order;
      }
      if (sortBy === 'name') {
        return a.figureName.localeCompare(b.figureName) * order;
      }
      if (sortBy === 'value') {
        return (a.estimatedValue - b.estimatedValue) * order;
      }
      if (sortBy === 'price') {
        return (a.purchasePrice - b.purchasePrice) * order;
      }
      if (sortBy === 'condition') {
        return a.condition.localeCompare(b.condition) * order;
      }
      return 0;
    });

    return list;
  },

  getStats(): CollectionStats {
    const ownedOnly = currentCollection.filter(i => !i.isWishlist);
    const totalOwned = ownedOnly.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const uniqueFigures = new Set(ownedOnly.map(i => i.figureId)).size;
    const totalEstimatedValue = ownedOnly.reduce((sum, item) => sum + (item.estimatedValue * (item.quantity || 1)), 0);
    const totalInvested = ownedOnly.reduce((sum, item) => sum + (item.purchasePrice * (item.quantity || 1)), 0);

    const mocCount = ownedOnly.filter(i => i.condition === 'MOC').reduce((sum, item) => sum + (item.quantity || 1), 0);
    const looseCount = ownedOnly.filter(i => i.condition === 'LOOSE_COMPLETE' || i.condition === 'LOOSE_INCOMPLETE').reduce((sum, item) => sum + (item.quantity || 1), 0);
    const gradedCount = ownedOnly.filter(i => i.condition === 'GRADED').reduce((sum, item) => sum + (item.quantity || 1), 0);

    // Franchise breakdown
    const franchiseMap: Record<string, { count: number; value: number }> = {};
    ownedOnly.forEach(item => {
      if (!franchiseMap[item.franchiseName]) {
        franchiseMap[item.franchiseName] = { count: 0, value: 0 };
      }
      franchiseMap[item.franchiseName].count += (item.quantity || 1);
      franchiseMap[item.franchiseName].value += (item.estimatedValue * (item.quantity || 1));
    });

    const franchiseBreakdown = Object.entries(franchiseMap).map(([franchiseName, data]) => ({
      franchiseName,
      count: data.count,
      value: data.value
    }));

    // Line breakdown with total estimates
    const lineMap: Record<string, number> = {};
    ownedOnly.forEach(item => {
      lineMap[item.lineName] = (lineMap[item.lineName] || 0) + (item.quantity || 1);
    });

    const lineBreakdown = Object.entries(lineMap).map(([lineName, count]) => ({
      lineName,
      count,
      totalInLine: 12, // Representative line target
      percentage: Math.min(100, Math.round((count / 12) * 100))
    }));

    return {
      totalOwned,
      totalUniqueFigures: uniqueFigures,
      totalEstimatedValue,
      totalInvested,
      mocCount,
      looseCount,
      gradedCount,
      franchiseBreakdown,
      lineBreakdown
    };
  },

  addFigure(data: Omit<OwnedFigure, 'id' | 'addedAt'>): OwnedFigure {
    const images: string[] = Array.isArray(data.images) && data.images.length > 0
      ? data.images.map(String).filter(Boolean)
      : (data.figureImageUrl ? [data.figureImageUrl] : ['/cardback_placeholder.jpeg']);
    const primaryImage = images[0] || data.figureImageUrl || '/cardback_placeholder.jpeg';

    const resolvedUserId = activeUserId || readUserId() || data.userId || 'anonymous';
    const newFigure: OwnedFigure = {
      ...data,
      figureImageUrl: primaryImage,
      images,
      userId: resolvedUserId,
      id: `own-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      addedAt: new Date().toISOString()
    };
    currentCollection = [newFigure, ...currentCollection];
    saveToStorage(currentCollection);

    // Push to Neon backend with credentials and token
    fetch('/api/collection', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}`
      },
      body: JSON.stringify(newFigure)
    }).then(async res => {
      if (res.ok) {
        dbConnected = true;
        const resData = await res.json().catch(() => null);
        if (resData?.item?.id && resData.item.id !== newFigure.id) {
          const idx = currentCollection.findIndex(it => it.id === newFigure.id);
          if (idx !== -1) {
            currentCollection[idx] = { ...currentCollection[idx], id: resData.item.id };
            saveToStorage(currentCollection);
          }
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn('Could not persist figure to server (status ' + res.status + '):', errText);
      }
    }).catch(err => console.warn('Could not persist to Neon asynchronously:', err));

    return newFigure;
  },

  async addFigureAsync(data: Omit<OwnedFigure, 'id' | 'addedAt'>): Promise<OwnedFigure> {
    const fig = this.addFigure(data);
    try {
      const res = await fetch('/api/collection', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}`
        },
        body: JSON.stringify(fig)
      });
      if (res.ok) {
        dbConnected = true;
        const resData = await res.json().catch(() => null);
        if (resData?.item?.id && resData.item.id !== fig.id) {
          const idx = currentCollection.findIndex(it => it.id === fig.id);
          if (idx !== -1) {
            currentCollection[idx] = { ...currentCollection[idx], id: resData.item.id };
            saveToStorage(currentCollection);
            return currentCollection[idx];
          }
        }
      }
    } catch (err) {
      console.warn('Could not persist to Neon synchronously:', err);
    }
    return fig;
  },

  updateFigure(id: string, updates: Partial<OwnedFigure>): OwnedFigure | null {
    const index = currentCollection.findIndex(item => item.id === id);
    if (index === -1) return null;
    currentCollection[index] = {
      ...currentCollection[index],
      ...updates
    };
    saveToStorage(currentCollection);
    fetch(`/api/collection/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}`
      },
      body: JSON.stringify(updates)
    }).catch(err => console.warn('Could not persist collection update:', err));
    return currentCollection[index];
  },

  removeFigure(id: string): boolean {
    markAsDeleted(id);
    const initialLen = currentCollection.length;
    currentCollection = currentCollection.filter(item => item.id !== id);
    if (currentCollection.length !== initialLen) {
      saveToStorage(currentCollection);

      // Delete from Neon backend asynchronously
      fetch(`/api/collection/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}` }
      }).catch(err => console.warn('Could not delete from Neon asynchronously:', err));

      return true;
    }
    return false;
  },

  toggleWishlist(id: string): boolean {
    const item = currentCollection.find(i => i.id === id);
    if (!item) return false;
    item.isWishlist = !item.isWishlist;
    saveToStorage(currentCollection);
    return true;
  },

  checkFigureOwnership(figureId: string): { owned: boolean; inWishlist: boolean; count: number } {
    const matches = currentCollection.filter(i => i.figureId === figureId);
    const owned = matches.some(i => !i.isWishlist);
    const inWishlist = matches.some(i => Boolean(i.isWishlist));
    return {
      owned,
      inWishlist,
      count: matches.length
    };
  },

  resetToDefault(): void {
    try {
      localStorage.removeItem(`${DELETED_IDS_STORAGE_KEY}:${activeUserId || 'anonymous'}`);
      localStorage.removeItem(DELETED_IDS_STORAGE_KEY);
    } catch {}
    currentCollection = [...INITIAL_USER_COLLECTION];
    saveToStorage(currentCollection);
  }
};
