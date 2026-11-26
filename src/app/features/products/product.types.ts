import { ProductDto } from '../../shared/models/api.models';

export interface Paged<T> { items: T[]; total: number; page: number; limit: number }
export type StockStatus = 'out' | 'below_min' | 'above_max' | 'negative' | 'ok';
export interface StockRow {
  warehouseId: string; code: string; name: string; isDefault: boolean; isActive: boolean; location: string | null; qty: number; minQty: number | null; maxQty: number | null; effectiveMinQty: number | null;
  cmpMinor: number | null; valueMinor: number | null; status: StockStatus; statusLabel: string;
}
export interface StockTab {
  kind: 'product' | 'service'; hasSerial: boolean; serialCount: number; globalMinStock: number; canSeeValues: boolean; warehouses: StockRow[];
  total: { qty: number; valueMinor: number | null; cmpMinor: number | null; status: StockStatus }; alerts: { warehouseId: string; warehouse: string; status: StockStatus; label: string; qty: number }[];
}
export interface TxRow {
  key: string; group: 'purchases' | 'sales' | 'stock' | 'imports'; kind: string; kindLabel: string; number: string | null; date: string; customer: string | null; supplier: string | null; quantity: number | null;
  unitPriceMinor: number | null; currency: string | null; totalMinor: number | null; status: string; statusLabel: string; phase: string; warehouse: string | null; extra: string | null;
  webPath: string; pdfPath: string | null; direction: 'in' | 'out' | null;
}
export interface TxPage extends Paged<TxRow> { allowedKinds: string[]; groups: string[] }
export interface DocumentDto { id: string; type: string; typeLabel: string; description: string | null; name: string; mime: string | null; size: number; uploadedBy: string | null; uploadedAt: string; isImage: boolean; isMain: boolean }
export interface LinkedDocument { kind: string; typeLabel: string; name: string; subtitle: string | null; webPath: string }
export interface DocumentsView { items: DocumentDto[]; linked: LinkedDocument[]; mainPhotoId: string | null }
export interface ActivityDto {
  id: string; auto: boolean; derived: boolean; editable: boolean; kind: string; kindLabel: string; title: string; description: string | null; occurredAt: string; dueDate: string | null; done: boolean | null;
  overdue: boolean; user: string | null; link: string | null; meta?: Record<string, number | string | null>;
}
export interface PricingPreview {
  vatRatePct: number | null; vatRegime: string | null; saleTtcMinor: number | null; belowCost: boolean | null;
  margins: { marginHtMinor: number; marginRatePct: number | null; markPct: number | null; marginTtcMinor: number; marginTtcRatePct: number | null; costTtcMinor: number } | null;
  estimateRate: number | null; estimatedPurchaseMinor: number | null; estimatedCostMinor: number | null;
}
export type { ProductDto };
