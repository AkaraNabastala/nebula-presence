import { openDB } from 'idb';

const DB_NAME = 'si-mas-offline-db';
const STORE_NAME = 'offline-scans';

export const initDB = async () => {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
};

export const saveOfflineScan = async (rfid_code) => {
    const db = await initDB();
    await db.add(STORE_NAME, { 
        rfid_code, 
        timestamp: new Date().toISOString() 
    });
};

export const getOfflineScans = async () => {
    const db = await initDB();
    return db.getAll(STORE_NAME);
};

export const removeOfflineScan = async (id) => {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
};

export const clearOfflineScans = async () => {
    const db = await initDB();
    await db.clear(STORE_NAME);
};
