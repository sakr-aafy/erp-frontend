import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, ArrowUpDown, Ban, Banknote, BadgeCheck, Bell, BookOpen, Boxes, Building2, Calculator, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert, CircleCheck, CircleX, ClipboardCheck, Clock, Coins, Copy, Download, EllipsisVertical, Eye, FilePlus, FileText, FileUp,
  Filter, Info, KeyRound, Landmark, LayoutDashboard, List, ListChecks, ListPlus, Lock, LogOut, Mail, Menu, Package, PackageOpen, Paperclip, PanelLeftClose, PanelLeftOpen, Pencil, PlaneLanding,
  Plus, Printer, Receipt, ReceiptText, RefreshCw, Save, Search, Send, Settings, Shapes, Shield, ShieldCheck, ShoppingCart, Table, ThumbsDown, Trash2, TriangleAlert, TrendingUp, Truck, Undo2, Upload,
  UserCog, UserPlus, UserX, Users, Warehouse, X, IdCard, EyeOff, Ruler, Phone, PhoneCall, Globe, MapPin, User, ExternalLink, FolderOpen, MessageSquare, Video, Link, Briefcase, Percent, CreditCard, Store, CalendarX, GripVertical,
  type IconNode,
} from 'lucide';

/** Correspondance noms historiques (Material) → icônes Lucide : les configurations existantes (menus, listes, actions) restent inchangées. */
const ICONS: Record<string, IconNode> = {
  delete: Trash2, edit: Pencil, add: Plus, arrow_back: ArrowLeft, arrow_forward: ArrowRight, search: Search, warning: TriangleAlert, lock: Lock, verified: BadgeCheck, fact_check: ClipboardCheck,
  sync_alt: ArrowLeftRight, download: Download, upload: Upload, publish: Upload, undo: Undo2, unarchive: ArchiveRestore, archive: Archive, swap_vert: ArrowUpDown, rule: ListChecks, print: Printer,
  picture_as_pdf: FileText, description: FileText, request_quote: FileText, payments: Banknote, more_vert: EllipsisVertical, inventory: Boxes, inventory_2: Package, info: Info, history: Clock,
  content_copy: Copy, cancel: CircleX, block: Ban, attach_file: Paperclip, warehouse: Warehouse, visibility: Eye, verified_user: ShieldCheck, shield: Shield, upload_file: FileUp, thumb_down: ThumbsDown,
  table_view: Table, send: Send, save: Save, refresh: RefreshCw, receipt: Receipt, receipt_long: ReceiptText, playlist_add: ListPlus, person_add: UserPlus, note_add: FilePlus, move_to_inbox: PackageOpen,
  straighten: Ruler, menu: Menu, mail: Mail, logout: LogOut, list_alt: List, key: KeyRound, group: Users, groups: Users, group_off: UserX, domain: Building2, close: X, check_circle: CircleCheck, check: Check, category: Shapes,
  calculate: Calculator, badge: IdCard, arrow_drop_down: ChevronDown, expand_more: ChevronDown, expand_less: ChevronUp, chevron_right: ChevronRight, chevron_left: ChevronLeft, account_balance: Landmark,
  admin_panel_settings: UserCog, currency_exchange: Coins, dashboard: LayoutDashboard, flight_land: PlaneLanding, local_shipping: Truck, menu_book: BookOpen, settings: Settings, shopping_cart: ShoppingCart,
  panel_close: PanelLeftClose, panel_open: PanelLeftOpen, notifications: Bell, error: CircleAlert, schedule: Clock, calendar: CalendarDays, filter: Filter, trend_up: TrendingUp, arrow_up: ArrowUp, arrow_down: ArrowDown,
  phone: Phone, call: PhoneCall, public: Globe, place: MapPin, person: User, open_in_new: ExternalLink, folder: FolderOpen, chat: MessageSquare, videocam: Video, link: Link, work: Briefcase, percent: Percent, credit_card: CreditCard, store: Store,
  event_busy: CalendarX, drag_indicator: GripVertical, visibility_off: EyeOff, circle: Circle, radio_button_unchecked: Circle, hub: Circle,
};

 
type Tag = any;
/** Vrai si le nom (historique Material) correspond à une icône Lucide connue (sinon l'icône de repli s'affiche). */
export const hasIcon = (name: string) => name in ICONS;
/** Icône SVG inline (Lucide), héritant de la couleur du texte. `name` : nom Material historique (voir table ci-dessus). */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="strokeWidth()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    @for (n of nodes(); track $index) {
      @switch (n[0]) {
        @case ('path') {<svg:path [attr.d]="a(n).d" />}
        @case ('circle') {<svg:circle [attr.cx]="a(n).cx" [attr.cy]="a(n).cy" [attr.r]="a(n).r" />}
        @case ('rect') {<svg:rect [attr.x]="a(n).x" [attr.y]="a(n).y" [attr.width]="a(n).width" [attr.height]="a(n).height" [attr.rx]="a(n).rx" [attr.ry]="a(n).ry" />}
        @case ('line') {<svg:line [attr.x1]="a(n).x1" [attr.y1]="a(n).y1" [attr.x2]="a(n).x2" [attr.y2]="a(n).y2" />}
        @case ('polyline') {<svg:polyline [attr.points]="a(n).points" />}
        @case ('polygon') {<svg:polygon [attr.points]="a(n).points" />}
        @case ('ellipse') {<svg:ellipse [attr.cx]="a(n).cx" [attr.cy]="a(n).cy" [attr.rx]="a(n).rx" [attr.ry]="a(n).ry" />}
      }
    }
  </svg>`,
  styles: `:host{display:inline-flex;align-items:center;justify-content:center;width:var(--icon-size,1.125rem);height:var(--icon-size,1.125rem);flex:none;vertical-align:middle}svg{width:100%;height:100%}`,
})
export class Icon {
  name = input.required<string>();
  strokeWidth = input<number>(1.75);
  nodes = computed<IconNode>(() => ICONS[this.name()] ?? Circle);
  a = (n: unknown) => (n as [string, Tag])[1];
}
