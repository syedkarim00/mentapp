import { actionSchema } from '@/lib/domain';
import { getHangout, mutate, rateLimit } from '@/lib/store';
import { body, failure, sameOrigin } from '@/lib/http';
type Context={params:Promise<{token:string}>};
export async function GET(_:Request,context:Context){try{return Response.json(await getHangout((await context.params).token),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request,context:Context){try{sameOrigin(request);await rateLimit(request);return Response.json(await mutate((await context.params).token,actionSchema.parse(await body(request))));}catch(e){return failure(e);}}
