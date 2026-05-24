import { makeZohoRequest } from './auth';
import { Customer, Vehicle, RepairOrder, ZohoApiResponse } from '@/types';

const MODULE_MAP = {
  customers: 'Contacts',
  vehicles: 'Vehicles',
  repairOrders: 'Deals', // Using Deals module for repair orders
} as const;

// Helper to format vehicle display string
export const formatVehicleDisplay = (vehicle: Pick<Vehicle, 'year' | 'make' | 'model'>) => {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
};

// Customer Operations
export const getCustomer = async (id: string): Promise<Customer> => {
  const response = await makeZohoRequest<ZohoApiResponse<Customer>>(
    'GET',
    `/${MODULE_MAP.customers}/${id}`
  );
  return response.data[0];
};

export const findCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  try {
    const response = await makeZohoRequest<ZohoApiResponse<Customer>>(
      'GET',
      `/${MODULE_MAP.customers}/search?phone=${encodeURIComponent(phone)}`
    );
    return response.data[0] || null;
  } catch (error) {
    console.error('Error finding customer by phone:', error);
    return null;
  }
};

// Vehicle Operations
export const getVehicle = async (id: string): Promise<Vehicle> => {
  const response = await makeZohoRequest<ZohoApiResponse<Vehicle>>(
    'GET',
    `/${MODULE_MAP.vehicles}/${id}`
  );
  return response.data[0];
};

export const findVehicleByVIN = async (vin: string): Promise<Vehicle | null> => {
  try {
    const response = await makeZohoRequest<ZohoApiResponse<Vehicle>>(
      'GET',
      `/${MODULE_MAP.vehicles}/search?vin=${encodeURIComponent(vin)}`
    );
    return response.data[0] || null;
  } catch (error) {
    console.error('Error finding vehicle by VIN:', error);
    return null;
  }
};

export const createVehicle = async (vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> => {
  const response = await makeZohoRequest<{ data: { details: { id: string }[] } }>(
    'POST',
    `/${MODULE_MAP.vehicles}`,
    { data: [vehicle] }
  );
  
  const createdId = response.data.details[0].id;
  return getVehicle(createdId);
};

// Repair Order Operations
export const getRepairOrder = async (id: string): Promise<RepairOrder> => {
  const response = await makeZohoRequest<ZohoApiResponse<RepairOrder>>(
    'GET',
    `/${MODULE_MAP.repairOrders}/${id}?fields=id,Deal_Name,Stage,Service_Type,Description,Created_Time,Modified_Time`
  );
  return response.data[0];
};

export const getRepairOrders = async (params: {
  page?: number;
  perPage?: number;
  status?: string;
} = {}): Promise<{ data: RepairOrder[]; count: number }> => {
  const { page = 1, perPage = 10, status } = params;
  
  let query = `page=${page}&per_page=${perPage}`;
  if (status) {
    query += `&stage=${encodeURIComponent(status)}`;
  }
  
  const response = await makeZohoRequest<ZohoApiResponse<RepairOrder>>(
    'GET',
    `/${MODULE_MAP.repairOrders}?${query}`
  );
  
  return {
    data: response.data,
    count: response.info.count,
  };
};

export const createRepairOrder = async (
  vehicleId: string,
  data: Omit<RepairOrder, 'id' | 'vehicle_id' | 'created_time' | 'updated_time'>
): Promise<RepairOrder> => {
  const payload = {
    data: [
      {
        Deal_Name: `RO-${Date.now()}`,
        Stage: data.status,
        Service_Type: data.service_type,
        Description: data.notes,
        Vehicle: vehicleId,
      },
    ],
  };

  const response = await makeZohoRequest<{ data: { details: { id: string }[] } }>(
    'POST',
    `/${MODULE_MAP.repairOrders}`,
    payload
  );

  const createdId = response.data.details[0].id;
  return getRepairOrder(createdId);
};

export const updateRepairOrder = async (
  id: string,
  updates: Partial<Omit<RepairOrder, 'id' | 'vehicle_id' | 'created_time'>>
): Promise<RepairOrder> => {
  const payload = {
    data: [
      {
        id,
        ...(updates.status && { Stage: updates.status }),
        ...(updates.service_type && { Service_Type: updates.service_type }),
        ...(updates.notes !== undefined && { Description: updates.notes }),
      },
    ],
  };

  await makeZohoRequest(
    'PUT',
    `/${MODULE_MAP.repairOrders}`,
    payload
  );

  return getRepairOrder(id);
};
