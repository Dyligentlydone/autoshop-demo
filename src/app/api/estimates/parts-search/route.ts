import { NextRequest, NextResponse } from 'next/server';
import { searchParts, isPartsTechConfigured } from '@/lib/partstech';

/**
 * POST /api/estimates/parts-search
 * 
 * Search for parts using PartsTech API.
 * Returns empty results with a message when API is not configured.
 * 
 * Body:
 *   query: string - part search term (e.g. "brake pads")
 *   vehicle?: { vin?, year, make, model, engine? }
 */
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const query = body.query;
    const vehicle = body.vehicle;

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const result = await searchParts(query, vehicle);

    return NextResponse.json({
      data: result,
      configured: isPartsTechConfigured(),
    });
  } catch (err: any) {
    console.error('[parts-search] error:', err);
    return NextResponse.json({ error: 'Failed to search parts' }, { status: 500 });
  }
};
