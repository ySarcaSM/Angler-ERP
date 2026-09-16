// ═══════════════════════════════════════════
// Firebase Services — Central Export
// ═══════════════════════════════════════════

export * as authService from './auth';
export * as clientsService from './clients';
export * as productsService from './products';
export * as salesService from './sales';
export * as purchasesService from './purchases';
export * as suppliersService from './suppliers';
export * as financialService from './financial';
export * as stockService from './stock';
export * as settingsService from './settings';
export { db, auth, storage } from '../../config/firebase';
