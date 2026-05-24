
import { Customer, RepairOrder, RepairOrderStatus, Vehicle, ZohoApiResponse } from '@/types';

type ZohoCustomer = {
  id: string;
  First_Name?: string;
  Last_Name?: string;
  Phone?: string;
  Email?: string;
};

type ZohoVehicle = {
  id: string;
  Name?: string;
  Make?: string;
  Model?: string;
  Vin?: string;
  License_Plate?: string;
  Engine_Size?: string;
  Owner1?: { id: string } | null;
};

type ZohoDeal = {
  id: string;
  Name?: string;
  Status?: string;
  Job_Description?: string;
  Note?: string;
  Estimated_Total?: number;
  Final_Charge_Total?: number;
  Estimated_Completion?: string;
  Vehicle?: { id: string } | null;
  Customer?: { id: string } | null;
  Created_Time?: string;
  Modified_Time?: string;
};

const normalizeRepairOrderStatus = (status: string | undefined): RepairOrderStatus => {
  const s = (status || '').trim();

  switch (s) {
    case 'New':
    case 'Scheduled':
    case 'Dropped Off':
    case 'Diagnosing':
    case 'Waiting Approval':
    case 'Repair Approved':
    case 'In Progress':
    case 'Ready For Pickup':
    case 'Completed':
      return s;
    default:
      return 'New';
  }
};

export const normalizeCustomer = (z: ZohoCustomer): Customer => ({
  id: z.id,
  first_name: z.First_Name || '',
  last_name: z.Last_Name || '',
  phone: z.Phone || '',
  email: z.Email || undefined,
});

export const normalizeVehicle = (z: ZohoVehicle): Vehicle => ({
  id: z.id,
  year: z.Name || '',
  make: z.Make || '',
  model: z.Model || '',
  vin: z.Vin || '',
  license_plate: z.License_Plate || undefined,
  engine_size: z.Engine_Size || undefined,
  customer_id: z.Owner1?.id || '',
});

export const normalizeRepairOrder = (z: ZohoDeal): RepairOrder => ({
  id: z.id,
  vehicle_id: z.Vehicle?.id || '',
  customer_id: z.Customer?.id || '',
  status: normalizeRepairOrderStatus(z.Status),
  service_type: z.Name || '',
  job_description: z.Job_Description || undefined,
  note: z.Note || undefined,
  notes: z.Note || z.Job_Description || undefined,
  estimated_total: typeof z.Estimated_Total === 'number' ? z.Estimated_Total : undefined,
  final_charge_total: typeof z.Final_Charge_Total === 'number' ? z.Final_Charge_Total : undefined,
  estimated_completion: z.Estimated_Completion || undefined,
  scheduled_drop_off: (z as any).Scheduled_drop_off || undefined,
  created_time: z.Created_Time || '',
  updated_time: z.Modified_Time || '',
});

export type ZohoListResponse<T> = ZohoApiResponse<T>;
