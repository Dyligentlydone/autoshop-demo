export type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
};

export type Vehicle = {
  id: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  license_plate?: string;
  engine_size?: string;
  customer_id: string;
};

export type RepairOrderStatus =
  | 'New'
  | 'Scheduled'
  | 'Dropped Off'
  | 'Diagnosing'
  | 'Waiting Approval'
  | 'Repair Approved'
  | 'In Progress'
  | 'Ready For Pickup'
  | 'Completed';

export type RepairOrder = {
  id: string;
  vehicle_id: string;
  customer_id?: string;
  status: RepairOrderStatus;
  service_type: string;
  job_description?: string;
  note?: string;
  notes?: string;
  estimated_total?: number;
  final_charge_total?: number;
  estimated_completion?: string;
  scheduled_drop_off?: string;
  created_time: string;
  updated_time: string;
};

export type ActiveRepairOrderItem = {
  repairOrder: RepairOrder;
  vehicle: Vehicle | null;
  customer: Customer | null;
};

export type ZohoApiResponse<T> = {
  data: T[];
  info: {
    count: number;
    more_records: boolean;
  };
};

export type ApiResponse<T> = {
  data?: T;
  error?: string;
  status: number;
};

export type PartCondition = 'new' | 'used' | 'remanufactured';

export type LineItem = {
  id: string;
  repair_order_id: string;
  description: string;
  quantity: number;
  parts_cost: number;
  parts_price: number;
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  labor_price: number;
  part_number?: string;
  condition?: PartCondition;
  category?: string;
  notes?: string;
  taxable?: boolean;
  created_at: string;
  updated_at: string;
};

export type EstimateSummary = {
  total_cost: number;
  total_price: number;
  /** Sum of price for items where taxable !== false. */
  taxable_total: number;
  total_profit: number;
  profit_margin: number;
  line_items: LineItem[];
};

export type PartSource = 'aftermarket' | 'oem' | 'manual';
export type OrderStatus = 'not_ordered' | 'to_order' | 'ordered' | 'received';
export type EstimateStatus = 'draft' | 'completed' | 'ordered';

export type Estimate = {
  id: string;
  customer_id?: string;
  vehicle_id?: string;
  repair_order_id?: string;
  status: EstimateStatus;
  notes?: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
  updated_at: string;
};

export type EstimateItem = {
  id: string;
  estimate_id: string;
  description: string;
  quantity: number;
  parts_cost: number;
  parts_price: number;
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  labor_price: number;
  part_number?: string;
  supplier?: string;
  source: PartSource;
  condition?: PartCondition;
  order_status: OrderStatus;
  category?: string;
  notes?: string;
  taxable?: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type EstimatePreset = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  items?: EstimatePresetItem[];
};

export type EstimatePresetItem = {
  id: string;
  preset_id: string;
  description: string;
  quantity: number;
  parts_cost: number;
  parts_price: number;
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  labor_price: number;
  part_number?: string;
  supplier?: string;
  source: PartSource;
  category?: string;
  notes?: string;
  taxable?: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ShopSettings = {
  labor_rates: {
    hourly_rate: number;
    default_hours: number;
  };
  tax: {
    enabled: boolean;
    rate: number;
  };
  markup_presets: {
    standard: number;
    premium: number;
  };
  company_info: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
  };
  quote_settings: {
    valid_days: number;
    terms: string;
    payment_terms: string;
  };
};
