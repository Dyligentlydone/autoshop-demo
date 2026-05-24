/**
 * PartsTech Service Layer
 * 
 * This module provides the interface for PartsTech API integration.
 * Currently returns structured empty results since the API key is not yet connected.
 * When the PartsTech API key is obtained, swap the implementations below
 * with real API calls — the interface stays the same.
 * 
 * PartsTech API capabilities (when connected):
 * - Vehicle identification via VIN decode or Year/Make/Model/Engine
 * - Parts catalog search with fitment verification
 * - Real-time pricing and availability from suppliers
 * - Direct ordering through connected suppliers
 */

export type PartsTechPart = {
  id: string;
  partNumber: string;
  description: string;
  brand: string;
  price: number;
  listPrice: number;
  supplier: string;
  availability: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  estimatedDelivery?: string;
  fitmentNotes?: string;
  imageUrl?: string;
};

export type PartsTechVehicle = {
  vin?: string;
  year: string;
  make: string;
  model: string;
  engine?: string;
  submodel?: string;
};

export type PartsTechSearchResult = {
  parts: PartsTechPart[];
  vehicle?: PartsTechVehicle;
  totalResults: number;
  source: 'partstech' | 'unavailable';
  message?: string;
};

export type PartsTechOrderItem = {
  partNumber: string;
  quantity: number;
  supplier: string;
};

export type PartsTechOrderResult = {
  success: boolean;
  orderId?: string;
  message: string;
};

// Check if PartsTech is configured
export const isPartsTechConfigured = (): boolean => {
  return !!(process.env.PARTSTECH_API_KEY && process.env.PARTSTECH_API_URL);
};

// Search for parts by description + vehicle
export const searchParts = async (
  query: string,
  vehicle?: PartsTechVehicle
): Promise<PartsTechSearchResult> => {
  if (!isPartsTechConfigured()) {
    return {
      parts: [],
      vehicle,
      totalResults: 0,
      source: 'unavailable',
      message: 'PartsTech API not configured. Add PARTSTECH_API_KEY and PARTSTECH_API_URL to enable live parts search.',
    };
  }

  // TODO: Replace with real PartsTech API call when key is obtained
  // const response = await fetch(`${process.env.PARTSTECH_API_URL}/parts/search`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.PARTSTECH_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ query, vehicle }),
  // });
  // return await response.json();

  return {
    parts: [],
    vehicle,
    totalResults: 0,
    source: 'unavailable',
    message: 'PartsTech API not configured.',
  };
};

// Decode a VIN to get vehicle details
export const decodeVin = async (vin: string): Promise<PartsTechVehicle | null> => {
  if (!isPartsTechConfigured()) return null;

  // TODO: Replace with real PartsTech VIN decode
  return null;
};

// Place an order for parts
export const orderParts = async (
  items: PartsTechOrderItem[]
): Promise<PartsTechOrderResult> => {
  if (!isPartsTechConfigured()) {
    return {
      success: false,
      message: 'PartsTech API not configured. Parts have been saved for ordering later.',
    };
  }

  // TODO: Replace with real PartsTech order placement
  return {
    success: false,
    message: 'PartsTech ordering not yet implemented.',
  };
};

// Check availability for specific parts
export const checkAvailability = async (
  partNumbers: string[]
): Promise<Record<string, PartsTechPart['availability']>> => {
  if (!isPartsTechConfigured()) {
    return Object.fromEntries(partNumbers.map((pn) => [pn, 'unknown' as const]));
  }

  // TODO: Replace with real PartsTech availability check
  return Object.fromEntries(partNumbers.map((pn) => [pn, 'unknown' as const]));
};
