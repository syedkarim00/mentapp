import { calendar } from '@/lib/domain';
import { getHangout } from '@/lib/store';
import { failure } from '@/lib/http';
export async function GET(_:Request,context:{params:Promise<{token:string}>}){try{return new Response(calendar(await getHangout((await context.params).token)),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="hangout.ics"','Cache-Control':'no-store'}});}catch(e){return failure(e);}}
