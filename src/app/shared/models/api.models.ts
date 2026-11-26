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

/** Numéro prêt à afficher (calculé par le serveur) ; `valid: false` : non reconnu, à vérifier. */
export interface PhoneInfo { display: string; href: string; valid: boolean }
export interface Contact { _id?: string; name: string; role?: string | null; email?: string | null; phone?: string | null; phoneInfo?: PhoneInfo | null; isPrimary: boolean }
export interface Address { street?: string; city?: string; postalCode?: string; country?: string }
/** Copie d'adresse de livraison portée par un document. */
export interface AddressSnapshot {
  addressId: string | null; label: string; street: string; city: string | null; postalCode: string | null; country: string | null;
  contactName: string | null; contactPhone: string | null; contactPhoneInfo: PhoneInfo | null; mapsUrl: string | null; instructions: string | null;
}
/** Adresse de livraison enregistrée chez un client ou un fournisseur. */
export interface DeliveryAddress extends Omit<AddressSnapshot, 'addressId'> { id: string; isDefault: boolean; archived: boolean }
export type CustomerStatus = 'active' | 'inactive' | 'archived' | 'blocked';
export type CustomerType = 'company' | 'walk_in';
export interface Customer2 {
  id: string; code: string | null; type: CustomerType; name: string; tradeName: string | null; taxId: string | null;
  address: Address; deliveryAddresses: DeliveryAddress[]; phone: string | null; phoneInfo: PhoneInfo | null; secondaryPhone: string | null; secondaryPhoneInfo: PhoneInfo | null; email: string | null; website: string | null;
  social: { facebook: string | null; linkedin: string | null; instagram: string | null }; mapsUrl: string | null; contacts: Contact[];
  primaryContact: { name: string; role: string | null; phone: string | null; phoneInfo: PhoneInfo | null; email: string | null } | null;
  paymentTerms: string | null; paymentTermsCustom: boolean; paymentDelayDays: number; paymentMethod: string | null; discountPct: number; creditLimitMinor: number | null; balanceMinor: number; availableCreditMinor: number | null;
  creditExceeded: boolean; subjectToWithholding: boolean; stampExempt: boolean; notes: string | null;
  status: CustomerStatus; statusLabel: string; statusReason: string | null; statusChangedAt: string | null; isArchived: boolean; canSell: boolean; createdAt?: string;
}
export interface SupplierDto {
  id: string; code: string | null; name: string; tradeName: string | null; taxId: string | null; address: Address; deliveryAddresses: DeliveryAddress[]; phone: string | null; email: string | null; contacts: Contact[];
  leadTimeDays: number | null; paymentTerms: string | null; paymentDelayDays: number; balanceMinor: number; blockThresholdMinor: number | null;
  effectiveThresholdMinor: number | null; ordersBlocked: boolean; isForeign: boolean; currency: string | null; notes: string | null; isArchived: boolean;
}
export interface ListResponse<T> extends Page<T> { summary?: { totalBalanceMinor: number } }
export type ProductStatus = 'active' | 'inactive' | 'archived' | 'blocked';
export interface ProductPackaging {
  lengthMm: number | null; widthMm: number | null; heightMm: number | null; netWeightKg: number | null; grossWeightKg: number | null; type: string | null; typeLabel: string | null;
  /** Volume total (m³), calculé par le serveur ; null si les dimensions sont incomplètes. */
  volumeM3: number | null;
  /** Ancienne saisie « par colis » : dimensions à vérifier. */
  review: { parcelCount: number; previousTotalM3: number | null } | null;
}
export interface ProductCustoms {
  supplierHsCode: string | null; tnHsCode: string | null; ddPct: number | null; fodecPct: number | null; rpdPct: number | null; originCountry: string | null; provenanceCountry: string | null; specialRegulation: string | null;
}
/** Les montants d'achat, de coût, de marge, le stock et la douane sont null sans la permission correspondante (voir `access`). */
export interface ProductDto {
  id: string; reference: string; name: string; description: string | null; kind: 'product' | 'service';
  status: ProductStatus; statusLabel: string; statusReason: string | null; statusChangedAt: string | null; isActive: boolean; canUse: boolean;
  categoryId: string | null; categoryName: string | null; familyId: string | null; familyName: string | null; subId: string | null; subName: string | null;
  unitId: string; unitCode: string | null; unitName: string | null; vatRateCode: string; vatRatePct: number | null; vatRegime: string | null;
  salePriceMinor: number; saleTtcMinor: number | null; minSalePriceMinor: number | null; maxDiscountPct: number | null; mainSupplierId: string | null; mainSupplierName: string | null; mainSupplierCode: string | null; mainSupplierArchived: boolean;
  minStock: number; hasSerial: boolean; mainPhotoId: string | null; hasPhoto: boolean; packaging: ProductPackaging | null; stockQty: number | null; createdAt?: string;
  access: { purchase: boolean; cost: boolean; customs: boolean; stock: boolean };
  /** null : devise à taux estimatif (aucune contre-valeur réelle enregistrée). */
  purchasePriceMinor: number | null; purchaseCurrency: string | null; purchasePriceForeignMinor: number | null; purchaseRate: number | null; purchaseRateDate: string | null; estimatedCostMinor: number | null;
  estimateRate: number | null; estimatedPurchaseMinor: number | null; estimatedCostValueMinor: number | null;
  costPriceMinor: number | null; effectiveCostMinor: number | null; belowCost: boolean | null; marginMinor: number | null; marginRatePct: number | null; markPct: number | null;
  marginTtcMinor: number | null; marginTtcRatePct: number | null; costTtcMinor: number | null; customs: ProductCustoms | null;
  serialCount?: number; warnings?: string[];
}
export interface CategoryDto { id: string; name: string; parentId: string | null; isArchived: boolean; productCount: number; totalProductCount: number }
export interface ProductSuggestion { id: string; reference: string; name: string; kind: 'product' | 'service'; mainPhotoId: string | null; familyName: string | null; subName: string | null }
export interface SupplierOption { id: string; code: string | null; name: string; tradeName: string | null; taxId: string | null; isArchived: boolean }
export interface UnitDto { id: string; code: string; name: string }
export interface SerialDto { id: string; serialNumber: string; status: string; note: string | null; warehouseId?: string | null; warehouse?: string | null; soldOn?: { type: string | null; id: string | null; number: string | null } | null }
export interface ReferenceData {
  baseCurrency: string; baseDecimals: number; baseSymbol: string | null; currencies: Currency[]; vatRates: VatRate[];
  estimateRates?: { currency: string; targetCurrency: string; rate: number }[];
}
export interface ImportReport {
  mode: 'create' | 'upsert'; dryRun: boolean; total: number; toCreate: number; toUpdate: number; created: number; updated: number; applied: boolean;
  errors: { row: number; field?: string; message: string }[]; warnings?: string[];
}
