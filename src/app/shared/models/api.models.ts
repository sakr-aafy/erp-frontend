export interface Page<T> { items: T[]; total: number; page: number; limit: number }
export interface ApiErrorBody { error: { code: string; message: string; details?: { path: string; message: string }[] } }

export interface UserProfile {
  id: string; name: string; username: string; email: string; mustChangePassword: boolean; isPlatformAdmin: boolean;
  company: { id: string; name: string }; role: { id: string; name: string; isSystem: boolean }; permissions: string[];
}
export interface AuthResponse { accessToken: string; user: UserProfile }

export interface UserDto {
  id: string; name: string; username: string; email: string; isActive: boolean; roleId: string; roleName?: string;
  mustChangePassword: boolean; lastLoginAt?: string; createdAt: string;
}
export interface RoleDto { _id: string; name: string; description?: string; permissions: string[]; isSystem: boolean; userCount?: number }
export interface Company { _id: string; name: string; taxId?: string; address?: string; phone?: string; email?: string; isActive: boolean }
export interface AuditLogDto {
  _id: string; action: string; resource: string; resourceId?: string; userName?: string; success: boolean; ip?: string; meta?: unknown; at: string;
}
export interface Currency { code: string; name?: string; symbol?: string; decimals: number }
export interface VatRate { ruleId?: string; code: string; label?: string | null; regime: 'taxable' | 'zero' | 'exempt' | 'suspended'; ratePct: number }
export interface NumberingFormat { docType: string; prefix: string; padding: number; includeYear: boolean; resetYearly: boolean }
export interface Settings {
  baseCurrency: string; currencies: Currency[];
  numbering: NumberingFormat[]; supplierBlockThresholdMinor?: number;
}

export interface Contact { _id?: string; name: string; role?: string | null; email?: string | null; phone?: string | null; isPrimary: boolean }
export interface Address { street?: string; city?: string; postalCode?: string; country?: string }
export interface Customer2 {
  id: string; name: string; taxId: string | null; address: Address; phone: string | null; email: string | null; contacts: Contact[];
  paymentTerms: string | null; paymentDelayDays: number; creditLimitMinor: number | null; balanceMinor: number; availableCreditMinor: number | null;
  creditExceeded: boolean; subjectToWithholding: boolean; stampExempt: boolean; notes: string | null; isArchived: boolean; createdAt?: string;
}
export interface SupplierDto {
  id: string; name: string; taxId: string | null; address: Address; phone: string | null; email: string | null; contacts: Contact[];
  leadTimeDays: number | null; paymentTerms: string | null; paymentDelayDays: number; balanceMinor: number; blockThresholdMinor: number | null;
  effectiveThresholdMinor: number | null; ordersBlocked: boolean; isForeign: boolean; currency: string | null; notes: string | null; isArchived: boolean;
}
export interface ListResponse<T> extends Page<T> { summary?: { totalBalanceMinor: number } }
export interface ProductDto {
  id: string; reference: string; name: string; description: string | null; kind: 'product' | 'service'; categoryId: string | null; categoryName: string | null;
  unitId: string; unitCode: string | null; purchasePriceMinor: number; salePriceMinor: number; costPriceMinor: number | null; effectiveCostMinor: number;
  marginMinor: number; marginRatePct: number | null; markPct: number | null; belowCost: boolean; vatRateCode: string; minStock: number;
  mainSupplierId: string | null; mainSupplierName: string | null; hasSerial: boolean; isActive: boolean; serialCount?: number; warnings?: string[];
}
export interface CategoryDto { id: string; name: string; parentId: string | null; productCount: number }
export interface UnitDto { id: string; code: string; name: string }
export interface SerialDto { id: string; serialNumber: string; status: string; note: string | null }
export interface ReferenceData {
  baseCurrency: string; baseDecimals: number; baseSymbol: string | null; currencies: Currency[]; vatRates: VatRate[];
}
export interface ImportReport {
  mode: 'create' | 'upsert'; dryRun: boolean; total: number; toCreate: number; toUpdate: number; created: number; updated: number; applied: boolean;
  errors: { row: number; field?: string; message: string }[];
}
