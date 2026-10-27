import { createHangout, createSchema } from '@/lib/domain';
import { saveNew, rateLimit } from '@/lib/store';
import { body, failure, sameOrigin } from '@/lib/http';
export async function POST(request:Request){try{sameOrigin(request);await rateLimit(request,true);const hangout=createHangout(createSchema.parse(await body(request)));const token=await saveNew(hangout);return Response.json({token,hangout},{status:201});}catch(e){return failure(e);}}
